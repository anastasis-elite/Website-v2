-- Prepared only: consent-ordered attribution and immutable ingestion identity.
alter table public.analytics_member_consent add column revision bigint not null default 0,
  add column client_id uuid, add column journey_id text;
alter table public.analytics_conversion_receipts alter column user_id drop not null;
alter table public.analytics_conversion_receipts add column distinct_id text, add column journey_id text, add column browser_client_id uuid;
alter table public.analytics_conversion_receipts drop constraint analytics_conversion_receipts_event_check;
alter table public.analytics_conversion_receipts add constraint analytics_conversion_receipts_event_check check(event in ('analytics_identity_linked','subscription_activated','subscription_upgraded','subscription_cancelled','onboarding_completed','first_workout_completed','first_nutrition_completed','first_recovery_completed'));
create unique index analytics_lifecycle_identity on public.analytics_conversion_receipts(event,dedup_key)
  where event in ('subscription_activated','subscription_upgraded','subscription_cancelled');
create table public.analytics_browser_consent(client_id uuid primary key,accepted boolean not null,revision bigint not null check(revision between 1 and 9007199254740991),journey_id text,updated_at timestamptz not null default now());
create table public.analytics_journeys(journey_id text primary key,client_id uuid not null,user_id uuid references auth.users(id) on delete cascade);
create table public.checkout_analytics_context(session_id text primary key,client_id uuid not null,revision bigint not null,journey_id text,accepted boolean not null,created_at timestamptz not null default now());
alter table public.analytics_browser_consent enable row level security;
alter table public.analytics_journeys enable row level security;
alter table public.checkout_analytics_context enable row level security;
revoke all on public.analytics_browser_consent,public.analytics_journeys,public.checkout_analytics_context from public,anon,authenticated;
grant select,insert,update,delete on public.analytics_browser_consent,public.analytics_journeys,public.checkout_analytics_context to service_role;

-- Older requests cannot overwrite a withdrawal, even if they arrive last.
-- Equal-version conflicts always choose withdrawal. Startup reuses the same
-- browser revision; it does not manufacture a fresh opt-in.
create function public.record_analytics_consent_v2(p_user_id uuid,p_accepted boolean,p_revision bigint,p_client_id uuid,p_journey_id text default null)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare v_browser public.analytics_browser_consent%rowtype;v_owner uuid;v_member public.analytics_member_consent%rowtype;
begin
  if p_accepted is null or p_client_id is null or p_revision is null or p_revision<1 or p_revision>9007199254740991
    or (p_accepted and coalesce(p_journey_id,'')!~'^anonymous_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') then raise exception 'Invalid analytics preference'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_client_id::text,1));
  select * into v_browser from public.analytics_browser_consent where client_id=p_client_id for update;
  if found and (v_browser.revision>p_revision or v_browser.revision=p_revision and not v_browser.accepted and p_accepted) then return false; end if;
  insert into public.analytics_browser_consent(client_id,accepted,revision,journey_id) values(p_client_id,p_accepted,p_revision,p_journey_id)
    on conflict(client_id) do update set accepted=excluded.accepted,revision=excluded.revision,journey_id=coalesce(excluded.journey_id,analytics_browser_consent.journey_id),updated_at=now();
  if p_accepted then
    insert into public.analytics_journeys(journey_id,client_id) values(p_journey_id,p_client_id) on conflict do nothing;
    select user_id into v_owner from public.analytics_journeys where journey_id=p_journey_id and client_id=p_client_id for update;
    if not found or (v_owner is not null and p_user_id is not null and v_owner<>p_user_id) then return false; end if;
  end if;
  if p_user_id is not null then
    perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,2));
    select * into v_member from public.analytics_member_consent where user_id=p_user_id for update;
    if found and (v_member.revision>p_revision or v_member.revision=p_revision and not v_member.accepted and p_accepted) then return false; end if;
    insert into public.analytics_member_consent(user_id,accepted,revision,client_id,journey_id) values(p_user_id,p_accepted,p_revision,p_client_id,p_journey_id)
      on conflict(user_id) do update set accepted=excluded.accepted,revision=excluded.revision,client_id=excluded.client_id,journey_id=case when excluded.accepted then excluded.journey_id else null end,updated_at=now();
    if p_accepted then
      update public.analytics_journeys set user_id=p_user_id where journey_id=p_journey_id and (user_id is null or user_id=p_user_id);
      perform analytics_private.record_conversion(p_user_id,'analytics_identity_linked',p_journey_id,'{}');
    end if;
  end if;
  if not p_accepted then
    update public.analytics_conversion_receipts set eligible=false,claim_token=null,claim_until=null
      where delivered_at is null and (browser_client_id=p_client_id or (p_user_id is not null and user_id=p_user_id));
  end if;
  return true;
