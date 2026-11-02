-- Prepared only. Apply after the launch commerce foundation; no backfill.
create schema if not exists analytics_private;
revoke all on schema analytics_private from public, anon, authenticated;

create table public.analytics_member_consent (
  user_id uuid primary key references auth.users(id) on delete cascade,
  accepted boolean not null,
  updated_at timestamptz not null default now()
);
create table public.analytics_conversion_receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event text not null check(event in ('subscription_activated','subscription_upgraded','subscription_cancelled','onboarding_completed','first_workout_completed','first_nutrition_completed','first_recovery_completed')),
  dedup_key text not null,
  properties jsonb not null default '{}',
  eligible boolean not null default false,
  occurred_at timestamptz not null default now(),
  delivered_at timestamptz,
  claim_token uuid,
  claim_until timestamptz,
  attempts integer not null default 0,
  unique(user_id,event,dedup_key)
);
alter table public.analytics_member_consent enable row level security;
alter table public.analytics_conversion_receipts enable row level security;
revoke all on public.analytics_member_consent, public.analytics_conversion_receipts from public, anon, authenticated;
grant select,insert,update,delete on public.analytics_member_consent,public.analytics_conversion_receipts to service_role;

create function public.set_analytics_consent(p_accepted boolean)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if auth.uid() is null or p_accepted is null then raise exception 'Authenticated preference required'; end if;
  insert into public.analytics_member_consent(user_id,accepted) values(auth.uid(),p_accepted)
    on conflict(user_id) do update set accepted=excluded.accepted,updated_at=now();
  if not p_accepted then
    update public.analytics_conversion_receipts set eligible=false,claim_token=null,claim_until=null
      where user_id=auth.uid() and delivered_at is null;
  end if;
end $$;
revoke execute on function public.set_analytics_consent(boolean) from public,anon;
grant execute on function public.set_analytics_consent(boolean) to authenticated;

-- Internal success marker, never exposed as an authenticated event-creation API.
-- Suppressed occurrences stay suppressed, so later consent cannot mislabel a
-- second workout as the first, or backfill events from before consent.
create function analytics_private.record_conversion(p_user uuid,p_event text,p_key text,p_properties jsonb default '{}')
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_safe jsonb:='{}';v_tier text:=p_properties->>'tier';v_previous text:=p_properties->>'previous_tier';
begin
  if p_user is null then return; end if;
  if v_tier in ('free','tracker','ember','ignite','phoenix') then v_safe:=v_safe||jsonb_build_object('tier',v_tier); end if;
  if v_previous in ('free','tracker','ember','ignite','phoenix') then v_safe:=v_safe||jsonb_build_object('previous_tier',v_previous); end if;
  insert into public.analytics_conversion_receipts(user_id,event,dedup_key,properties,eligible)
    values(p_user,p_event,md5(p_key),v_safe,exists(select 1 from public.analytics_member_consent where user_id=p_user and accepted))
    on conflict(user_id,event,dedup_key) do nothing;
end $$;
revoke execute on function analytics_private.record_conversion(uuid,text,text,jsonb) from public,anon,authenticated;

create function analytics_private.action_conversion()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_row jsonb:=to_jsonb(new);v_owner uuid;v_event text;v_client text;
begin
  if tg_table_name='clients' then
    if tg_op='UPDATE' and coalesce((to_jsonb(old)->>'onboarding_completed')::boolean,false) then return new; end if;
    if coalesce((v_row->>'onboarding_completed')::boolean,false) then v_event:='onboarding_completed';v_owner:=(v_row->>'auth_user_id')::uuid; end if;
  elsif tg_table_name='workout_logs' then
    if tg_op='UPDATE' and coalesce((to_jsonb(old)->>'completed')::boolean,false) then return new; end if;
    if coalesce((v_row->>'completed')::boolean,false) then v_event:='first_workout_completed';v_client:=v_row->>'client_id'; end if;
  elsif tg_table_name='recovery_activity_logs' then v_event:='first_recovery_completed';v_client:=v_row->>'client_id';
  elsif tg_table_name='meal_entries' then
    if v_row->>'entry_state'='confirmed' then v_event:='first_nutrition_completed'; end if;
  elsif tg_table_name='macro_entries' then
    if coalesce((v_row->>'calories')::numeric,0)>0 or coalesce((v_row->>'protein_g')::numeric,0)>0 or coalesce((v_row->>'carbs_g')::numeric,0)>0 or coalesce((v_row->>'fat_g')::numeric,0)>0 then v_event:='first_nutrition_completed'; end if;
  end if;
  if v_event is null then return new; end if;
  if tg_table_name in ('meal_entries','macro_entries') then
    select c.auth_user_id into v_owner from public.nutrition_logs n join public.clients c on c.client_id=n.client_id where n.id=(v_row->>'nutrition_log_id')::uuid;
  elsif v_client is not null then select auth_user_id into v_owner from public.clients where client_id=v_client;
  end if;
  -- Existing successful history is evidence too: installing analytics must not
  -- relabel a returning member's next saved action as their first-ever action.
  if v_event='first_workout_completed' and exists (
    select 1 from public.workout_logs w join public.clients c on c.client_id=w.client_id
      where c.auth_user_id=v_owner and w.completed and w.id::text is distinct from v_row->>'id'
  ) then return new; end if;
  if v_event='first_recovery_completed' and exists (
    select 1 from public.recovery_activity_logs r join public.clients c on c.client_id=r.client_id
      where c.auth_user_id=v_owner and r.id::text is distinct from v_row->>'id'
  ) then return new; end if;
  if v_event='first_nutrition_completed' and (
    exists(select 1 from public.meal_entries m join public.nutrition_logs n on n.id=m.nutrition_log_id join public.clients c on c.client_id=n.client_id
      where c.auth_user_id=v_owner and m.entry_state='confirmed' and (tg_table_name<>'meal_entries' or m.id::text is distinct from v_row->>'id'))
    or exists(select 1 from public.macro_entries m join public.nutrition_logs n on n.id=m.nutrition_log_id join public.clients c on c.client_id=n.client_id
      where c.auth_user_id=v_owner and (coalesce(m.calories,0)>0 or coalesce(m.protein_g,0)>0 or coalesce(m.carbs_g,0)>0 or coalesce(m.fat_g,0)>0)
        and (tg_table_name<>'macro_entries' or m.id::text is distinct from v_row->>'id'))
  ) then return new; end if;
  perform analytics_private.record_conversion(v_owner,v_event,'first','{}');
  return new;
