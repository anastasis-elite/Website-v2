-- PREPARED ONLY. Reviewed commerce dependency repair is the foundation.
-- Source SHA256: 3611bbc1ae7596b4cc52743eb3edaa2615604b01e58edb967ae2251ba3817f2a
-- No customer backfill or production application is performed by this package.
begin;
-- Dependency-complete for exact provider periods; no legacy DATE conversion/backfill.
alter table public.clients add column if not exists membership_expires_at timestamptz;
create table if not exists public.purchase_invitation_outbox (
  session_id text primary key,
  status text not null default 'pending' check(status in ('pending','sending','delivered','suppressed','manual_recovery')),
  invitation_id uuid,
  token_hash text,
  expires_at timestamptz,
  attempts integer not null default 0 check(attempts>=0),
  first_attempt_at timestamptz,
  next_attempt_at timestamptz not null default now(),
  lease_token uuid,
  lease_expires_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.purchase_invitation_outbox enable row level security;
revoke all on public.purchase_invitation_outbox from public,anon,authenticated,service_role;
grant select,insert,update,delete on public.purchase_invitation_outbox to service_role;
create index if not exists purchase_invitation_due_idx on public.purchase_invitation_outbox(status,next_attempt_at);
-- REVIEW PROPOSAL ONLY: dependency-complete, no customer backfill, unapplied.
-- Requires explicit production schema/policy/grant approval and exact-source rollout.
-- Paired application change supplies verified server email to the claim RPC.
-- Does not grant service_role SELECT on auth.users or replace P0 entitlement guards.
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
  email text not null, program text not null check(program in ('tracker','ember','ignite','phoenix')),
  livemode boolean not null, purchased_at timestamptz not null,
  fulfilled_at timestamptz not null default now()
);
alter table public.checkout_purchases enable row level security;
revoke all on public.checkout_purchases from anon, authenticated;
grant select,insert,update,delete on public.checkout_purchases to service_role;
alter table public.client_billing add column if not exists last_checkout_created_at timestamptz;
alter table public.client_billing add column if not exists last_subscription_event_created bigint not null default 0;
-- Never silently merge existing customer billing records to satisfy this key.
do $billing_duplicates$ begin
 if exists(select 1 from public.client_billing group by client_id having count(*)>1) then
   raise exception 'Operator review required: duplicate client_billing client_id rows; no customer records were merged or deleted';
 end if;