end $$;
revoke all on function public.record_analytics_consent_v2(uuid,boolean,bigint,uuid,text) from public,anon,authenticated;
grant execute on function public.record_analytics_consent_v2(uuid,boolean,bigint,uuid,text) to service_role;
-- Retire the unversioned opt-in RPC; a delayed old client cannot bypass ordering.
create or replace function public.set_analytics_consent(p_accepted boolean)
returns void language plpgsql security definer set search_path=public,pg_temp as $$begin raise exception 'Update the analytics preference client'; end$$;
revoke all on function public.set_analytics_consent(boolean) from public,anon,authenticated;

create function public.save_checkout_analytics_context(p_session_id text,p_client_id uuid,p_revision bigint,p_journey_id text,p_accepted boolean)
returns void language plpgsql security invoker set search_path=public,pg_temp as $$
begin
  if p_session_id is null or p_session_id!~'^cs_[a-zA-Z0-9_]+$' then raise exception 'Invalid checkout context'; end if;
  if not exists(select 1 from public.analytics_browser_consent where client_id=p_client_id and revision=p_revision and accepted=p_accepted and (not p_accepted or journey_id=p_journey_id)) then return; end if;
  insert into public.checkout_analytics_context(session_id,client_id,revision,journey_id,accepted) values(p_session_id,p_client_id,p_revision,p_journey_id,p_accepted)
    on conflict do nothing;
end $$;
revoke all on function public.save_checkout_analytics_context(text,uuid,bigint,text,boolean) from public,anon,authenticated;
grant execute on function public.save_checkout_analytics_context(text,uuid,bigint,text,boolean) to service_role;

create or replace function analytics_private.record_conversion(p_user uuid,p_event text,p_key text,p_properties jsonb default '{}')
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_safe jsonb:='{}';v_tier text:=p_properties->>'tier';v_previous text:=p_properties->>'previous_tier';v_consent public.analytics_member_consent%rowtype;v_existing public.analytics_conversion_receipts%rowtype;v_distinct text;
begin
  if p_user is null then return; end if;
  select * into v_consent from public.analytics_member_consent where user_id=p_user;
  v_distinct:='member_'||encode(sha256(convert_to('anastasis-analytics-v1:'||lower(p_user::text),'UTF8')),'hex');
  if v_tier in ('free','tracker','ember','ignite','phoenix') then v_safe:=v_safe||jsonb_build_object('tier',v_tier); end if;
  if v_previous in ('free','tracker','ember','ignite','phoenix') then v_safe:=v_safe||jsonb_build_object('previous_tier',v_previous); end if;
  if p_event in ('subscription_activated','subscription_upgraded','subscription_cancelled') then
    select * into v_existing from public.analytics_conversion_receipts where event=p_event and dedup_key=md5(p_key) for update;
    if found then
      -- Preserve original uuid/event/time/distinct_id on owner binding and retries.
      if v_existing.user_id is null then update public.analytics_conversion_receipts set user_id=p_user where id=v_existing.id; end if;
      return;
    end if;
  end if;
  insert into public.analytics_conversion_receipts(user_id,event,dedup_key,properties,eligible,distinct_id,journey_id,browser_client_id)
    values(p_user,p_event,md5(p_key),v_safe,coalesce(v_consent.accepted,false),v_distinct,v_consent.journey_id,v_consent.client_id)
    on conflict do nothing;
end $$;

