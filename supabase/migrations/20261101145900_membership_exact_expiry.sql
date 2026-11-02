-- PREPARED ONLY. No backfill: a legacy DATE is not evidence of an exact instant.
begin;
alter table public.clients add column if not exists membership_expires_at timestamptz;
comment on column public.clients.membership_expires_at is 'Authoritative exact access expiry from a verified provider/server grant. Legacy subscription_ends_at remains a calendar DATE.';

-- Protect the new entitlement in the same transaction that introduces it.
-- Later capability migrations must not be required to close this write window.
create or replace function public.protect_exact_membership_expiry()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if current_user in ('anon','authenticated') then
   if (tg_op='INSERT' and new.membership_expires_at is not null)
      or (tg_op='UPDATE' and new.membership_expires_at is distinct from old.membership_expires_at) then
     raise exception 'Member entitlement expiry cannot be changed from the browser';
   end if;
 end if;
 return new;
end $$;
revoke all on function public.protect_exact_membership_expiry() from public,anon,authenticated;
create or replace trigger protect_exact_membership_expiry before insert or update on public.clients
for each row execute function public.protect_exact_membership_expiry();

create schema if not exists membership_private;
revoke all on schema membership_private from public,anon;
grant usage on schema membership_private to authenticated,service_role;

-- Pure expiry evaluation. Capability checks still require an authenticated,
-- verified owner and a canonical tier/access state before using this result.
create or replace function membership_private.expiry_is_current(p_client jsonb,p_now timestamptz default now())
returns boolean language plpgsql stable security invoker set search_path='' as $$
declare exact_end timestamptz; legacy_end text;
begin
 if p_client is null or p_now is null or not isfinite(p_now) then return false; end if;
 if nullif(p_client->>'membership_expires_at','') is not null then
   exact_end=(p_client->>'membership_expires_at')::timestamptz;
   return isfinite(exact_end) and exact_end>p_now;
 end if;
 legacy_end=nullif(p_client->>'subscription_ends_at','');
 if legacy_end is null then
   return coalesce((p_client->>'verified_purchase')::boolean,false) is false or lower(p_client->>'program')='free';
 end if;
 if legacy_end ~ '^\d{4}-\d{2}-\d{2}$' then
   -- Preserve the previous DATE-only UTC-midnight cutoff. No local-day
   -- extension, precise provider time, or historical backfill is inferred.
   return (legacy_end::date::timestamp at time zone 'UTC')>p_now;
 end if;
 -- Compatibility only for an already timestamp-valued legacy source; unlike
 -- a DATE this source has recorded precision that can be compared directly.
 exact_end=legacy_end::timestamptz;
 return isfinite(exact_end) and exact_end>p_now;
exception when invalid_datetime_format or datetime_field_overflow or invalid_text_representation then return false;
end $$;
revoke all on function membership_private.expiry_is_current(jsonb,timestamptz) from public,anon,authenticated,service_role;
grant execute on function membership_private.expiry_is_current(jsonb,timestamptz) to authenticated,service_role;
notify pgrst,'reload schema';
commit;
