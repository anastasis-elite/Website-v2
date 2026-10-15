-- REVIEW PROPOSAL ONLY: dependency-complete, no customer backfill, unapplied.
-- Requires explicit production schema/policy/grant approval and exact-source rollout.
-- Paired application change supplies verified server email to the claim RPC.
-- Does not grant service_role SELECT on auth.users or replace P0 entitlement guards.
begin;
create table if not exists public.client_invitations (
  id uuid primary key default gen_random_uuid(),
  client_id text not null references public.clients(client_id) on delete cascade,
  email text not null, token_hash text not null unique,
  purpose text not null default 'create_login', expires_at timestamptz not null,
  consumed_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.api_request_events (
  id bigint generated always as identity primary key, scope text not null,
  key_hash text not null, created_at timestamptz not null default now()
);
create index if not exists client_invitations_client_expiry_idx on public.client_invitations(client_id,expires_at desc);
create index if not exists api_request_events_lookup_idx on public.api_request_events(scope,key_hash,created_at desc);
alter table public.client_invitations enable row level security;
alter table public.api_request_events enable row level security;
revoke all on public.client_invitations,public.api_request_events from public,anon,authenticated,service_role;
grant select,insert,update,delete on public.client_invitations,public.api_request_events to service_role;
revoke all on sequence public.api_request_events_id_seq from public,anon,authenticated,service_role;
grant usage,select on sequence public.api_request_events_id_seq to service_role;
alter table public.client_billing enable row level security;
revoke all on public.client_billing from public,anon,authenticated,service_role;
grant select on public.client_billing to authenticated;
grant select,insert,update,delete on public.client_billing to service_role;
drop policy if exists "pr10 read owned billing" on public.client_billing;
create policy "pr10 read owned billing" on public.client_billing for select to authenticated
  using(exists(select 1 from public.clients c where c.client_id=client_billing.client_id and c.auth_user_id=(select auth.uid())));
drop policy if exists "pr10 billing owner boundary" on public.client_billing;
create policy "pr10 billing owner boundary" on public.client_billing as restrictive for select to authenticated
  using(exists(select 1 from public.clients c where c.client_id=client_billing.client_id and c.auth_user_id=(select auth.uid())));
-- Retire the old invoker signature that required broad auth-table permissions.
drop function if exists public.claim_checkout_purchase(text,uuid);
alter table public.client_invitations add column if not exists delivered_at timestamptz;
create table if not exists public.stripe_webhook_events (
  event_id text primary key, event_type text not null,
  processed_at timestamptz not null default now(), client_id text,
  payload jsonb not null default '{}'
);
alter table public.stripe_webhook_events enable row level security;
revoke all on public.stripe_webhook_events from anon, authenticated;
grant select,insert,update,delete on public.stripe_webhook_events to service_role;

create table if not exists public.checkout_purchases (
  session_id text primary key,
  client_id text not null references public.clients(client_id),
  email text not null, program text not null check(program in ('ember','ignite','phoenix')),
  livemode boolean not null, purchased_at timestamptz not null,
  fulfilled_at timestamptz not null default now()
);
alter table public.checkout_purchases enable row level security;
revoke all on public.checkout_purchases from anon, authenticated;
grant select,insert,update,delete on public.checkout_purchases to service_role;
alter table public.client_billing add column if not exists last_checkout_created_at timestamptz;
alter table public.client_billing add column if not exists last_subscription_event_created bigint not null default 0;
create unique index if not exists client_billing_client_key on public.client_billing(client_id);

create or replace function public.fulfill_checkout_purchase(p_purchase jsonb)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare
  v_client public.clients%rowtype;
  v_previous public.checkout_purchases%rowtype;
  v_id text := p_purchase->>'session_id';
  v_client_id text;
  v_email text := lower(trim(p_purchase->>'email'));
  v_started timestamptz := (p_purchase->>'period_start')::timestamptz;
  v_ends timestamptz := (p_purchase->>'period_end')::timestamptz;
  v_purchased timestamptz := (p_purchase->>'purchased_at')::timestamptz;
  v_access boolean := (p_purchase->>'access_active')::boolean;
  v_last timestamptz;
  v_existing_billing public.client_billing%rowtype;
begin
  if p_purchase is null or jsonb_typeof(p_purchase)<>'object' or v_id is null or v_id='' or v_email is null or v_email='' or coalesce(p_purchase->>'program','') not in ('ember','ignite','phoenix') or v_started is null or v_ends is null or v_purchased is null or v_access is null or v_ends<=v_started then raise exception 'Invalid purchase'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_id,0));
  select * into v_previous from public.checkout_purchases where session_id=v_id;
  if found then
    select * into v_client from public.clients where client_id=v_previous.client_id;
    return jsonb_build_object('client_id',v_client.client_id,'email',v_previous.email,'program',v_client.program,'auth_user_id',v_client.auth_user_id,'replayed',true);
  end if;
  if nullif(p_purchase->>'bound_client_id','') is not null then
    select * into v_client from public.clients
      where client_id=p_purchase->>'bound_client_id'
        and auth_user_id=(p_purchase->>'bound_user_id')::uuid for update;
    if not found then raise exception 'Purchase owner does not match client'; end if;
    v_client_id:=v_client.client_id;
  else
    -- An email entered at Checkout is not proof of an existing member's ownership.
    -- A guest purchase gets its own pending record, never an email-selected client.
    v_client_id:='AN-'||md5(v_id);
    insert into public.clients(client_id,email,full_name,program,auth_user_id,login_email,onboarding_completed,verified_purchase,access,active,subscription_status,subscription_started_at,subscription_ends_at,updated_at)
    values(v_client_id,v_email,nullif(p_purchase->>'full_name',''),p_purchase->>'program',null,null,false,true,v_access,v_access,p_purchase->>'billing_status',v_started,v_ends,now());
  end if;
  select * into v_existing_billing from public.client_billing where client_id=v_client_id for update;
  v_last:=v_existing_billing.last_checkout_created_at;
  if nullif(v_existing_billing.stripe_subscription_id,'') is not null
     and v_existing_billing.stripe_subscription_id is distinct from nullif(p_purchase->>'subscription_id','')
     and coalesce(v_existing_billing.billing_status,'') not in ('canceled','incomplete_expired') then
    raise exception 'Existing recurring subscription requires support before activating another purchase';
  end if;
  if v_last is not null and v_purchased<=v_last
     and nullif(p_purchase->>'subscription_id','') is not null
     and nullif(p_purchase->>'subscription_id','') is distinct from v_existing_billing.stripe_subscription_id
     and coalesce(p_purchase->>'billing_status','') not in ('canceled','incomplete_expired') then
    raise exception 'Older recurring purchase requires support before activation';
  end if;
  if v_last is null or v_purchased>v_last then
    update public.clients set program=p_purchase->>'program',verified_purchase=true,access=v_access,active=v_access,
      subscription_status=p_purchase->>'billing_status',subscription_started_at=v_started,subscription_ends_at=v_ends,updated_at=now() where client_id=v_client_id;
    insert into public.client_billing(client_id,stripe_customer_id,stripe_subscription_id,billing_type,billing_status,current_period_start,current_period_end,last_payment_date,next_payment_date,access_active,cancel_at_period_end,updated_at,last_checkout_created_at,last_subscription_event_created)
      values(v_client_id,p_purchase->>'customer_id',p_purchase->>'subscription_id',p_purchase->>'billing_type',p_purchase->>'billing_status',v_started,v_ends,v_purchased,case when p_purchase->>'billing_type'='subscription' then v_ends else null end,v_access,coalesce((p_purchase->>'cancel_at_period_end')::boolean,false),now(),v_purchased,0)
      on conflict(client_id) do update set stripe_customer_id=excluded.stripe_customer_id,stripe_subscription_id=excluded.stripe_subscription_id,billing_type=excluded.billing_type,billing_status=excluded.billing_status,current_period_start=excluded.current_period_start,current_period_end=excluded.current_period_end,last_payment_date=excluded.last_payment_date,next_payment_date=excluded.next_payment_date,access_active=excluded.access_active,cancel_at_period_end=excluded.cancel_at_period_end,updated_at=excluded.updated_at,last_checkout_created_at=excluded.last_checkout_created_at,last_subscription_event_created=0;
  end if;
  insert into public.checkout_purchases(session_id,client_id,email,program,livemode,purchased_at)
    values(v_id,v_client_id,v_email,p_purchase->>'program',(p_purchase->>'livemode')::boolean,v_purchased);
  select * into v_client from public.clients where client_id=v_client_id;
  return jsonb_build_object('client_id',v_client.client_id,'email',v_email,'program',v_client.program,'auth_user_id',v_client.auth_user_id,'replayed',false);
