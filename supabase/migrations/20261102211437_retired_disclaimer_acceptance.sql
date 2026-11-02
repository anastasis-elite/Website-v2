-- Compatibility prerequisite for retiring the separate recommendation disclaimer.
-- Apply this additive migration before the matching application change. The old
-- application can still insert its historical non-NULL version during cutover.
-- The new application explicitly inserts NULL, never an accepted-version sentinel.
-- No existing acceptance, consent, RLS policy, grant, index or trigger is rewritten.
begin;

do $$
begin
  if to_regclass('public.legal_acceptances') is null then
    raise exception 'Legal compliance foundation must exist before disclaimer retirement';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_attribute a
    where a.attrelid = 'public.legal_acceptances'::regclass
      and a.attname = 'ai_disclaimer_version' and not a.attisdropped
      and a.atttypid = 'pg_catalog.text'::regtype and not a.atthasdef
  ) then
    raise exception 'Expected historical disclaimer text column without a default';
  end if;
  if (
    select count(*) from pg_catalog.pg_attribute a
    where a.attrelid = 'public.legal_acceptances'::regclass
      and a.attname = any(array['terms_version','privacy_version','health_disclaimer_version'])
      and not a.attisdropped and a.attnotnull and a.atttypid = 'pg_catalog.text'::regtype
  ) <> 3 then
    raise exception 'Required Terms, Privacy and Health acceptance columns must remain non-null text';
  end if;
  if not exists (select 1 from pg_catalog.pg_class c where c.oid = 'public.legal_acceptances'::regclass and c.relrowsecurity)
    or not exists (select 1 from pg_catalog.pg_trigger t where t.tgrelid = 'public.legal_acceptances'::regclass
      and t.tgname = 'legal_acceptances_immutable' and not t.tgisinternal and t.tgenabled in ('O','A')) then
    raise exception 'Existing legal acceptance RLS and immutable-history guard are required';
  end if;
end $$;

alter table public.legal_acceptances alter column ai_disclaimer_version drop not null;

commit;

-- Rollback is conditional, not a data repair: SET NOT NULL is valid only while
-- no rows contain NULL in ai_disclaimer_version. Once new acceptances exist,
-- retain the compatible nullable schema and deploy a compatible application.
-- Never fill those rows with a fabricated version or delete acceptance history.
-- A separately reviewed reversal, only when the precondition is satisfied:
-- begin;
-- do $$ begin
--   if exists(select 1 from public.legal_acceptances where ai_disclaimer_version is null) then
--     raise exception 'Cannot restore retired disclaimer requirement without changing real consent history';
--   end if;
-- end $$;
-- alter table public.legal_acceptances alter column ai_disclaimer_version set not null;
-- commit;
