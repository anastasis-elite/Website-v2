-- REVIEW ONLY. Apply only after the original community-posts-storage-review.sql
-- has been reviewed and installed through the approved migration workflow.
-- This file is not a migration-history entry and has not been run on a service.
-- No Auth accounts, billing/health records, buckets or Storage objects are deleted.
begin;

create table public.community_cleanup_holds (
  author_id uuid primary key references auth.users(id) on delete cascade,
  requested_by uuid not null,
  request_reference text not null check (char_length(btrim(request_reference)) between 1 and 200),
  started_at timestamptz not null default now()
);
alter table public.community_cleanup_holds enable row level security;
revoke all on public.community_cleanup_holds from public, anon, authenticated;
grant all on public.community_cleanup_holds to service_role;
-- Only the existing authenticated operator API can create these via its server
-- client. There is no member policy and this proposal grants no operator role.

alter table public.community_posts
  add column cleanup_marked_at timestamptz,
  add column media_cleaned_at timestamptz,
  -- Existing rows receive a fresh grace interval during installation. Only the
  -- trusted reservation API renews a draft's lease before returning upload data.
  add column upload_active_until timestamptz default (now() + interval '15 minutes'),
  add constraint community_post_cleanup_state check (
    (status = 'deleting' or (cleanup_marked_at is null and media_cleaned_at is null))
    and (media_cleaned_at is null or cleanup_marked_at is not null)
  );
create index community_posts_abandoned_cleanup
  on public.community_posts (status, created_at, id) where status in ('draft','deleting');

-- These two trigger functions are private, have no direct browser EXECUTE,
-- and perform only the guard/stamp operations below. SECURITY DEFINER is needed
-- to read the deliberately non-member-readable holds table. Their callers are
-- constrained by the existing table privileges; they do not accept user IDs as
-- public RPC input or grant member lifecycle mutation access.
create function community_private.guard_cleanup_hold()
returns trigger language plpgsql volatile security definer set search_path = '' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.author_id::text, 0));
  if tg_op = 'UPDATE' and new is distinct from old then
    raise exception using errcode = '23514', message = 'Community cleanup holds are immutable.';
  end if;
  return new;
end
$$;
revoke all on function community_private.guard_cleanup_hold() from public, anon, authenticated;
create trigger community_cleanup_hold_guard
  before insert or update on public.community_cleanup_holds
  for each row execute function community_private.guard_cleanup_hold();

create function community_private.guard_post_cleanup()
returns trigger language plpgsql volatile security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.author_id <> old.author_id then
    raise exception using errcode = '23514', message = 'A community post owner cannot change.';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.author_id::text, 0));
  if exists (select 1 from public.community_cleanup_holds h where h.author_id = new.author_id)
    and (tg_op = 'INSERT' or new.status <> 'deleting') then
    raise exception using errcode = '23514', message = 'Community cleanup is in progress for this author.';
  end if;
  if tg_op = 'UPDATE' and old.status = 'deleting' and new.status <> 'deleting' then
    raise exception using errcode = '23514', message = 'A deleted community post cannot be republished.';
  end if;
  if new.status = 'deleting' then
    new.upload_active_until := null;
    -- Starting the drain clock is a database transition, never a caller claim.
    if tg_op = 'INSERT' or old.status <> 'deleting' or old.cleanup_marked_at is null then
      new.cleanup_marked_at := pg_catalog.clock_timestamp();
      new.media_cleaned_at := null;
    else
      new.cleanup_marked_at := old.cleanup_marked_at;
    end if;
  else
    new.cleanup_marked_at := null;
    new.media_cleaned_at := null;
    if new.status <> 'draft' then
      new.upload_active_until := null;
    end if;
  end if;
  return new;
end
$$;
revoke all on function community_private.guard_post_cleanup() from public, anon, authenticated;
create trigger community_post_cleanup_guard
  before insert or update on public.community_posts
  for each row execute function community_private.guard_post_cleanup();

-- Tombstones created by the approved earlier package predate these columns.
-- Run them through the guard so installation starts a fresh, trusted drain
-- interval; their old created_at must never make them immediately removable.
update public.community_posts set status = status
  where status = 'deleting' and cleanup_marked_at is null;

-- The per-author transaction locks serialize server post reservation/publication
-- against creating a hold. At READ COMMITTED, the separate VOLATILE trigger
-- query checks committed holds after obtaining the lock. At stricter isolation,
-- conflicting transactions may need an application retry. This cannot cancel
-- bytes already in flight in Storage: retain tombstones and the hold, wait the
-- reviewed upload-drain interval, and re-list/remove exact owned objects through
-- Storage before row removal. Never delete directly from storage.objects.

create function community_private.current_author_held()
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.community_cleanup_holds h where h.author_id = (select auth.uid())
  )
$$;
revoke all on function community_private.current_author_held() from public, anon, authenticated;
grant execute on function community_private.current_author_held() to authenticated;

create or replace function community_private.can_upload_media(object_name text, object_metadata jsonb)
returns boolean language sql stable security invoker set search_path = '' as $$
  select community_private.has_member_access()
    and not (select community_private.current_author_held())
    and exists (
      select 1 from public.community_posts p
      where p.media_path = object_name and p.author_id = (select auth.uid()) and p.status = 'draft'
        and p.upload_active_until > now()
        and (object_metadata->>'mimetype' is null or object_metadata->>'mimetype' = p.media_mime)
        and (object_metadata->>'size' is null or object_metadata->>'size' = p.media_size::text)
    )
$$;
revoke all on function community_private.can_upload_media(text,jsonb) from public, anon;
grant execute on function community_private.can_upload_media(text,jsonb) to authenticated;

alter table public.community_reports
  add column status text not null default 'open',
  add column reviewed_at timestamptz,
  add column reviewed_by uuid,
  add column review_note text not null default '',
  add constraint community_report_review_status check (status in ('open','dismissed','removed')),
  add constraint community_report_review_note check (char_length(review_note) <= 500),
  add constraint community_report_review_metadata check (
    (status = 'open' and reviewed_at is null and reviewed_by is null and review_note = '')
    or (status in ('dismissed','removed') and reviewed_at is not null and reviewed_by is not null)
  );
create index community_reports_open_queue
  on public.community_reports (created_at, post_id, reporter_id) where status = 'open';
-- Existing report table RLS/grants remain: no ordinary member can list reports,
-- read reporters, or review. Resolution is an explicit existing-operator action.

-- Hold creation and new reports by that reporter share the same transaction
-- lock as posts. Once the hold commits, removing that author's own reports is
-- stable against an already-authenticated reporting request. Operator review
-- updates and scoped report removal remain available during cleanup.
create function community_private.guard_report_cleanup()
returns trigger language plpgsql volatile security definer set search_path = '' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.reporter_id::text, 0));
  if exists (select 1 from public.community_cleanup_holds h where h.author_id = new.reporter_id) then
    raise exception using errcode = '23514', message = 'Community cleanup is in progress for this reporter.';
  end if;
  return new;
end
$$;
revoke all on function community_private.guard_report_cleanup() from public, anon, authenticated;
create trigger community_report_cleanup_guard
  before insert on public.community_reports
  for each row execute function community_private.guard_report_cleanup();

commit;