end $$;
revoke execute on function public.fulfill_checkout_purchase(jsonb) from public,anon,authenticated;
grant execute on function public.fulfill_checkout_purchase(jsonb) to service_role;

create or replace function public.sync_member_subscription(p_subscription_id text,p_state jsonb)
returns void language plpgsql security invoker set search_path=public,pg_temp as $$
declare v_billing public.client_billing%rowtype;v_created bigint:=(p_state->>'event_created')::bigint;v_access boolean;
begin
  select * into v_billing from public.client_billing where stripe_subscription_id=p_subscription_id for update;
  if not found then return; end if;
  if v_created<v_billing.last_subscription_event_created then return; end if;
  -- Stripe cancellation is terminal for this subscription ID. Equal-second
  -- delivery races must not resurrect it from an older active snapshot.
  if v_billing.billing_status in ('canceled','incomplete_expired') and p_state->>'status' not in ('canceled','incomplete_expired') then return; end if;
  v_access:=coalesce((p_state->>'access')::boolean,false) and (p_state->>'end')::timestamptz>now();
  update public.client_billing set billing_status=p_state->>'status',access_active=v_access,current_period_start=(p_state->>'start')::timestamptz,current_period_end=(p_state->>'end')::timestamptz,
    cancel_at_period_end=coalesce((p_state->>'cancelAtPeriodEnd')::boolean,false),last_subscription_event_created=v_created,updated_at=now() where client_id=v_billing.client_id;
  update public.clients set subscription_status=p_state->>'status',access=v_access,active=v_access,subscription_started_at=(p_state->>'start')::timestamptz,subscription_ends_at=(p_state->>'end')::timestamptz,updated_at=now() where client_id=v_billing.client_id;