-- A paid guest can be counted without returning to a browser. The checkout
-- consent snapshot must precede purchase and remain unwithdrawn at delivery.
create function analytics_private.checkout_paid_conversion()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_context public.checkout_analytics_context%rowtype;v_billing public.client_billing%rowtype;v_owner uuid;v_id uuid:=gen_random_uuid();v_eligible boolean:=false;
begin
  select * into v_context from public.checkout_analytics_context where session_id=new.session_id;
  select * into v_billing from public.client_billing where client_id=new.client_id;
  if nullif(v_billing.stripe_subscription_id,'') is null or not v_billing.access_active or v_billing.membership_program not in ('tracker','ember','ignite','phoenix') then return new; end if;
  select auth_user_id into v_owner from public.clients where client_id=new.client_id;
  v_eligible:=coalesce(v_context.accepted,false) and v_context.created_at<=new.fulfilled_at and exists(select 1 from public.analytics_browser_consent b where b.client_id=v_context.client_id and b.accepted and b.revision>=v_context.revision);
  if v_owner is not null then v_eligible:=v_eligible and exists(select 1 from public.analytics_member_consent where user_id=v_owner and accepted); end if;
  insert into public.analytics_conversion_receipts(id,user_id,event,dedup_key,properties,eligible,occurred_at,distinct_id,journey_id,browser_client_id)
    values(v_id,v_owner,'subscription_activated',md5(v_billing.stripe_subscription_id),jsonb_build_object('tier',v_billing.membership_program),v_eligible,new.fulfilled_at,
      case when v_context.journey_id is not null then v_context.journey_id else 'suppressed_'||v_id::text end,v_context.journey_id,v_context.client_id)
    on conflict do nothing;
  return new;
end $$;
revoke all on function analytics_private.checkout_paid_conversion() from public,anon,authenticated;
create trigger analytics_checkout_paid after insert on public.checkout_purchases for each row execute function analytics_private.checkout_paid_conversion();