end $billing_duplicates$;
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
  -- Outdated callbacks must fail before locks, replay or any membership write.
  if not coalesce(jsonb_typeof(p_purchase)='object' and jsonb_typeof(p_purchase->'price_id')='string'
    and p_purchase->>'price_id' ~ '^price_[A-Za-z0-9]+$',false) then
    raise exception 'A verified checkout price_id is required' using errcode='22023';
  end if;
  if p_purchase is null or jsonb_typeof(p_purchase)<>'object' or v_id is null or v_id='' or v_email is null or v_email='' or coalesce(p_purchase->>'program','') not in ('tracker','ember','ignite','phoenix') or v_started is null or v_ends is null or v_purchased is null or v_access is null or v_ends<=v_started then raise exception 'Invalid purchase'; end if;
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
    insert into public.clients(client_id,email,full_name,program,auth_user_id,login_email,onboarding_completed,verified_purchase,access,active,subscription_status,subscription_started_at,membership_expires_at,updated_at)
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
      subscription_status=p_purchase->>'billing_status',subscription_started_at=v_started,membership_expires_at=v_ends,updated_at=now() where client_id=v_client_id;
    insert into public.client_billing(client_id,stripe_customer_id,stripe_subscription_id,billing_type,billing_status,current_period_start,current_period_end,last_payment_date,next_payment_date,access_active,cancel_at_period_end,updated_at,last_checkout_created_at,last_subscription_event_created,membership_program,stripe_price_id)
      values(v_client_id,p_purchase->>'customer_id',p_purchase->>'subscription_id',p_purchase->>'billing_type',p_purchase->>'billing_status',v_started,v_ends,v_purchased,case when p_purchase->>'billing_type'='subscription' then v_ends else null end,v_access,coalesce((p_purchase->>'cancel_at_period_end')::boolean,false),now(),v_purchased,0,p_purchase->>'program',case when p_purchase->>'price_id' ~ '^price_[A-Za-z0-9]+$' then p_purchase->>'price_id' else null end)
      on conflict(client_id) do update set stripe_customer_id=excluded.stripe_customer_id,stripe_subscription_id=excluded.stripe_subscription_id,billing_type=excluded.billing_type,billing_status=excluded.billing_status,current_period_start=excluded.current_period_start,current_period_end=excluded.current_period_end,last_payment_date=excluded.last_payment_date,next_payment_date=excluded.next_payment_date,access_active=excluded.access_active,cancel_at_period_end=excluded.cancel_at_period_end,updated_at=excluded.updated_at,last_checkout_created_at=excluded.last_checkout_created_at,last_subscription_event_created=0,membership_program=excluded.membership_program,stripe_price_id=excluded.stripe_price_id;
  end if;
  insert into public.checkout_purchases(session_id,client_id,email,program,livemode,purchased_at)
    values(v_id,v_client_id,v_email,p_purchase->>'program',(p_purchase->>'livemode')::boolean,v_purchased);
  if v_client.auth_user_id is null then
    insert into public.purchase_invitation_outbox(session_id) values(v_id) on conflict(session_id) do nothing;
  end if;
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
  update public.clients set subscription_status=p_state->>'status',access=v_access,active=v_access,subscription_started_at=(p_state->>'start')::timestamptz,membership_expires_at=(p_state->>'end')::timestamptz,updated_at=now() where client_id=v_billing.client_id;
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
      update public.clients set program=v_pending.program,verified_purchase=true,access=v_pending.access,active=v_pending.active,subscription_status=v_pending.subscription_status,subscription_started_at=v_pending.subscription_started_at,membership_expires_at=v_pending.membership_expires_at,updated_at=now() where client_id=v_target.client_id;
      insert into public.client_billing(client_id,stripe_customer_id,stripe_subscription_id,billing_type,billing_status,current_period_start,current_period_end,last_payment_date,next_payment_date,access_active,cancel_at_period_end,updated_at,last_checkout_created_at,last_subscription_event_created,membership_program,stripe_price_id)
        values(v_target.client_id,v_billing.stripe_customer_id,v_billing.stripe_subscription_id,v_billing.billing_type,v_billing.billing_status,v_billing.current_period_start,v_billing.current_period_end,v_billing.last_payment_date,v_billing.next_payment_date,v_billing.access_active,v_billing.cancel_at_period_end,now(),v_billing.last_checkout_created_at,v_billing.last_subscription_event_created,v_billing.membership_program,v_billing.stripe_price_id)
        on conflict(client_id) do update set stripe_customer_id=excluded.stripe_customer_id,stripe_subscription_id=excluded.stripe_subscription_id,billing_type=excluded.billing_type,billing_status=excluded.billing_status,current_period_start=excluded.current_period_start,current_period_end=excluded.current_period_end,last_payment_date=excluded.last_payment_date,next_payment_date=excluded.next_payment_date,access_active=excluded.access_active,cancel_at_period_end=excluded.cancel_at_period_end,updated_at=now(),last_checkout_created_at=excluded.last_checkout_created_at,last_subscription_event_created=excluded.last_subscription_event_created,membership_program=excluded.membership_program,stripe_price_id=excluded.stripe_price_id;
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
  select p_contract_version=3 and
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

-- Extend existing reviewed constraints without rewriting historical purchases.
alter table public.checkout_purchases drop constraint if exists checkout_purchases_program_check;
alter table public.checkout_purchases add constraint checkout_purchases_program_check check(program in ('tracker','ember','ignite','phoenix'));
alter table public.client_billing add column if not exists stripe_price_id text;
alter table public.client_billing add column if not exists membership_program text;
alter table public.client_billing add column if not exists last_subscription_state_fingerprint text;
alter table public.client_billing add column if not exists subscription_sync_conflicted boolean not null default false;
do $constraint$
begin
  if not exists(select 1 from pg_constraint where conrelid='public.purchase_invitation_outbox'::regclass and conname='purchase_invitation_receipt_fk') then
    alter table public.purchase_invitation_outbox add constraint purchase_invitation_receipt_fk foreign key(session_id) references public.checkout_purchases(session_id) on delete cascade;
  end if;
  if not exists(select 1 from pg_constraint where conrelid='public.purchase_invitation_outbox'::regclass and conname='purchase_invitation_record_fk') then
    alter table public.purchase_invitation_outbox add constraint purchase_invitation_record_fk foreign key(invitation_id) references public.client_invitations(id);
  end if;
end
$constraint$;

