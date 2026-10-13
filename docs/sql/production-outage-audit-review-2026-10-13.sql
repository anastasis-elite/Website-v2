-- REVIEW ONLY. NOT EXECUTED. Requires explicit approval for production execution.
-- Target: Supabase lcccpqgnpznhbtmkmytp, verified 2026-10-13.
-- Existing self-owned INSERT RLS policy remains unchanged. Only INSERT is granted.
-- No SELECT/UPDATE/DELETE, anonymous access, service-role grant or RLS bypass.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $preflight$
declare audit_oid oid:=to_regclass('public.recommendation_audit_logs');
begin
  if audit_oid is null then raise exception 'Audit table is absent'; end if;
  if not exists (select 1 from pg_class where oid=audit_oid and relrowsecurity) then
    raise exception 'Audit RLS must already be enabled';
  end if;
  if not exists (
    select 1 from pg_policy p
    where p.polrelid=audit_oid and p.polpermissive and p.polcmd in ('a','*')
      and (0=any(p.polroles) or 'authenticated'::regrole::oid=any(p.polroles))
      and regexp_replace(pg_get_expr(p.polwithcheck,p.polrelid),'[[:space:]()]','','g')
        in ('auth.uid=user_id','user_id=auth.uid')
  ) then raise exception 'Expected self-owned audit INSERT policy is absent'; end if;
  if exists (
    select 1 from pg_policy p
    where p.polrelid=audit_oid and p.polpermissive and p.polcmd in ('a','*')
      and (0=any(p.polroles) or 'authenticated'::regrole::oid=any(p.polroles))
      and coalesce(regexp_replace(pg_get_expr(p.polwithcheck,p.polrelid),'[[:space:]()]','','g'),'')
        not in ('auth.uid=user_id','user_id=auth.uid')
  ) then raise exception 'Unexpected permissive audit INSERT policy: review before grant'; end if;
end
$preflight$;

grant insert on table public.recommendation_audit_logs to authenticated;
notify pgrst,'reload schema';
commit;