end $$;
revoke execute on function public.sync_member_subscription(text,jsonb) from public,anon,authenticated;
grant execute on function public.sync_member_subscription(text,jsonb) to service_role;

-- A returning customer may pay as a guest. A verified login with the receipt
-- email can claim that pending purchase; the email typed at checkout alone
-- never alters a previous member account.
create or replace function public.claim_checkout_purchase(p_session_id text,p_user_id uuid,p_verified_email text)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare v_purchase public.checkout_purchases%rowtype;v_pending public.clients%rowtype;v_target public.clients%rowtype;v_billing public.client_billing%rowtype;v_existing_billing public.client_billing%rowtype;v_email text;v_latest timestamptz;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_session_id,0));
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));
  -- Verified email comes only from server auth.getUser(), never a browser field.
  v_email:=nullif(lower(trim(p_verified_email)),'');
  if p_user_id is null or v_email is null then raise exception 'Verified login is required'; end if;
  select * into v_purchase from public.checkout_purchases where session_id=p_session_id for update;
  if v_email is null or v_purchase.email is distinct from v_email then raise exception 'Purchase email does not match verified login'; end if;
  select * into v_pending from public.clients where client_id=v_purchase.client_id for update;
  if v_pending.auth_user_id is not null and v_pending.auth_user_id<>p_user_id then raise exception 'Purchase already belongs to another login'; end if;
  select * into v_target from public.clients where auth_user_id=p_user_id limit 1 for update;
  if not found then
    update public.clients set auth_user_id=p_user_id,login_email=v_email,updated_at=now() where client_id=v_pending.client_id;
    v_target:=v_pending;v_target.auth_user_id:=p_user_id;
  elsif v_target.client_id<>v_pending.client_id then
    select * into v_billing from public.client_billing where client_id=v_pending.client_id for update;
    select * into v_existing_billing from public.client_billing where client_id=v_target.client_id for update;
    v_latest:=v_existing_billing.last_checkout_created_at;
    if v_billing.client_id is null then raise exception 'Pending purchase billing missing'; end if;
    -- A second purchase must not hide an existing recurring charge from its portal.
    -- Keep both identities intact for support to reconcile rather than dropping one.
    if nullif(v_existing_billing.stripe_subscription_id,'') is not null
       and v_existing_billing.stripe_subscription_id is distinct from v_billing.stripe_subscription_id
       and coalesce(v_existing_billing.billing_status,'') not in ('canceled','incomplete_expired') then
      raise exception 'Existing recurring subscription requires support before connecting another purchase';
    end if;
    if v_latest is not null and v_purchase.purchased_at<=v_latest
       and nullif(v_billing.stripe_subscription_id,'') is not null
       and v_billing.stripe_subscription_id is distinct from v_existing_billing.stripe_subscription_id
       and coalesce(v_billing.billing_status,'') not in ('canceled','incomplete_expired') then
      raise exception 'Older recurring purchase requires support before connecting';
    end if;
    if v_latest is null or v_purchase.purchased_at>v_latest then
      update public.clients set program=v_pending.program,verified_purchase=true,access=v_pending.access,active=v_pending.active,subscription_status=v_pending.subscription_status,subscription_started_at=v_pending.subscription_started_at,subscription_ends_at=v_pending.subscription_ends_at,updated_at=now() where client_id=v_target.client_id;
      insert into public.client_billing(client_id,stripe_customer_id,stripe_subscription_id,billing_type,billing_status,current_period_start,current_period_end,last_payment_date,next_payment_date,access_active,cancel_at_period_end,updated_at,last_checkout_created_at,last_subscription_event_created)
        values(v_target.client_id,v_billing.stripe_customer_id,v_billing.stripe_subscription_id,v_billing.billing_type,v_billing.billing_status,v_billing.current_period_start,v_billing.current_period_end,v_billing.last_payment_date,v_billing.next_payment_date,v_billing.access_active,v_billing.cancel_at_period_end,now(),v_billing.last_checkout_created_at,v_billing.last_subscription_event_created)
        on conflict(client_id) do update set stripe_customer_id=excluded.stripe_customer_id,stripe_subscription_id=excluded.stripe_subscription_id,billing_type=excluded.billing_type,billing_status=excluded.billing_status,current_period_start=excluded.current_period_start,current_period_end=excluded.current_period_end,last_payment_date=excluded.last_payment_date,next_payment_date=excluded.next_payment_date,access_active=excluded.access_active,cancel_at_period_end=excluded.cancel_at_period_end,updated_at=now(),last_checkout_created_at=excluded.last_checkout_created_at,last_subscription_event_created=excluded.last_subscription_event_created;
    end if;
    update public.checkout_purchases set client_id=v_target.client_id where session_id=p_session_id;
    update public.client_billing set stripe_customer_id=null,stripe_subscription_id=null,access_active=false,updated_at=now() where client_id=v_pending.client_id;
    update public.clients set access=false,active=false,updated_at=now() where client_id=v_pending.client_id;
  end if;
  select * into v_target from public.clients where client_id=v_target.client_id;
  return jsonb_build_object('client_id',v_target.client_id,'email',v_email,'program',v_target.program,'auth_user_id',p_user_id);