create or replace function public.sync_member_subscription_v3(p_subscription_id text,p_state jsonb)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare
  v_billing public.client_billing%rowtype;
  v_client public.clients%rowtype;
  v_id text;
  v_created bigint:=(p_state->>'event_created')::bigint;
  v_program text:=p_state->>'program';
  v_price text:=p_state->>'price_id';
  v_status text:=p_state->>'status';
  v_start timestamptz:=(p_state->>'start')::timestamptz;
  v_end timestamptz:=(p_state->>'end')::timestamptz;
  v_access boolean;
  v_mapped boolean;
  v_changed boolean;
  v_fingerprint text;
begin
  if p_state is null or jsonb_typeof(p_state)<>'object' or nullif(p_subscription_id,'') is null or v_created is null or v_created<0
    or v_start is null or v_end is null or v_end<=v_start or coalesce(v_status,'') not in ('active','trialing','past_due','unpaid','paused','canceled','incomplete','incomplete_expired') then
    raise exception 'Invalid subscription state';
  end if;
  select client_id into v_id from public.client_billing where stripe_subscription_id=p_subscription_id;
  if not found then return jsonb_build_object('accepted',false,'changed',false); end if;
  -- Client then billing lock ordering matches checkout fulfillment/claim.
  select * into v_client from public.clients where client_id=v_id for update;
  select * into v_billing from public.client_billing where client_id=v_id and stripe_subscription_id=p_subscription_id for update;
  if not found or v_created<v_billing.last_subscription_event_created
    or (v_billing.billing_status in ('canceled','incomplete_expired') and v_status not in ('canceled','incomplete_expired')) then
    return jsonb_build_object('accepted',false,'changed',false,'client_id',v_id);
  end if;
  -- Only the trusted service maps current provider prices to a known program.
  -- An unknown/unconfigured price revokes grants while preserving old data/tier.
  v_mapped:=coalesce(v_program in ('tracker','ember','ignite','phoenix') and v_price ~ '^price_[A-Za-z0-9]+$',false);
  v_access:=v_mapped and v_status in ('active','trialing') and coalesce((p_state->>'access')::boolean,false) and v_end>now();
  -- Event timestamps have one-second resolution; provider event IDs are not an
  -- ordering. A conflicting same-second snapshot cannot safely grant access.
  -- Hash provider state, not clock-derived expiry, so exact replays stay stable.
  v_fingerprint:=md5(jsonb_build_object('status',v_status,'program',v_program,'price_id',v_price,
    'access',coalesce((p_state->>'access')::boolean,false),'start_epoch',extract(epoch from v_start),
    'end_epoch',extract(epoch from v_end),'cancel_at_period_end',coalesce((p_state->>'cancelAtPeriodEnd')::boolean,false))::text);
  if v_created=v_billing.last_subscription_event_created and v_status not in ('canceled','incomplete_expired') then
    if v_billing.subscription_sync_conflicted or (
      v_billing.last_subscription_state_fingerprint is distinct from v_fingerprint
      and (v_billing.last_subscription_state_fingerprint is not null or v_billing.last_subscription_event_created>0)
    ) then
      update public.client_billing set access_active=false,subscription_sync_conflicted=true,updated_at=now() where client_id=v_id;
      update public.clients set access=false,active=false,updated_at=now() where client_id=v_id;
      return jsonb_build_object('accepted',false,'changed',coalesce(v_billing.access_active,false) or coalesce(v_client.access,false) or coalesce(v_client.active,false) or not v_billing.subscription_sync_conflicted,
        'conflict',true,'client_id',v_id,'auth_user_id',v_client.auth_user_id,
        'previous_program',v_client.program,'program',v_client.program,'previous_status',v_billing.billing_status,'status',v_billing.billing_status);
    end if;
  end if;
  v_changed:=v_client.program is distinct from case when v_mapped then v_program else v_client.program end
    or v_billing.billing_status is distinct from v_status or v_billing.access_active is distinct from v_access
    or v_billing.current_period_start is distinct from v_start or v_billing.current_period_end is distinct from v_end
    or v_billing.stripe_price_id is distinct from case when v_mapped then v_price else null end;
  update public.client_billing set billing_status=v_status,access_active=v_access,current_period_start=v_start,current_period_end=v_end,
    stripe_price_id=case when v_mapped then v_price else null end,membership_program=case when v_mapped then v_program else null end,
    cancel_at_period_end=coalesce((p_state->>'cancelAtPeriodEnd')::boolean,false),last_subscription_event_created=v_created,
    last_subscription_state_fingerprint=v_fingerprint,subscription_sync_conflicted=false,updated_at=now()
    where client_id=v_id;
  update public.clients set program=case when v_mapped then v_program else program end,subscription_status=v_status,access=v_access,active=v_access,
    subscription_started_at=v_start,membership_expires_at=v_end,updated_at=now() where client_id=v_id;
  return jsonb_build_object('accepted',true,'changed',v_changed,'client_id',v_id,'auth_user_id',v_client.auth_user_id,
    'previous_program',v_client.program,'program',case when v_mapped then v_program else v_client.program end,
    'previous_status',v_billing.billing_status,'status',v_status);
