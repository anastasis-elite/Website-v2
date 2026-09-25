-- Security hardening follow-up for exposed public schema and storage.
-- Safe to apply repeatedly; no user data is deleted.

revoke execute on function public.prevent_compliance_record_mutation() from public, anon, authenticated;

create or replace function public.prevent_compliance_record_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Compliance records are immutable';
end;
$$;

alter table if exists public.assessments enable row level security;
alter table if exists public.nutrition_logs enable row level security;
alter table if exists public.program_outputs enable row level security;
alter table if exists public.workout_logs enable row level security;
alter table if exists public.measurement_logs enable row level security;
alter table if exists public.meal_entries enable row level security;
alter table if exists public.education_lessons enable row level security;
alter table if exists public.client_lesson_progress enable row level security;

alter table if exists public.assessments force row level security;
alter table if exists public.nutrition_logs force row level security;
alter table if exists public.program_outputs force row level security;
alter table if exists public.workout_logs force row level security;
alter table if exists public.measurement_logs force row level security;
alter table if exists public.meal_entries force row level security;
alter table if exists public.education_lessons force row level security;
alter table if exists public.client_lesson_progress force row level security;
alter table if exists public.legal_acceptances force row level security;
alter table if exists public.feature_consent_events force row level security;
alter table if exists public.recommendation_audit_logs force row level security;
alter table if exists public.assessment_photos force row level security;
alter table if exists public.posture_photo_landmarks force row level security;
alter table if exists public.body_assessment_sessions force row level security;
alter table if exists public.body_assessment_measurements force row level security;
alter table if exists public.body_assessment_regional_results force row level security;
alter table if exists public.body_assessment_composition_results force row level security;

update storage.buckets
set public = false
where id = 'assessment_photos';

alter view if exists public.nutrition_log_totals set (security_invoker = true);
alter view if exists public.nutrition_log_totals_by_block set (security_invoker = true);
alter view if exists public.nutrition_log_remaining set (security_invoker = true);

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'meal_entries'
      and policyname = 'clients read own meal entries'
  ) then
    create policy "clients read own meal entries"
      on public.meal_entries
      for select
      to authenticated
      using (
        exists (
          select 1 from public.nutrition_logs nl
          where nl.id = meal_entries.nutrition_log_id
            and nl.auth_user_id = (select auth.uid())
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'meal_entries'
      and policyname = 'clients insert own meal entries'
  ) then
    create policy "clients insert own meal entries"
      on public.meal_entries
      for insert
      to authenticated
      with check (
        exists (
          select 1 from public.nutrition_logs nl
          where nl.id = meal_entries.nutrition_log_id
            and nl.auth_user_id = (select auth.uid())
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'meal_entries'
      and policyname = 'clients update own meal entries'
  ) then
    create policy "clients update own meal entries"
      on public.meal_entries
      for update
      to authenticated
      using (
        exists (
          select 1 from public.nutrition_logs nl
          where nl.id = meal_entries.nutrition_log_id
            and nl.auth_user_id = (select auth.uid())
        )
      )
      with check (
        exists (
          select 1 from public.nutrition_logs nl
          where nl.id = meal_entries.nutrition_log_id
            and nl.auth_user_id = (select auth.uid())
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'meal_entries'
      and policyname = 'clients delete own meal entries'
  ) then
    create policy "clients delete own meal entries"
      on public.meal_entries
      for delete
      to authenticated
      using (
        exists (
          select 1 from public.nutrition_logs nl
          where nl.id = meal_entries.nutrition_log_id
            and nl.auth_user_id = (select auth.uid())
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'measurement_logs'
      and policyname = 'clients read own measurements'
  ) then
    create policy "clients read own measurements"
      on public.measurement_logs
      for select
      to authenticated
      using ((select auth.uid()) = auth_user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'measurement_logs'
      and policyname = 'clients insert own measurements'
  ) then
    create policy "clients insert own measurements"
      on public.measurement_logs
      for insert
      to authenticated
      with check ((select auth.uid()) = auth_user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'measurement_logs'
      and policyname = 'clients update own measurements'
  ) then
    create policy "clients update own measurements"
      on public.measurement_logs
      for update
      to authenticated
      using ((select auth.uid()) = auth_user_id)
      with check ((select auth.uid()) = auth_user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'clients update own assessment photos'
  ) then
    create policy "clients update own assessment photos"
      on storage.objects
      for update
      to authenticated
      using (
        bucket_id = 'assessment_photos'
        and exists (
          select 1 from public.clients c
          where c.client_id = (storage.foldername(name))[1]
            and c.auth_user_id = (select auth.uid())
        )
      )
      with check (
        bucket_id = 'assessment_photos'
        and exists (
          select 1 from public.clients c
          where c.client_id = (storage.foldername(name))[1]
            and c.auth_user_id = (select auth.uid())
        )
      );
  end if;
end $$;
