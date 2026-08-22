create extension if not exists pgcrypto;

insert into storage.buckets (id, name, public)
values ('assessment_photos', 'assessment_photos', false)
on conflict (id) do nothing;

create table if not exists public.assessment_photos (
  id uuid primary key default gen_random_uuid(),
  client_id text not null references public.clients(client_id) on delete cascade,
  auth_user_id uuid not null,
  assessment_type text not null default 'progress',
  front_photo_url text,
  back_photo_url text,
  left_photo_url text,
  right_photo_url text,
  analysis_status text not null default 'pending',
  analysis_type text,
  posture_flags jsonb not null default '{}'::jsonb,
  uploaded_at timestamptz not null default now()
);

alter table public.assessment_photos
  add column if not exists landmark_status text not null default 'not_started',
  add column if not exists landmark_metadata jsonb not null default '{}'::jsonb,
  add column if not exists posture_landmarks_confirmed_at timestamptz;

create index if not exists assessment_photos_client_uploaded_idx
  on public.assessment_photos(client_id, uploaded_at desc);

alter table public.assessment_photos enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'assessment_photos'
      and policyname = 'clients read own assessment photos'
  ) then
    create policy "clients read own assessment photos"
      on public.assessment_photos
      for select
      to authenticated
      using ((select auth.uid()) = auth_user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'assessment_photos'
      and policyname = 'clients insert own assessment photos'
  ) then
    create policy "clients insert own assessment photos"
      on public.assessment_photos
      for insert
      to authenticated
      with check (
        (select auth.uid()) = auth_user_id
        and exists (
          select 1 from public.clients c
          where c.client_id = assessment_photos.client_id
            and c.auth_user_id = (select auth.uid())
            and (
              assessment_photos.assessment_type <> 'posture'
              or lower(coalesce(c.program, 'ignite')) in ('ignite', 'phoenix')
            )
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'assessment_photos'
      and policyname = 'clients update own assessment photos'
  ) then
    create policy "clients update own assessment photos"
      on public.assessment_photos
      for update
      to authenticated
      using ((select auth.uid()) = auth_user_id)
      with check ((select auth.uid()) = auth_user_id);
  end if;
end $$;

create table if not exists public.posture_photo_landmarks (
  id uuid primary key default gen_random_uuid(),
  assessment_photo_id uuid not null references public.assessment_photos(id) on delete cascade,
  client_id text not null references public.clients(client_id) on delete cascade,
  auth_user_id uuid not null,
  assessment_view text not null check (assessment_view in ('front', 'back', 'left', 'right')),
  landmark_name text not null,
  anatomical_side text not null check (anatomical_side in ('left', 'right', 'center')),
  automatic_x numeric check (automatic_x is null or (automatic_x >= 0 and automatic_x <= 1)),
  automatic_y numeric check (automatic_y is null or (automatic_y >= 0 and automatic_y <= 1)),
  confirmed_x numeric check (confirmed_x is null or (confirmed_x >= 0 and confirmed_x <= 1)),
  confirmed_y numeric check (confirmed_y is null or (confirmed_y >= 0 and confirmed_y <= 1)),
  detection_confidence numeric check (detection_confidence is null or (detection_confidence >= 0 and detection_confidence <= 1)),
  manually_adjusted boolean not null default false,
  visible boolean not null default true,
  low_confidence boolean not null default false,
  image_width integer,
  image_height integer,
  detection_status text,
  detection_metadata jsonb not null default '{}'::jsonb,
  finalized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assessment_photo_id, assessment_view, landmark_name)
);

create index if not exists posture_photo_landmarks_client_photo_idx
  on public.posture_photo_landmarks(client_id, assessment_photo_id, assessment_view);

alter table public.posture_photo_landmarks enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'posture_photo_landmarks'
      and policyname = 'clients read own posture landmarks'
  ) then
    create policy "clients read own posture landmarks"
      on public.posture_photo_landmarks
      for select
      to authenticated
      using ((select auth.uid()) = auth_user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'posture_photo_landmarks'
      and policyname = 'clients insert own posture landmarks'
  ) then
    create policy "clients insert own posture landmarks"
      on public.posture_photo_landmarks
      for insert
      to authenticated
      with check (
        (select auth.uid()) = auth_user_id
        and exists (
          select 1 from public.assessment_photos ap
          join public.clients c on c.client_id = ap.client_id
          where ap.id = posture_photo_landmarks.assessment_photo_id
            and ap.auth_user_id = (select auth.uid())
            and ap.client_id = posture_photo_landmarks.client_id
            and lower(coalesce(c.program, 'ignite')) in ('ignite', 'phoenix')
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'posture_photo_landmarks'
      and policyname = 'clients update own posture landmarks'
  ) then
    create policy "clients update own posture landmarks"
      on public.posture_photo_landmarks
      for update
      to authenticated
      using ((select auth.uid()) = auth_user_id)
      with check (
        (select auth.uid()) = auth_user_id
        and exists (
          select 1 from public.clients c
          where c.client_id = posture_photo_landmarks.client_id
            and c.auth_user_id = (select auth.uid())
            and lower(coalesce(c.program, 'ignite')) in ('ignite', 'phoenix')
        )
      );
  end if;
end $$;

grant select, insert, update on public.assessment_photos to authenticated;
grant select, insert, update on public.posture_photo_landmarks to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'clients upload own assessment photos'
  ) then
    create policy "clients upload own assessment photos"
      on storage.objects
      for insert
      to authenticated
      with check (
        bucket_id = 'assessment_photos'
        and exists (
          select 1 from public.clients c
          where c.client_id = (storage.foldername(name))[1]
            and c.auth_user_id = (select auth.uid())
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'clients read own assessment photos'
  ) then
    create policy "clients read own assessment photos"
      on storage.objects
      for select
      to authenticated
      using (
        bucket_id = 'assessment_photos'
        and exists (
          select 1 from public.clients c
          where c.client_id = (storage.foldername(name))[1]
            and c.auth_user_id = (select auth.uid())
        )
      );
  end if;
end $$;
