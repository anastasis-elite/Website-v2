-- REVIEW ONLY. Not applied to any local service, remote database or Storage.
-- This is a schema/policy proposal, not a migration-history entry. Generate a
-- migration with the installed Supabase CLI only after review and approval.
-- Provision the PRIVATE bucket through the Storage API; see the companion doc.
begin;

create schema if not exists community_private;
revoke all on schema community_private from public, anon;
grant usage on schema community_private to authenticated;

-- Invoker security deliberately retains existing clients ownership RLS. The
-- captured clients.subscription_ends_at column is DATE; interpret its midnight
-- in UTC, matching Date.parse(date) in lib/commerce/access.ts.
create or replace function community_private.has_member_access()
returns boolean language sql stable security invoker
set search_path = '' as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.clients c
    where c.auth_user_id = (select auth.uid())
      and lower(c.program) in ('ember','ignite','phoenix')
      and c.access is true and c.active is distinct from false
      and (c.subscription_ends_at is null
        or (c.subscription_ends_at::timestamp at time zone 'UTC') > now())
      and (c.verified_purchase is distinct from true
        or c.subscription_ends_at is not null)
  )
$$;
revoke all on function community_private.has_member_access() from public, anon;
grant execute on function community_private.has_member_access() to authenticated;

create table public.community_posts (
  id uuid primary key,
  -- RESTRICT prevents deleting an auth account from silently orphaning files.
  -- An operator must remove that author's Storage objects before deleting rows.
  author_id uuid not null references auth.users(id) on delete restrict,
  author_name text not null check (char_length(btrim(author_name)) between 1 and 120),
  category text not null check (category in ('Progress','Wins','Questions','Encouragement','Struggle','Transformation')),
  body text not null default '' check (char_length(body) <= 3000),
  status text not null default 'draft' check (status in ('draft','published','deleting')),
  media_path text unique,
  media_type text,
  media_mime text,
  media_size bigint,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  constraint community_post_publication check (status <> 'published' or published_at is not null),
  constraint community_post_deleted_content check (
    status <> 'deleting' or
    (body = '' and author_name = 'Community member' and category = 'Progress' and published_at is null)
  ),
  constraint community_post_attachment check (
    (media_path is null and media_type is null and media_mime is null and media_size is null
      and (status = 'deleting' or char_length(btrim(body)) > 0))
    or
    (media_path is not null and media_type is not null and media_mime is not null and media_size is not null
      and media_size > 0
      and ((media_type = 'image' and media_mime in ('image/jpeg','image/png','image/webp') and media_size <= 10485760)
        or (media_type = 'video' and media_mime in ('video/mp4','video/quicktime','video/webm') and media_size <= 52428800))
      and media_path = author_id::text || '/' || id::text || '/attachment.' ||
        case media_mime when 'image/jpeg' then 'jpg' when 'image/png' then 'png'
          when 'image/webp' then 'webp' when 'video/mp4' then 'mp4'
          when 'video/quicktime' then 'mov' when 'video/webm' then 'webm' else '' end)
  )
);
create index community_posts_feed on public.community_posts (published_at desc, id desc) where status = 'published';
create index community_posts_author_cleanup on public.community_posts (author_id, status, created_at);

alter table public.community_posts enable row level security;
revoke all on public.community_posts from public, anon, authenticated;
grant select on public.community_posts to authenticated;
grant all on public.community_posts to service_role;
create policy "community published audience or owned cleanup"
  on public.community_posts for select to authenticated using (
    (author_id = (select auth.uid()) and status in ('draft','deleting'))
    or (status = 'published' and (select community_private.has_member_access()))
  );
-- No browser lifecycle mutations. Trusted API handlers verify identity,
-- membership/ownership and actual uploaded bytes before publication.

create table public.community_reports (
  post_id uuid not null references public.community_posts(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (reason in ('spam','harassment','unsafe','other')),
  created_at timestamptz not null default now(),
  primary key (post_id, reporter_id)
);
create index community_reports_queue on public.community_reports (created_at, post_id);
create index community_reports_reporter on public.community_reports (reporter_id);
alter table public.community_reports enable row level security;
revoke all on public.community_reports from public, anon, authenticated;
grant all on public.community_reports to service_role;
-- Reports are accepted by the authenticated API, not a client-side word filter.
-- No reviewer queue, notifications or automatic takedown are installed here.

create or replace function community_private.can_read_media(object_name text)
returns boolean language sql stable security invoker set search_path = '' as $$
  select community_private.has_member_access() and exists (
    select 1 from public.community_posts p
    where p.media_path = object_name and
      (p.status = 'published' or (p.author_id = (select auth.uid()) and p.status = 'draft'))
  )
$$;
create or replace function community_private.can_upload_media(object_name text, object_metadata jsonb)
returns boolean language sql stable security invoker set search_path = '' as $$
  select community_private.has_member_access() and exists (
    select 1 from public.community_posts p
    where p.media_path = object_name and p.author_id = (select auth.uid()) and p.status = 'draft'
      -- Storage may run an INSERT authorization probe before metadata exists.
      -- Check fields when supplied; publish checks actual bytes and exact size.
      and (object_metadata->>'mimetype' is null or object_metadata->>'mimetype' = p.media_mime)
      and (object_metadata->>'size' is null or object_metadata->>'size' = p.media_size::text)
  )
$$;
revoke all on function community_private.can_read_media(text) from public, anon;
revoke all on function community_private.can_upload_media(text,jsonb) from public, anon;
grant execute on function community_private.can_read_media(text) to authenticated;
grant execute on function community_private.can_upload_media(text,jsonb) to authenticated;

-- RLS is already enabled by Storage. Do not mutate Storage objects/buckets via
-- SQL. The restrictive policies also intersect historical broad permissive
-- policies; the OR leaves every other bucket's authorization unchanged.
create policy "community media member read" on storage.objects
  for select to authenticated using (
    bucket_id = 'community-media' and community_private.can_read_media(name)
  );
create policy "community media read boundary" on storage.objects
  as restrictive for select to authenticated using (
    bucket_id <> 'community-media' or community_private.can_read_media(name)
  );
create policy "community media reserved draft upload" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'community-media' and community_private.can_upload_media(name,metadata)
  );
create policy "community media upload boundary" on storage.objects
  as restrictive for insert to authenticated with check (
    bucket_id <> 'community-media' or community_private.can_upload_media(name,metadata)
  );
create policy "community media no browser update" on storage.objects
  as restrictive for update to authenticated
  using (bucket_id <> 'community-media') with check (bucket_id <> 'community-media');
create policy "community media no browser delete" on storage.objects
  as restrictive for delete to authenticated using (bucket_id <> 'community-media');
create policy "community media no anonymous access" on storage.objects
  as restrictive for all to anon
  using (bucket_id <> 'community-media') with check (bucket_id <> 'community-media');

commit;