create function analytics_private.bind_subscription_analytics(p_user uuid,p_subscription text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_context public.checkout_analytics_context%rowtype;v_browser public.analytics_browser_consent%rowtype;v_consent public.analytics_member_consent%rowtype;v_journey text;
begin
  select a.* into v_context from public.checkout_analytics_context a join public.checkout_purchases p on p.session_id=a.session_id join public.client_billing b on b.client_id=p.client_id
    where b.stripe_subscription_id=p_subscription order by p.purchased_at desc limit 1;
  if not found or not v_context.accepted then return; end if;
  select * into v_browser from public.analytics_browser_consent where client_id=v_context.client_id;
  if not found or not v_browser.accepted or v_browser.revision<v_context.revision then return; end if;
  perform public.record_analytics_consent_v2(p_user,true,v_context.revision,v_context.client_id,v_context.journey_id);
  select * into v_consent from public.analytics_member_consent where user_id=p_user;
  if not coalesce(v_consent.accepted,false) then return; end if;
  select journey_id into v_journey from public.analytics_journeys where journey_id=v_context.journey_id and (user_id is null or user_id=p_user) for update;
  if found then
    update public.analytics_journeys set user_id=p_user where journey_id=v_journey;
    -- This consent-valid link joins a previous guest journey to later member
    -- actions, without mutating the original activation event's ingestion id.
    insert into public.analytics_conversion_receipts(user_id,event,dedup_key,eligible,distinct_id,journey_id,browser_client_id)
      values(p_user,'analytics_identity_linked',md5(v_journey),true,'member_'||encode(sha256(convert_to('anastasis-analytics-v1:'||lower(p_user::text),'UTF8')),'hex'),v_journey,v_context.client_id)
      on conflict do nothing;
  end if;
end $$;
revoke all on function analytics_private.bind_subscription_analytics(uuid,text) from public,anon,authenticated;

create or replace function analytics_private.billing_conversion()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_owner uuid;v_old jsonb:=case when tg_op='UPDATE' then to_jsonb(old) else '{}'::jsonb end;v_new jsonb:=to_jsonb(new);v_subscription text:=v_new->>'stripe_subscription_id';v_tier text:=v_new->>'membership_program';v_event text;v_key text;
begin
  select auth_user_id into v_owner from public.clients where client_id=v_new->>'client_id';
  if v_owner is null or nullif(v_subscription,'') is null then return new; end if;
  perform analytics_private.bind_subscription_analytics(v_owner,v_subscription);
  if v_new->>'billing_status' in ('canceled','incomplete_expired') and coalesce(v_old->>'billing_status','') not in ('canceled','incomplete_expired') then
    v_event:='subscription_cancelled';v_key:=v_subscription;
  elsif v_tier in ('tracker','ember','ignite','phoenix') and coalesce((v_new->>'access_active')::boolean,false) then
    perform analytics_private.record_conversion(v_owner,'subscription_activated',v_subscription,jsonb_build_object('tier',v_tier));
    if tg_op='UPDATE' and v_old->>'stripe_subscription_id'=v_subscription and
      array_position(array['tracker','ember','ignite','phoenix'],v_tier)>array_position(array['tracker','ember','ignite','phoenix'],v_old->>'membership_program') then
      v_event:='subscription_upgraded';v_key:=v_subscription||':'||coalesce(v_new->>'last_subscription_event_created','0')||':'||v_tier;
    end if;
  end if;
  if v_event is not null then perform analytics_private.record_conversion(v_owner,v_event,v_key,jsonb_build_object('tier',v_tier,'previous_tier',v_old->>'membership_program')); end if;
  return new;
end $$;

create or replace function analytics_private.purchase_binding_conversion()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_billing public.client_billing%rowtype;
begin
  if new.auth_user_id is not null and old.auth_user_id is null then
    select * into v_billing from public.client_billing where client_id=new.client_id;
    if found and v_billing.access_active and v_billing.membership_program in ('tracker','ember','ignite','phoenix') and nullif(v_billing.stripe_subscription_id,'') is not null then
      perform analytics_private.bind_subscription_analytics(new.auth_user_id,v_billing.stripe_subscription_id);
      perform analytics_private.record_conversion(new.auth_user_id,'subscription_activated',v_billing.stripe_subscription_id,jsonb_build_object('tier',v_billing.membership_program));
    end if;
  end if;
  return new;
end $$;

create or replace function public.claim_analytics_conversions(p_user_id uuid default null,p_limit integer default 10)
returns setof public.analytics_conversion_receipts language plpgsql security invoker set search_path=public,pg_temp as $$
declare v_token uuid:=gen_random_uuid();
begin
  return query update public.analytics_conversion_receipts r set claim_token=v_token,claim_until=now()+interval '5 minutes',attempts=attempts+1
    where r.id in (select q.id from public.analytics_conversion_receipts q
      left join public.analytics_member_consent c on c.user_id=q.user_id
      left join public.analytics_browser_consent b on b.client_id=q.browser_client_id
      where q.eligible and q.distinct_id is not null and (q.user_id is null or c.accepted) and (q.browser_client_id is null or b.accepted)
        and q.delivered_at is null and (p_user_id is null or q.user_id=p_user_id) and (q.claim_until is null or q.claim_until<now())
      order by q.occurred_at limit greatest(1,least(coalesce(p_limit,10),25)) for update of q skip locked)
    returning r.*;
end $$;

create function public.validate_analytics_delivery(p_ids uuid[],p_token uuid)
returns uuid[] language sql stable security invoker set search_path=public,pg_temp as $$
  select coalesce(array_agg(r.id),'{}'::uuid[]) from public.analytics_conversion_receipts r
    left join public.analytics_member_consent c on c.user_id=r.user_id
    left join public.analytics_browser_consent b on b.client_id=r.browser_client_id
    where r.id=any(p_ids) and r.claim_token=p_token and r.claim_until>now() and r.eligible and r.delivered_at is null
      and (r.user_id is null or c.accepted) and (r.browser_client_id is null or b.accepted);
$$;
revoke all on function public.validate_analytics_delivery(uuid[],uuid) from public,anon,authenticated;
grant execute on function public.validate_analytics_delivery(uuid[],uuid) to service_role;
