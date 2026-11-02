-- PREPARED ONLY. Experience feedback is independent of billing and entitlement.
-- No legacy anchor backfill; only new verified paid recurring starts are armed.
begin;
create table public.membership_milestone_settings(singleton boolean primary key default true check(singleton),armed_at timestamptz not null default now());
insert into public.membership_milestone_settings(singleton) values(true);
create table public.membership_milestone_anchors(
 id uuid primary key default gen_random_uuid(),client_id text not null unique references public.clients(client_id),
 started_at timestamptz not null,subscription_id text not null,source_session_id text not null unique references public.checkout_purchases(session_id),
 owner_user_id uuid references auth.users(id),suppressed_at timestamptz,suppression_reason text,created_at timestamptz not null default now()
);
create table public.membership_milestones(
 id uuid primary key default gen_random_uuid(),anchor_id uuid not null references public.membership_milestone_anchors(id),
 months integer not null check(months in(6,12,24,60)),due_at timestamptz not null,reminder_due_at timestamptz not null,
 status text not null default 'scheduled' check(status in('scheduled','open','completed','suppressed')),
 completed_at timestamptz,created_at timestamptz not null default now(),unique(anchor_id,months)
);
create index membership_milestone_due_idx on public.membership_milestones(status,due_at,reminder_due_at);
create table public.membership_milestone_feedback(
 milestone_id uuid primary key references public.membership_milestones(id),user_id uuid not null references auth.users(id),
 request_id uuid not null,response jsonb not null,submitted_at timestamptz not null default now(),unique(user_id,request_id)
);
create table public.membership_milestone_reminders(
 milestone_id uuid primary key references public.membership_milestones(id),
 status text not null default 'pending' check(status in('pending','leased','sent','suppressed','manual_recovery')),
 next_attempt_at timestamptz not null default now(),lease_token uuid,lease_expires_at timestamptz,
 first_attempt_at timestamptz,attempts integer not null default 0,recipient_user_id uuid references auth.users(id),recipient_email text,sent_at timestamptz
);
create index membership_milestone_reminder_due_idx on public.membership_milestone_reminders(status,next_attempt_at);
alter table public.membership_milestone_settings enable row level security;
alter table public.membership_milestone_anchors enable row level security;
alter table public.membership_milestones enable row level security;
alter table public.membership_milestone_feedback enable row level security;
alter table public.membership_milestone_reminders enable row level security;
revoke all on public.membership_milestone_settings,public.membership_milestone_anchors,public.membership_milestones,public.membership_milestone_feedback,public.membership_milestone_reminders from public,anon,authenticated,service_role;
grant update on public.membership_milestone_anchors to service_role;
grant select on public.membership_milestone_settings,public.membership_milestone_anchors,public.membership_milestones,public.membership_milestone_feedback,public.membership_milestone_reminders to service_role;
grant select on public.membership_milestone_anchors,public.membership_milestones,public.membership_milestone_feedback to authenticated;
create policy milestone_anchor_owner on public.membership_milestone_anchors for select to authenticated using(owner_user_id=auth.uid());
create policy milestone_owner on public.membership_milestones for select to authenticated using(exists(select 1 from public.membership_milestone_anchors a where a.id=anchor_id and a.owner_user_id=auth.uid()));
create policy milestone_feedback_owner on public.membership_milestone_feedback for select to authenticated using(user_id=auth.uid());