end $$;
revoke execute on function analytics_private.action_conversion() from public,anon,authenticated;
create trigger analytics_onboarding_success after insert or update of onboarding_completed on public.clients for each row execute function analytics_private.action_conversion();
create trigger analytics_workout_success after insert or update of completed on public.workout_logs for each row execute function analytics_private.action_conversion();
create trigger analytics_recovery_success after insert on public.recovery_activity_logs for each row execute function analytics_private.action_conversion();
create trigger analytics_meal_success after insert or update of entry_state on public.meal_entries for each row execute function analytics_private.action_conversion();
create trigger analytics_macro_success after insert on public.macro_entries for each row execute function analytics_private.action_conversion();

create function analytics_private.billing_conversion()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_owner uuid;v_old jsonb:=case when tg_op='UPDATE' then to_jsonb(old) else '{}'::jsonb end;v_new jsonb:=to_jsonb(new);v_subscription text:=v_new->>'stripe_subscription_id';v_tier text:=v_new->>'membership_program';v_event text;v_key text;
begin
  select auth_user_id into v_owner from public.clients where client_id=v_new->>'client_id';
  if v_owner is null or nullif(v_subscription,'') is null then return new; end if;
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
revoke execute on function analytics_private.billing_conversion() from public,anon,authenticated;
create trigger analytics_billing_success after insert or update on public.client_billing for each row execute function analytics_private.billing_conversion();

create function analytics_private.purchase_binding_conversion()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_billing public.client_billing%rowtype;
begin
  if new.auth_user_id is not null and old.auth_user_id is null then
    select * into v_billing from public.client_billing where client_id=new.client_id;
    if found and v_billing.access_active and v_billing.membership_program in ('tracker','ember','ignite','phoenix') and nullif(v_billing.stripe_subscription_id,'') is not null then
      perform analytics_private.record_conversion(new.auth_user_id,'subscription_activated',v_billing.stripe_subscription_id,jsonb_build_object('tier',v_billing.membership_program));
    end if;
  end if;
  return new;
end $$;
revoke execute on function analytics_private.purchase_binding_conversion() from public,anon,authenticated;
create trigger analytics_purchase_binding after update of auth_user_id on public.clients for each row execute function analytics_private.purchase_binding_conversion();

create function public.claim_analytics_conversions(p_user_id uuid default null,p_limit integer default 10)
returns setof public.analytics_conversion_receipts language plpgsql security invoker set search_path=public,pg_temp as $$
declare v_token uuid:=gen_random_uuid();
begin
  return query update public.analytics_conversion_receipts r set claim_token=v_token,claim_until=now()+interval '5 minutes',attempts=attempts+1
    where r.id in (select q.id from public.analytics_conversion_receipts q join public.analytics_member_consent c on c.user_id=q.user_id and c.accepted
      where q.eligible and q.delivered_at is null and (p_user_id is null or q.user_id=p_user_id) and (q.claim_until is null or q.claim_until<now())
      order by q.occurred_at limit greatest(1,least(coalesce(p_limit,10),25)) for update of q skip locked)
    returning r.*;
end $$;
create function public.ack_analytics_conversions(p_ids uuid[],p_token uuid)
returns void language sql security invoker set search_path=public,pg_temp as $$
  update public.analytics_conversion_receipts set delivered_at=now(),claim_until=null where id=any(p_ids) and claim_token=p_token and eligible;
$$;
revoke execute on function public.claim_analytics_conversions(uuid,integer),public.ack_analytics_conversions(uuid[],uuid) from public,anon,authenticated;
grant execute on function public.claim_analytics_conversions(uuid,integer),public.ack_analytics_conversions(uuid[],uuid) to service_role;