end $$;
revoke execute on function public.claim_checkout_purchase(text,uuid,text) from public,anon,authenticated;
grant execute on function public.claim_checkout_purchase(text,uuid,text) to service_role;

-- Customer IDs authorize the billing portal. Browser callers must never be
-- able to replace them, even when older permissive grants/policies remain.
revoke insert,update,delete on public.client_billing from anon,authenticated;
create or replace function public.protect_member_billing()
returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
begin
  if current_user in ('anon','authenticated') then raise exception 'Billing records can only be changed by the server'; end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
drop trigger if exists protect_member_billing on public.client_billing;
create trigger protect_member_billing before insert or update or delete on public.client_billing for each row execute function public.protect_member_billing();
revoke execute on function public.protect_member_billing() from public,anon,authenticated;


-- Enforce server-only receipt/ledger access even if PUBLIC defaults are permissive.
revoke all on public.checkout_purchases,public.stripe_webhook_events from public,anon,authenticated,service_role;
grant select,insert,update,delete on public.checkout_purchases,public.stripe_webhook_events to service_role;
create or replace function public.commerce_configuration_ready(p_contract_version integer)
returns boolean language sql stable security invoker set search_path=public,pg_temp as $$
  select p_contract_version=2 and
    to_regprocedure('public.fulfill_checkout_purchase(jsonb)') is not null
    and to_regprocedure('public.sync_member_subscription(text,jsonb)') is not null
    and to_regprocedure('public.claim_checkout_purchase(text,uuid,text)') is not null
    and has_function_privilege('service_role','public.fulfill_checkout_purchase(jsonb)','EXECUTE')
    and has_function_privilege('service_role','public.sync_member_subscription(text,jsonb)','EXECUTE')
    and has_function_privilege('service_role','public.claim_checkout_purchase(text,uuid,text)','EXECUTE')
    and has_sequence_privilege('service_role','public.api_request_events_id_seq','USAGE')
    and (select count(*)=2 from information_schema.columns where table_schema='public'
      and table_name='client_billing' and column_name in ('last_checkout_created_at','last_subscription_event_created'))
    and not exists (
      select 1 from unnest(array['client_invitations','api_request_events','stripe_webhook_events','checkout_purchases','client_billing','clients']) as names(table_name)
      where not (has_table_privilege('service_role','public.'||table_name,'SELECT')
        and has_table_privilege('service_role','public.'||table_name,'INSERT')
        and has_table_privilege('service_role','public.'||table_name,'UPDATE')
        and has_table_privilege('service_role','public.'||table_name,'DELETE'))
    )
$$;
revoke all on function public.commerce_configuration_ready(integer) from public,anon,authenticated,service_role;
grant execute on function public.commerce_configuration_ready(integer) to service_role;
-- Older application source must not open checkout with an incompatible claim
-- signature during a separately approved database/application rollout.
create or replace function public.commerce_configuration_ready()
returns boolean language sql stable security invoker set search_path=public,pg_temp as $$select false$$;
revoke all on function public.commerce_configuration_ready() from public,anon,authenticated,service_role;
grant execute on function public.commerce_configuration_ready() to service_role;
notify pgrst,'reload schema';
commit;