create or replace function membership_private.milestone_zone(p_client jsonb)
returns text language plpgsql stable security invoker set search_path='' as $$
declare zone text; canonical_zone text; state_zone text; state_code text;
begin
 state_code=upper(coalesce(nullif(btrim(p_client->>'state'),''),nullif(btrim(p_client#>>'{onboarding_data,state}'),''),''));
 state_zone=case when state_code='AK' then 'America/Anchorage' when state_code='AZ' then 'America/Phoenix'
 when state_code='HI' then 'Pacific/Honolulu' when state_code='IN' then 'America/Indiana/Indianapolis'
 when state_code='ID' then 'America/Boise' when state_code='MI' then 'America/Detroit'
 when state_code in('CA','NV','OR','WA') then 'America/Los_Angeles' when state_code in('CO','MT','NM','UT','WY') then 'America/Denver'
 when state_code in('CT','DE','FL','GA','KY','MA','MD','ME','NC','NH','NJ','NY','OH','PA','RI','SC','VA','VT','WV') then 'America/New_York' else 'America/Chicago' end;
 zone=coalesce(nullif(p_client->>'timezone',''),nullif(p_client#>>'{onboarding_data,timezone}',''),state_zone);
 select name into canonical_zone from pg_catalog.pg_timezone_names where lower(name)=lower(zone) order by (name=zone) desc,name limit 1;
 return coalesce(canonical_zone,state_zone);
end $$;
create or replace function membership_private.milestone_times(p_started_at timestamptz,p_months integer,p_zone text)
returns table(due_at timestamptz,reminder_due_at timestamptz) language plpgsql stable security invoker set search_path='' as $$
begin
 if p_started_at is null or not isfinite(p_started_at) or p_months is null or p_months not in(6,12,24,60) or not exists(select 1 from pg_catalog.pg_timezone_names where name=p_zone) then raise exception 'Invalid milestone calendar'; end if;
 due_at=((p_started_at at time zone p_zone)+make_interval(months=>p_months)) at time zone p_zone;
 reminder_due_at=((due_at at time zone p_zone)+interval '3 days') at time zone p_zone;
 return next;
end $$;

create function membership_private.milestone_billing_eligible(p_anchor_id uuid)
returns boolean language sql security definer set search_path='' as $$
 select exists(select 1 from public.membership_milestone_anchors a join public.clients c on c.client_id=a.client_id
 join public.client_billing b on b.client_id=c.client_id where a.id=p_anchor_id and a.suppressed_at is null
 and lower(c.program) in('tracker','ember','ignite','phoenix') and c.verified_purchase is true and c.access is true and c.active is distinct from false
 and membership_private.expiry_is_current(to_jsonb(c),now()) is true
 and b.billing_type='subscription' and b.billing_status='active' and b.access_active is true
 and b.membership_program=c.program and b.stripe_price_id is not null and b.stripe_subscription_id=a.subscription_id
 and b.current_period_end>now() and b.subscription_sync_conflicted is false)
$$;
create function membership_private.milestone_recipient(p_anchor_id uuid)
returns jsonb language sql security definer set search_path='' as $$
 select jsonb_build_object('user_id',u.id,'email',lower(btrim(u.email)))
 from public.membership_milestone_anchors a join public.clients c on c.client_id=a.client_id
 join auth.users u on u.id=c.auth_user_id where a.id=p_anchor_id and a.owner_user_id=u.id
 and u.email_confirmed_at is not null and nullif(btrim(u.email),'') is not null
 and membership_private.milestone_billing_eligible(a.id)
$$;
create function membership_private.suppress_milestone_anchor(p_anchor_id uuid,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
begin
 update public.membership_milestone_anchors set suppressed_at=coalesce(suppressed_at,now()),suppression_reason=coalesce(suppression_reason,p_reason) where id=p_anchor_id;
 update public.membership_milestones set status='suppressed' where anchor_id=p_anchor_id and status in('scheduled','open');
 update public.membership_milestone_reminders r set status='suppressed',lease_token=null,lease_expires_at=null
 where r.status in('pending','leased') and exists(select 1 from public.membership_milestones m where m.id=r.milestone_id and m.anchor_id=p_anchor_id);
end $$;
create function membership_private.refresh_milestone_anchor(p_anchor_id uuid)
returns integer language plpgsql security definer set search_path='' as $$
declare a public.membership_milestone_anchors%rowtype;c public.clients%rowtype;z text;recipient jsonb;queued integer=0;n integer;
begin
 select * into a from public.membership_milestone_anchors where id=p_anchor_id for update;
 if not found or a.suppressed_at is not null then return 0; end if;
 select * into c from public.clients where client_id=a.client_id;
 if not found then perform membership_private.suppress_milestone_anchor(a.id,'client_missing');return 0;end if;
 if a.owner_user_id is not null and a.owner_user_id is distinct from c.auth_user_id then
  perform membership_private.suppress_milestone_anchor(a.id,'owner_changed');return 0;
 end if;
 if not membership_private.milestone_billing_eligible(a.id) then
  if exists(select 1 from public.client_billing b where b.client_id=a.client_id and b.billing_status in('canceled','incomplete_expired')) then
   perform membership_private.suppress_milestone_anchor(a.id,'membership_cancelled');
  else
   -- Reconciliation and recoverable payment/expiry holds pause future check-ins.
   -- A queued or leased reminder becomes stale permanently, but a later
   -- verified recovery must not erase/reset the original membership anchor.
   update public.membership_milestone_reminders r set status='suppressed',lease_token=null,lease_expires_at=null
   where r.status in('pending','leased') and exists(select 1 from public.membership_milestones m where m.id=r.milestone_id and m.anchor_id=a.id);
  end if;
  return 0;
 end if;
 if a.owner_user_id is null and exists(select 1 from auth.users u where u.id=c.auth_user_id and u.email_confirmed_at is not null) then
  update public.membership_milestone_anchors set owner_user_id=c.auth_user_id where id=a.id;a.owner_user_id=c.auth_user_id;
 end if;
 z=membership_private.milestone_zone(to_jsonb(c));
 -- Future anniversaries follow the current canonical member timezone; an open
 -- check-in retains its already-established due date and reminder boundary.
 update public.membership_milestones m set (due_at,reminder_due_at)=(select t.due_at,t.reminder_due_at from membership_private.milestone_times(a.started_at,m.months,z) t)
 where m.anchor_id=a.id and m.status='scheduled';
 recipient=membership_private.milestone_recipient(a.id);
 if recipient is null then
  update public.membership_milestones set status='suppressed' where anchor_id=a.id and status in('scheduled','open') and due_at<=now();
  update public.membership_milestone_reminders r set status='suppressed',lease_token=null,lease_expires_at=null
  where status in('pending','leased') and exists(select 1 from public.membership_milestones m where m.id=r.milestone_id and m.anchor_id=a.id and m.status='suppressed');
  return 0;
 end if;
 update public.membership_milestones set status='open' where anchor_id=a.id and status='scheduled' and due_at<=now();
 insert into public.membership_milestone_reminders(milestone_id)
 select id from public.membership_milestones where anchor_id=a.id and status='open' and reminder_due_at<=now()
 and not exists(select 1 from public.membership_milestone_feedback f where f.milestone_id=membership_milestones.id)
 on conflict(milestone_id) do nothing;
 get diagnostics n=row_count;queued=queued+n;return queued;
end $$;

create function membership_private.arm_membership_milestones(p_client_id text,p_purchase jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare start_at timestamptz;armed timestamptz;c public.clients%rowtype;anchor_id uuid;mo integer;z text;owner_id uuid;
begin
 select armed_at into armed from public.membership_milestone_settings where singleton;
 if p_purchase->>'billing_type' is distinct from 'subscription' or p_purchase->>'membership_paid' is distinct from 'true'
 or p_purchase->>'billing_status' is distinct from 'active' or p_purchase->>'access_active' is distinct from 'true'
 or coalesce(p_purchase->>'program','') not in('tracker','ember','ignite','phoenix') or nullif(p_purchase->>'subscription_id','') is null
 or nullif(p_purchase->>'membership_started_at','') is null then return;end if;
 start_at=(p_purchase->>'membership_started_at')::timestamptz;
 if not isfinite(start_at) or start_at<armed or (p_purchase->>'purchased_at')::timestamptz<armed then return;end if;
 select * into c from public.clients where client_id=p_client_id for update;
 if not found or exists(select 1 from public.membership_milestone_anchors where client_id=p_client_id) then return;end if;
 if exists(select 1 from auth.users u where u.id=c.auth_user_id and u.email_confirmed_at is not null) then owner_id=c.auth_user_id;end if;
 insert into public.membership_milestone_anchors(client_id,started_at,subscription_id,source_session_id,owner_user_id)
 values(p_client_id,start_at,p_purchase->>'subscription_id',p_purchase->>'session_id',owner_id) returning id into anchor_id;
 z=membership_private.milestone_zone(to_jsonb(c));
 foreach mo in array array[6,12,24,60] loop
  insert into public.membership_milestones(anchor_id,months,due_at,reminder_due_at)
  select anchor_id,mo,t.due_at,t.reminder_due_at from membership_private.milestone_times(start_at,mo,z) t;
 end loop;
end $$;
create function public.fulfill_checkout_purchase_v4(p_purchase jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
 result=public.fulfill_checkout_purchase(p_purchase);
 perform membership_private.arm_membership_milestones(result->>'client_id',p_purchase);
 return result;
end $$;
create function public.claim_checkout_purchase_v4(p_session_id text,p_user_id uuid,p_verified_email text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare pending_id text;target_id text;anchor_id uuid;result jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_session_id,0));
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));
 select client_id into pending_id from public.checkout_purchases where session_id=p_session_id for update;
 -- Match the base claim's purchase -> pending client -> target client order.
 -- Subscription sync also locks its client before the deferred anchor refresh.
 perform 1 from public.clients where client_id=pending_id for update;
 select client_id into target_id from public.clients where auth_user_id=p_user_id limit 1 for update;
 if target_id is not null and target_id is distinct from pending_id then
  select id into anchor_id from public.membership_milestone_anchors where client_id=pending_id for update;
  if anchor_id is not null then
   if exists(select 1 from public.membership_milestone_anchors where client_id=target_id) then
    perform membership_private.suppress_milestone_anchor(anchor_id,'canonical_anchor_already_exists');
   else
    -- The legacy claim validates verified receipt ownership below. Any failure
    -- rolls this transfer back; moving first avoids a transient pending-client
    -- deactivation being mistaken for a real cancellation.
    update public.membership_milestone_anchors set client_id=target_id,owner_user_id=p_user_id where id=anchor_id;
   end if;
  end if;
 end if;
 result=public.claim_checkout_purchase(p_session_id,p_user_id,p_verified_email);
 for anchor_id in select id from public.membership_milestone_anchors where client_id=result->>'client_id' loop
  perform membership_private.refresh_milestone_anchor(anchor_id);
 end loop;
 return result;
end $$;

create function membership_private.milestone_row(p_id uuid)
returns jsonb language sql security definer set search_path='' as $$
 select jsonb_build_object('id',m.id,'months',m.months,'due_at',m.due_at,'reminder_due_at',m.reminder_due_at,'status',m.status,
 'can_respond',m.status='open' and membership_private.milestone_recipient(m.anchor_id) is not null,
 'feedback',case when f.milestone_id is not null then jsonb_build_object('response',f.response,'submitted_at',f.submitted_at) else null end)
 from public.membership_milestones m left join public.membership_milestone_feedback f on f.milestone_id=m.id where m.id=p_id
$$;
create function membership_private.get_membership_milestones()
returns jsonb language plpgsql security definer set search_path='' as $$
declare aid uuid;eligible boolean=false;rows jsonb;
begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 for aid in select a.id from public.membership_milestone_anchors a join public.clients c on c.client_id=a.client_id
 where c.auth_user_id=auth.uid() and (a.owner_user_id is null or a.owner_user_id=auth.uid()) loop
  perform membership_private.refresh_milestone_anchor(aid);
  eligible=eligible or membership_private.milestone_recipient(aid) is not null;
 end loop;
 select coalesce(jsonb_agg(membership_private.milestone_row(m.id) order by m.due_at),'[]'::jsonb) into rows
 from public.membership_milestones m join public.membership_milestone_anchors a on a.id=m.anchor_id
 where a.owner_user_id=auth.uid();
 return jsonb_build_object('eligible',eligible,'milestones',rows);
end $$;
create function public.get_membership_milestones()
returns jsonb language sql security invoker set search_path='' as $$select membership_private.get_membership_milestones()$$;

create function membership_private.submit_membership_milestone_feedback(p_milestone_id uuid,p_request_id uuid,p_response jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare m public.membership_milestones%rowtype;a public.membership_milestone_anchors%rowtype;f public.membership_milestone_feedback%rowtype;
 normalized jsonb;comment_text text;key text;
begin
 if auth.uid() is null or p_milestone_id is null or p_request_id is null or jsonb_typeof(p_response) is distinct from 'object' then raise exception 'Invalid milestone response';end if;
 for key in select jsonb_object_keys(p_response) loop if key not in('rating','continuation','comment') then raise exception 'Invalid response field';end if;end loop;
 if jsonb_typeof(p_response->'rating') is distinct from 'number' or (p_response->>'rating')::numeric not between 1 and 5
 or (p_response->>'rating')::numeric<>floor((p_response->>'rating')::numeric)
 or coalesce(p_response->>'continuation','') not in('continue','unsure','do_not_continue') then raise exception 'Choose an experience rating and continuation answer';end if;
 normalized=jsonb_build_object('rating',(p_response->>'rating')::integer,'continuation',p_response->>'continuation');
 if p_response ? 'comment' then
  if jsonb_typeof(p_response->'comment') is distinct from 'string' then raise exception 'Invalid comment';end if;
  comment_text=btrim(p_response->>'comment');if length(comment_text)>2000 then raise exception 'Comment is too long';end if;
  normalized=normalized||jsonb_build_object('comment',comment_text);
 end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_request_id::text,0));
 select * into m from public.membership_milestones where id=p_milestone_id;
 select * into a from public.membership_milestone_anchors where id=m.anchor_id for update;
 select * into m from public.membership_milestones where id=p_milestone_id for update;
 if m.id is null or a.owner_user_id is distinct from auth.uid() then raise exception 'Owned milestone required';end if;
 select * into f from public.membership_milestone_feedback where user_id=auth.uid() and request_id=p_request_id;
 if found and (f.milestone_id<>m.id or f.response<>normalized) then raise exception 'Request identifier belongs to another response';end if;
 select * into f from public.membership_milestone_feedback where milestone_id=m.id;
 if found then
  if f.user_id<>auth.uid() or f.response<>normalized then raise exception 'This response has already been saved';end if;
  return membership_private.milestone_row(m.id);
 end if;
 perform membership_private.refresh_milestone_anchor(a.id);
 select * into m from public.membership_milestones where id=p_milestone_id;
 if m.status<>'open' or membership_private.milestone_recipient(a.id) is null then raise exception 'Milestone response is not currently available';end if;
 insert into public.membership_milestone_feedback(milestone_id,user_id,request_id,response) values(m.id,auth.uid(),p_request_id,normalized);
 update public.membership_milestones set status='completed',completed_at=now() where id=m.id;
 update public.membership_milestone_reminders set status='suppressed',lease_token=null,lease_expires_at=null where milestone_id=m.id and status in('pending','leased');
 return membership_private.milestone_row(m.id);
end $$;
create function public.submit_membership_milestone_feedback(p_milestone_id uuid,p_request_id uuid,p_response jsonb)
returns jsonb language sql security invoker set search_path='' as $$select membership_private.submit_membership_milestone_feedback(p_milestone_id,p_request_id,p_response)$$;

create function membership_private.refresh_membership_milestones(p_limit integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare aid uuid;refreshed integer=0;queued integer=0;
begin
 if p_limit is null or p_limit not between 1 and 100 then raise exception 'Invalid refresh limit';end if;
 for aid in select a.id from public.membership_milestone_anchors a where a.suppressed_at is null and membership_private.milestone_billing_eligible(a.id) and exists(
  select 1 from public.membership_milestones m where m.anchor_id=a.id and
  ((m.status='scheduled' and m.due_at<=now()) or (m.status='open' and m.reminder_due_at<=now() and not exists(select 1 from public.membership_milestone_reminders r where r.milestone_id=m.id))))
 order by a.started_at limit p_limit loop
  queued=queued+membership_private.refresh_milestone_anchor(aid);refreshed=refreshed+1;
 end loop;
 return jsonb_build_object('refreshed',refreshed,'queued',queued);
end $$;
create function public.refresh_membership_milestones(p_limit integer default 50)
returns jsonb language sql security invoker set search_path='' as $$select membership_private.refresh_membership_milestones(p_limit)$$;

create function membership_private.reminder_job(p_milestone_id uuid,p_lease_token uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.membership_milestone_reminders%rowtype;m public.membership_milestones%rowtype;recipient jsonb;
begin
 select * into m from public.membership_milestones where id=p_milestone_id;
 if not found then return null;end if;
 perform membership_private.refresh_milestone_anchor(m.anchor_id);
 select * into r from public.membership_milestone_reminders where milestone_id=p_milestone_id for update;
 if not found or r.status<>'leased' or r.lease_token is distinct from p_lease_token or r.lease_expires_at<=now() then return null;end if;
 select * into m from public.membership_milestones where id=p_milestone_id;
 perform membership_private.refresh_milestone_anchor(m.anchor_id);
 select * into r from public.membership_milestone_reminders where milestone_id=p_milestone_id;
 recipient=membership_private.milestone_recipient(m.anchor_id);
 if r.status<>'leased' or m.status<>'open' or recipient is null or recipient->>'user_id' is distinct from r.recipient_user_id::text then
  update public.membership_milestone_reminders set status='suppressed',lease_token=null,lease_expires_at=null where milestone_id=p_milestone_id and status in('pending','leased');return null;
 end if;
 if r.first_attempt_at<=now()-interval '23 hours' or recipient->>'email' is distinct from r.recipient_email then
  update public.membership_milestone_reminders set status='manual_recovery',lease_token=null,lease_expires_at=null where milestone_id=p_milestone_id;return null;
 end if;
 return jsonb_build_object('milestone_id',m.id,'lease_token',r.lease_token,'user_id',r.recipient_user_id,'email',r.recipient_email,'months',m.months,'due_at',m.due_at,'first_attempt_at',r.first_attempt_at);
end $$;
create function membership_private.claim_membership_milestone_reminder(p_milestone_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.membership_milestone_reminders%rowtype;m public.membership_milestones%rowtype;recipient jsonb;token uuid=gen_random_uuid();
begin
 select * into m from public.membership_milestones where id=p_milestone_id;
 if not found then return null;end if;
 perform membership_private.refresh_milestone_anchor(m.anchor_id);
 select * into r from public.membership_milestone_reminders where milestone_id=p_milestone_id for update;
 if not found or r.status not in('pending','leased') or r.next_attempt_at>now() or (r.status='leased' and r.lease_expires_at>now()) then return null;end if;
 select * into m from public.membership_milestones where id=p_milestone_id;
 perform membership_private.refresh_milestone_anchor(m.anchor_id);
 select * into r from public.membership_milestone_reminders where milestone_id=p_milestone_id;
 select * into m from public.membership_milestones where id=p_milestone_id;
 recipient=membership_private.milestone_recipient(m.anchor_id);
 if r.status not in('pending','leased') or m.status<>'open' or recipient is null then
  update public.membership_milestone_reminders set status='suppressed',lease_token=null,lease_expires_at=null where milestone_id=p_milestone_id and status in('pending','leased');return null;
 end if;
 if r.first_attempt_at is not null and (r.first_attempt_at<=now()-interval '23 hours' or r.recipient_user_id::text is distinct from recipient->>'user_id' or r.recipient_email is distinct from recipient->>'email') then
  update public.membership_milestone_reminders set status='manual_recovery',lease_token=null,lease_expires_at=null where milestone_id=p_milestone_id;return null;
 end if;
 update public.membership_milestone_reminders set status='leased',lease_token=token,lease_expires_at=now()+interval '2 minutes',first_attempt_at=coalesce(first_attempt_at,now()),
 attempts=attempts+1,recipient_user_id=(recipient->>'user_id')::uuid,recipient_email=recipient->>'email' where milestone_id=p_milestone_id;
 return membership_private.reminder_job(p_milestone_id,token);
end $$;
create function public.claim_membership_milestone_reminder(p_milestone_id uuid)
returns jsonb language sql security invoker set search_path='' as $$select membership_private.claim_membership_milestone_reminder(p_milestone_id)$$;
create function public.recheck_membership_milestone_reminder(p_milestone_id uuid,p_lease_token uuid)
returns jsonb language sql security invoker set search_path='' as $$select membership_private.reminder_job(p_milestone_id,p_lease_token)$$;
create function membership_private.finish_membership_milestone_reminder(p_milestone_id uuid,p_lease_token uuid,p_delivered boolean)
returns boolean language plpgsql security definer set search_path='' as $$
declare job jsonb;
begin
 if p_delivered is null then return false;end if;
 job=membership_private.reminder_job(p_milestone_id,p_lease_token);
 if job is null then return false;end if;
 update public.membership_milestone_reminders set status=case when p_delivered then 'sent' else 'pending' end,
 sent_at=case when p_delivered then now() else sent_at end,next_attempt_at=case when p_delivered then next_attempt_at else now()+interval '5 minutes' end,
 lease_token=null,lease_expires_at=null where milestone_id=p_milestone_id and lease_token=p_lease_token;
 return found;
end $$;
create function public.finish_membership_milestone_reminder(p_milestone_id uuid,p_lease_token uuid,p_delivered boolean)
returns boolean language sql security invoker set search_path='' as $$select membership_private.finish_membership_milestone_reminder(p_milestone_id,p_lease_token,p_delivered)$$;

-- Deferral observes the final atomic billing/client state, so an ordinary tier
-- upgrade cannot suppress milestones because of an intermediate row update.
create function membership_private.milestone_client_changed()
returns trigger language plpgsql security definer set search_path='' as $$
declare aid uuid;cid text;
begin
 cid=new.client_id;
 for aid in select id from public.membership_milestone_anchors where client_id=cid loop perform membership_private.refresh_milestone_anchor(aid);end loop;
 return new;
end $$;
create constraint trigger milestone_client_changed after insert or update on public.clients deferrable initially deferred for each row execute function membership_private.milestone_client_changed();
create constraint trigger milestone_billing_changed after insert or update on public.client_billing deferrable initially deferred for each row execute function membership_private.milestone_client_changed();

-- Seal helper access before publishing the wrapper contracts.
revoke all on function membership_private.milestone_zone(jsonb),membership_private.milestone_times(timestamptz,integer,text),membership_private.milestone_billing_eligible(uuid),membership_private.milestone_recipient(uuid),membership_private.suppress_milestone_anchor(uuid,text),membership_private.refresh_milestone_anchor(uuid),membership_private.arm_membership_milestones(text,jsonb),membership_private.milestone_row(uuid),membership_private.reminder_job(uuid,uuid),membership_private.milestone_client_changed(),membership_private.get_membership_milestones(),membership_private.submit_membership_milestone_feedback(uuid,uuid,jsonb),membership_private.refresh_membership_milestones(integer),membership_private.claim_membership_milestone_reminder(uuid),membership_private.finish_membership_milestone_reminder(uuid,uuid,boolean) from public,anon;
revoke all on function membership_private.milestone_zone(jsonb),membership_private.milestone_times(timestamptz,integer,text),membership_private.milestone_billing_eligible(uuid),membership_private.milestone_recipient(uuid),membership_private.suppress_milestone_anchor(uuid,text),membership_private.refresh_milestone_anchor(uuid),membership_private.arm_membership_milestones(text,jsonb),membership_private.milestone_row(uuid),membership_private.reminder_job(uuid,uuid),membership_private.milestone_client_changed() from authenticated,service_role;
grant execute on function membership_private.arm_membership_milestones(text,jsonb),membership_private.suppress_milestone_anchor(uuid,text),membership_private.refresh_milestone_anchor(uuid),membership_private.refresh_membership_milestones(integer),membership_private.claim_membership_milestone_reminder(uuid),membership_private.reminder_job(uuid,uuid),membership_private.finish_membership_milestone_reminder(uuid,uuid,boolean) to service_role;
grant execute on function membership_private.get_membership_milestones(),membership_private.submit_membership_milestone_feedback(uuid,uuid,jsonb) to authenticated;
revoke all on function public.fulfill_checkout_purchase_v4(jsonb),public.claim_checkout_purchase_v4(text,uuid,text),public.refresh_membership_milestones(integer),public.claim_membership_milestone_reminder(uuid),public.recheck_membership_milestone_reminder(uuid,uuid),public.finish_membership_milestone_reminder(uuid,uuid,boolean) from public,anon,authenticated,service_role;
grant execute on function public.fulfill_checkout_purchase_v4(jsonb),public.claim_checkout_purchase_v4(text,uuid,text),public.refresh_membership_milestones(integer),public.claim_membership_milestone_reminder(uuid),public.recheck_membership_milestone_reminder(uuid,uuid),public.finish_membership_milestone_reminder(uuid,uuid,boolean) to service_role;
revoke all on function public.get_membership_milestones(),public.submit_membership_milestone_feedback(uuid,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.get_membership_milestones(),public.submit_membership_milestone_feedback(uuid,uuid,jsonb) to authenticated;

-- Contract 3 retains its prior guarantees; contract 4 additionally requires
-- the atomic milestone arming and verified guest-claim wrappers.
create or replace function public.commerce_configuration_ready(p_contract_version integer)
returns boolean language sql stable security invoker set search_path=public,pg_temp as $$
  select p_contract_version in(3,4)
    and (p_contract_version=3 or (
      to_regprocedure('public.fulfill_checkout_purchase_v4(jsonb)') is not null
      and to_regprocedure('public.claim_checkout_purchase_v4(text,uuid,text)') is not null
      and has_function_privilege('service_role','public.fulfill_checkout_purchase_v4(jsonb)','EXECUTE')
      and has_function_privilege('service_role','public.claim_checkout_purchase_v4(text,uuid,text)','EXECUTE')
      and to_regclass('public.membership_milestones') is not null
    ))
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
