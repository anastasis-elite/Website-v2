-- Prepared only. A fresh provider read inside a fenced lease can reconcile
-- equal-second conflicts without inventing provider timestamps or event order.
begin;
alter table public.client_billing add column if not exists subscription_sync_revision bigint not null default 0;
create or replace function public.stamp_subscription_sync_revision()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  new.subscription_sync_revision:=old.subscription_sync_revision+1;
  return new;
end $$;
revoke all on function public.stamp_subscription_sync_revision() from public,anon,authenticated,service_role;
create trigger subscription_sync_revision before update on public.client_billing for each row execute function public.stamp_subscription_sync_revision();

create table public.subscription_reconciliation_leases (
  subscription_id text primary key,
  client_id text not null references public.clients(client_id),
  owner_id uuid,
  token uuid not null,
  expected_revision bigint not null,
  expires_at timestamptz not null
);
alter table public.subscription_reconciliation_leases enable row level security;
revoke all on public.subscription_reconciliation_leases from public,anon,authenticated,service_role;
grant select,insert,update,delete on public.subscription_reconciliation_leases to service_role;

create function public.claim_subscription_reconciliation(p_subscription_id text)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare v_id text; v_client public.clients%rowtype; v_billing public.client_billing%rowtype; v_lease public.subscription_reconciliation_leases%rowtype;
begin
  select client_id into v_id from public.client_billing where stripe_subscription_id=p_subscription_id;
  if not found then return jsonb_build_object('reconciled',true,'unlinked',true); end if;
  -- Match the checkout/subscription client's lock order, with no DB lock held
  -- while the application waits for the provider network response.
  select * into v_client from public.clients where client_id=v_id for update;
  select * into v_billing from public.client_billing where client_id=v_id and stripe_subscription_id=p_subscription_id for update;
  if not found then return jsonb_build_object('retry',true); end if;
  select * into v_lease from public.subscription_reconciliation_leases where subscription_id=p_subscription_id for update;
  if not found and not v_billing.subscription_sync_conflicted then return jsonb_build_object('reconciled',true,'client_id',v_id); end if;
  if found and v_lease.expires_at>clock_timestamp() then return jsonb_build_object('retry',true); end if;
  insert into public.subscription_reconciliation_leases(subscription_id,client_id,owner_id,token,expected_revision,expires_at)
    values(p_subscription_id,v_id,v_client.auth_user_id,gen_random_uuid(),v_billing.subscription_sync_revision,clock_timestamp()+interval '2 minutes')
    on conflict(subscription_id) do update set client_id=excluded.client_id,owner_id=excluded.owner_id,token=excluded.token,
      expected_revision=excluded.expected_revision,expires_at=excluded.expires_at returning * into v_lease;
  return jsonb_build_object('lease_token',v_lease.token,'revision',v_lease.expected_revision,'client_id',v_id);
end $$;
revoke all on function public.claim_subscription_reconciliation(text) from public,anon,authenticated,service_role;
grant execute on function public.claim_subscription_reconciliation(text) to service_role;

create function public.release_subscription_reconciliation(p_subscription_id text,p_lease_token uuid)
returns void language sql security invoker set search_path=public,pg_temp as $$
  -- Keep failed/CAS-invalid work discoverable even if a newer delivery changed
  -- the conflict flag. Only a fenced success removes this pending intent.
  update public.subscription_reconciliation_leases set expires_at=least(expires_at,clock_timestamp())
    where subscription_id=p_subscription_id and token=p_lease_token;
