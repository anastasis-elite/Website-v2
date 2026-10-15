-- Additive payment hardening; reviewed source and CLI-generated migration.
-- Not applied to production. Isolated PostgreSQL verification only.
alter table public.client_invitations add column if not exists delivered_at timestamptz;
create table if not exists public.stripe_webhook_events (
  event_id text primary key, event_type text not null,
  processed_at timestamptz not null default now(), client_id text,
  payload jsonb not null default '{}'
);
alter table public.stripe_webhook_events enable row level security;
revoke all on public.stripe_webhook_events from anon, authenticated;
grant all on public.stripe_webhook_events to service_role;

create table if not exists public.checkout_purchases (
  session_id text primary key,
  client_id text not null references public.clients(client_id),
  email text not null, program text not null check(program in ('ember','ignite','phoenix')),
  livemode boolean not null, purchased_at timestamptz not null,
  fulfilled_at timestamptz not null default now()
);
alter table public.checkout_purchases enable row level security;
revoke all on public.checkout_purchases from anon, authenticated;
grant all on public.checkout_purchases to service_role;
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
  if v_id is null or v_email is null or v_email='' or p_purchase->>'program' not in ('ember','ignite','phoenix') or v_ends<=v_started then raise exception 'Invalid purchase'; end if;
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
create or replace function public.claim_checkout_purchase(p_session_id text,p_user_id uuid)
returns jsonb language plpgsql security invoker set search_path=public,auth,pg_temp as $$
declare v_purchase public.checkout_purchases%rowtype;v_pending public.clients%rowtype;v_target public.clients%rowtype;v_billing public.client_billing%rowtype;v_existing_billing public.client_billing%rowtype;v_email text;v_latest timestamptz;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_session_id,0));
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));
  select lower(email) into v_email from auth.users where id=p_user_id and email_confirmed_at is not null;
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
revoke execute on function public.claim_checkout_purchase(text,uuid) from public,anon,authenticated;
grant execute on function public.claim_checkout_purchase(text,uuid) to service_role;

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

create or replace function public.protect_member_entitlements()
returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
declare v_field text;
begin
  if current_user in ('anon','authenticated') then
    if tg_op='INSERT' then raise exception 'Member entitlements must be provisioned by the server'; end if;
    foreach v_field in array array['client_id','auth_user_id','email','login_email','program','verified_purchase','access','active','subscription_status','subscription_started_at','subscription_ends_at'] loop
      if to_jsonb(new)->v_field is distinct from to_jsonb(old)->v_field then raise exception 'Member entitlement fields cannot be changed from the browser'; end if;
    end loop;
  end if;
  return new;
end $$;
drop trigger if exists protect_member_entitlements on public.clients;
create trigger protect_member_entitlements before insert or update on public.clients for each row execute function public.protect_member_entitlements();
revoke execute on function public.protect_member_entitlements() from public,anon,authenticated;
notify pgrst,'reload schema';

create or replace function public.commerce_configuration_ready()
returns boolean language sql security invoker set search_path=public,pg_temp as $$ select true $$;
revoke execute on function public.commerce_configuration_ready() from public,anon,authenticated;
grant execute on function public.commerce_configuration_ready() to service_role;