end $$;
revoke all on function public.sync_member_subscription_v3(text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.sync_member_subscription_v3(text,jsonb) to service_role;

-- Outdated callers must retry after code cutover without changing membership.
create or replace function public.sync_member_subscription(p_subscription_id text,p_state jsonb)
returns void language plpgsql security invoker set search_path=public,pg_temp as $$
begin
  if not coalesce(jsonb_typeof(p_state)='object' and jsonb_typeof(p_state->'program')='string'
    and p_state->>'program' in ('tracker','ember','ignite','phoenix')
    and jsonb_typeof(p_state->'price_id')='string' and p_state->>'price_id' ~ '^price_[A-Za-z0-9]+$',false) then
    raise exception 'A mapped subscription program and price_id are required' using errcode='22023';
  end if;
  perform public.sync_member_subscription_v3(p_subscription_id,p_state);
end $$;
revoke all on function public.sync_member_subscription(text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.sync_member_subscription(text,jsonb) to service_role;

create or replace function public.claim_purchase_invitation(p_session_id text,p_token_hash text,p_expires_at timestamptz)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare
  v_job public.purchase_invitation_outbox%rowtype;
  v_purchase public.checkout_purchases%rowtype;
  v_client public.clients%rowtype;
  v_lease uuid:=gen_random_uuid();
  v_invitation uuid;
begin
  select * into v_job from public.purchase_invitation_outbox where session_id=p_session_id for update;
  if not found or v_job.status in ('delivered','suppressed','manual_recovery') then return null; end if;
  if v_job.next_attempt_at>now() or (v_job.status='sending' and v_job.lease_expires_at>now()) then return null; end if;
  select * into v_purchase from public.checkout_purchases where session_id=p_session_id;
  select * into v_client from public.clients where client_id=v_purchase.client_id;
  if v_purchase.session_id is null or v_client.client_id is null then raise exception 'Invitation purchase is missing'; end if;
  if v_client.auth_user_id is not null or exists(
    select 1 from public.clients c where c.auth_user_id is not null
      and (lower(trim(c.email))=lower(trim(v_purchase.email)) or lower(trim(c.login_email))=lower(trim(v_purchase.email)))
  ) then
    update public.purchase_invitation_outbox set status='suppressed',lease_token=null,lease_expires_at=null where session_id=p_session_id;
    return null;
  end if;
  -- The provider's idempotency retention is bounded. Hold an uncertain delivery
  -- for manual recovery before that window ends instead of sending a duplicate.
  if v_job.first_attempt_at is not null and v_job.first_attempt_at<=now()-interval '23 hours' then
    update public.purchase_invitation_outbox set status='manual_recovery',lease_token=null,lease_expires_at=null where session_id=p_session_id;
    return null;
  end if;
  if p_token_hash is null or p_token_hash!~'^[a-f0-9]{64}$' then raise exception 'Invalid invitation hash'; end if;
  if v_job.token_hash is not null and v_job.token_hash<>p_token_hash then raise exception 'Invitation delivery key changed; manual recovery required'; end if;
  if v_job.invitation_id is null then
    if p_expires_at is null or p_expires_at<=now() or p_expires_at>now()+interval '48 hours 5 minutes' then raise exception 'Invalid invitation expiry'; end if;
    insert into public.client_invitations(client_id,email,token_hash,expires_at)
      values(v_purchase.client_id,v_purchase.email,p_token_hash,p_expires_at) returning id into v_invitation;
    update public.purchase_invitation_outbox set invitation_id=v_invitation,token_hash=p_token_hash,expires_at=p_expires_at where session_id=p_session_id;
  end if;
  update public.purchase_invitation_outbox set status='sending',attempts=attempts+1,first_attempt_at=coalesce(first_attempt_at,now()),
    lease_token=v_lease,lease_expires_at=now()+interval '2 minutes' where session_id=p_session_id returning * into v_job;
  return jsonb_build_object('session_id',p_session_id,'client_id',v_purchase.client_id,'email',v_purchase.email,'program',v_purchase.program,
    'invitation_id',v_job.invitation_id,'expires_at',v_job.expires_at,'lease_token',v_lease,'first_attempt_at',v_job.first_attempt_at);
end $$;
revoke all on function public.claim_purchase_invitation(text,text,timestamptz) from public,anon,authenticated,service_role;
grant execute on function public.claim_purchase_invitation(text,text,timestamptz) to service_role;

create or replace function public.finish_purchase_invitation(p_session_id text,p_lease_token uuid,p_delivered boolean)
returns boolean language plpgsql security invoker set search_path=public,pg_temp as $$
declare v_job public.purchase_invitation_outbox%rowtype;
begin
  select * into v_job from public.purchase_invitation_outbox where session_id=p_session_id for update;
  if not found or v_job.status<>'sending' or v_job.lease_token is distinct from p_lease_token or p_delivered is null then return false; end if;
  if p_delivered then
    update public.client_invitations set delivered_at=coalesce(delivered_at,now()) where id=v_job.invitation_id;
    update public.purchase_invitation_outbox set status='delivered',delivered_at=now(),lease_token=null,lease_expires_at=null where session_id=p_session_id;
  else
    update public.purchase_invitation_outbox set status='pending',next_attempt_at=now()+interval '5 minutes',lease_token=null,lease_expires_at=null where session_id=p_session_id;
  end if;
  return true;
end $$;
revoke all on function public.finish_purchase_invitation(text,uuid,boolean) from public,anon,authenticated,service_role;
grant execute on function public.finish_purchase_invitation(text,uuid,boolean) to service_role;

-- Version 3 additionally requires the atomic tier and durable delivery contracts.
create or replace function public.commerce_configuration_ready(p_contract_version integer)
returns boolean language sql stable security invoker set search_path=public,pg_temp as $$
  select p_contract_version=3
    and exists(select 1 from information_schema.columns where table_schema='public' and table_name='clients' and column_name='membership_expires_at' and data_type='timestamp with time zone')
    and to_regprocedure('public.fulfill_checkout_purchase(jsonb)') is not null
    and to_regprocedure('public.sync_member_subscription_v3(text,jsonb)') is not null
    and to_regprocedure('public.claim_checkout_purchase(text,uuid,text)') is not null
    and to_regprocedure('public.claim_purchase_invitation(text,text,timestamptz)') is not null
    and to_regprocedure('public.finish_purchase_invitation(text,uuid,boolean)') is not null
    and has_function_privilege('service_role','public.fulfill_checkout_purchase(jsonb)','EXECUTE')
    and has_function_privilege('service_role','public.sync_member_subscription_v3(text,jsonb)','EXECUTE')
    and has_function_privilege('service_role','public.claim_checkout_purchase(text,uuid,text)','EXECUTE')
    and has_function_privilege('service_role','public.claim_purchase_invitation(text,text,timestamptz)','EXECUTE')
    and has_function_privilege('service_role','public.finish_purchase_invitation(text,uuid,boolean)','EXECUTE')
    and has_sequence_privilege('service_role','public.api_request_events_id_seq','USAGE')
    and (select count(*)=6 from information_schema.columns where table_schema='public' and table_name='client_billing'
      and column_name in ('last_checkout_created_at','last_subscription_event_created','stripe_price_id','membership_program','last_subscription_state_fingerprint','subscription_sync_conflicted'))
    and not exists (
      select 1 from unnest(array['client_invitations','api_request_events','stripe_webhook_events','checkout_purchases','purchase_invitation_outbox','client_billing','clients']) as names(table_name)
      where not(has_table_privilege('service_role','public.'||table_name,'SELECT') and has_table_privilege('service_role','public.'||table_name,'INSERT')
        and has_table_privilege('service_role','public.'||table_name,'UPDATE') and has_table_privilege('service_role','public.'||table_name,'DELETE'))
    )
$$;
revoke all on function public.commerce_configuration_ready(integer) from public,anon,authenticated,service_role;
grant execute on function public.commerce_configuration_ready(integer) to service_role;
notify pgrst,'reload schema';
commit;