$$;
revoke all on function public.release_subscription_reconciliation(text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.release_subscription_reconciliation(text,uuid) to service_role;

create function public.reconcile_member_subscription(p_subscription_id text,p_lease_token uuid,p_expected_revision bigint,p_state jsonb)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare
  v_id text;v_client public.clients%rowtype;v_billing public.client_billing%rowtype;v_lease public.subscription_reconciliation_leases%rowtype;
  v_program text:=p_state->>'program';v_price text:=p_state->>'price_id';v_status text:=p_state->>'status';
  v_start timestamptz:=(p_state->>'start')::timestamptz;v_end timestamptz:=(p_state->>'end')::timestamptz;
  v_mapped boolean;v_access boolean;v_fingerprint text;
begin
  if p_state is null or jsonb_typeof(p_state)<>'object' or v_start is null or v_end is null or not isfinite(v_start) or not isfinite(v_end)
    or v_end<=v_start or coalesce(v_status,'') not in ('active','trialing','past_due','unpaid','paused','canceled','incomplete','incomplete_expired') then
    raise exception 'Invalid current subscription state';
  end if;
  select client_id into v_id from public.subscription_reconciliation_leases where subscription_id=p_subscription_id;
  if not found then return jsonb_build_object('retry',true); end if;
  select * into v_client from public.clients where client_id=v_id for update;
  select * into v_billing from public.client_billing where client_id=v_id and stripe_subscription_id=p_subscription_id for update;
  if not found then
    perform public.release_subscription_reconciliation(p_subscription_id,p_lease_token);
    return jsonb_build_object('retry',true);
  end if;
  select * into v_lease from public.subscription_reconciliation_leases where subscription_id=p_subscription_id for update;
  if not found or v_lease.token is distinct from p_lease_token or v_lease.expires_at<=clock_timestamp()
    or v_lease.expected_revision is distinct from p_expected_revision or v_billing.subscription_sync_revision is distinct from p_expected_revision
    or v_client.auth_user_id is distinct from v_lease.owner_id then
    perform public.release_subscription_reconciliation(p_subscription_id,p_lease_token);
    return jsonb_build_object('retry',true);
  end if;
  if v_billing.billing_status in ('canceled','incomplete_expired') and v_status not in ('canceled','incomplete_expired') then
    delete from public.subscription_reconciliation_leases where subscription_id=p_subscription_id and token=p_lease_token;
    return jsonb_build_object('reconciled',true,'accepted',false,'terminal',true,'client_id',v_id);
  end if;
  v_mapped:=coalesce(v_program in ('tracker','ember','ignite','phoenix') and v_price ~ '^price_[A-Za-z0-9]+$',false);
  v_access:=v_mapped and v_status in ('active','trialing') and coalesce((p_state->>'access')::boolean,false) and v_end>clock_timestamp();
  v_fingerprint:=md5(jsonb_build_object('status',v_status,'program',v_program,'price_id',v_price,
    'access',coalesce((p_state->>'access')::boolean,false),'start_epoch',extract(epoch from v_start),
    'end_epoch',extract(epoch from v_end),'cancel_at_period_end',coalesce((p_state->>'cancelAtPeriodEnd')::boolean,false))::text);
  update public.client_billing set billing_status=v_status,access_active=v_access,current_period_start=v_start,current_period_end=v_end,
    stripe_price_id=case when v_mapped then v_price else null end,membership_program=case when v_mapped then v_program else null end,
    cancel_at_period_end=coalesce((p_state->>'cancelAtPeriodEnd')::boolean,false),last_subscription_state_fingerprint=v_fingerprint,
    subscription_sync_conflicted=false,updated_at=now() where client_id=v_id;
  -- The original event timestamp high-water mark is intentionally unchanged.
  update public.clients set program=case when v_mapped then v_program else program end,subscription_status=v_status,access=v_access,active=v_access,
    subscription_started_at=v_start,membership_expires_at=v_end,updated_at=now() where client_id=v_id;
  delete from public.subscription_reconciliation_leases where subscription_id=p_subscription_id and token=p_lease_token;
  return jsonb_build_object('reconciled',true,'accepted',true,'client_id',v_id,'program',case when v_mapped then v_program else v_client.program end,'status',v_status);
end $$;
revoke all on function public.reconcile_member_subscription(text,uuid,bigint,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.reconcile_member_subscription(text,uuid,bigint,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
