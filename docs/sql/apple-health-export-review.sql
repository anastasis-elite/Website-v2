-- PREPARED ONLY: register a native migration version before any approved apply.
-- Separate storage is deliberate: file exports never enter health_samples,
-- daily_health_metrics, native integrations/cursors, guidance, recovery or streaks.
begin;
do $dependency$ begin
 if to_regclass('public.clients') is null or to_regclass('auth.users') is null
   or to_regprocedure('public.member_has_capability(text,text)') is null then
  raise exception 'Canonical membership capability foundation is required' using errcode='55000';
 end if;
end $dependency$;

-- This schema must remain unexposed in PostgREST/Data API configuration. Only
-- the checked public invoker operations below access these receipt rows.
create schema health_export_private;
revoke all on schema health_export_private from public,anon,authenticated;
grant usage on schema health_export_private to authenticated,service_role;
create table health_export_private.review_batches (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 client_id text not null references public.clients(client_id) on delete cascade,
 batch_key text not null check(batch_key~'^[0-9a-f]{64}$'),
 selected_date date not null,
 selected_timezone text not null check(length(selected_timezone) between 1 and 100),
 input_count integer not null check(input_count between 1 and 100),
 imported_count integer not null check(imported_count>=0),
 already_present_count integer not null check(already_present_count>=0),
 confirmed_at timestamptz not null default clock_timestamp(),
 check(imported_count+already_present_count=input_count),
 unique(user_id,batch_key)
);
create index health_export_review_batch_day_idx on health_export_private.review_batches(user_id,client_id,selected_date,selected_timezone,confirmed_at desc);
alter table health_export_private.review_batches enable row level security;
revoke all on health_export_private.review_batches from public,anon,authenticated;
grant select,insert on health_export_private.review_batches to authenticated;
grant all on health_export_private.review_batches to service_role;
create policy "members read own export confirmations" on health_export_private.review_batches for select to authenticated
 using(user_id=(select auth.uid()) and exists(select 1 from public.clients c where c.client_id=review_batches.client_id and c.auth_user_id=(select auth.uid())) and public.member_has_capability(client_id,'healthRecords'));
create policy "members insert own export confirmations" on health_export_private.review_batches for insert to authenticated
 with check(user_id=(select auth.uid()) and exists(select 1 from public.clients c where c.client_id=review_batches.client_id and c.auth_user_id=(select auth.uid())) and public.member_has_capability(client_id,'healthRecords'));

create function health_export_private.guard_review_batch()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op<>'INSERT' then raise exception 'Export confirmations are immutable' using errcode='42501'; end if;
 if current_user in ('authenticated','anon') and (auth.uid() is null or new.user_id is distinct from auth.uid()
   or not exists(select 1 from public.clients c where c.client_id=new.client_id and c.auth_user_id=auth.uid())
   or public.member_has_capability(new.client_id,'healthRecords') is distinct from true) then
  raise exception 'Owned health-record capability is required' using errcode='42501';
 end if;
 if not exists(select 1 from pg_catalog.pg_timezone_names z where z.name=new.selected_timezone) then
  raise exception 'Invalid confirmation timezone' using errcode='22023';
 end if;
 new.confirmed_at:=clock_timestamp();
 return new;
end $$;
revoke all on function health_export_private.guard_review_batch() from public,anon,authenticated;
create trigger health_export_review_batch_immutable before insert or update on health_export_private.review_batches
 for each row execute function health_export_private.guard_review_batch();

create table public.health_export_review_samples (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 client_id text not null references public.clients(client_id) on delete cascade,
 provider text not null default 'apple_health_export' check(provider='apple_health_export'),
 provenance text not null default 'Apple Health export; user imported' check(provenance='Apple Health export; user imported'),
 review_only boolean not null default true check(review_only),
 metric_type text not null check(metric_type in ('heart_rate','resting_heart_rate')),
 value numeric not null check(value>0 and value<=9007199254740991 and value<>'NaN'::numeric),
 unit text not null check(unit='count/min'),
 start_at timestamptz not null check(isfinite(start_at)),
 end_at timestamptz not null check(isfinite(end_at) and end_at>=start_at),
 creation_at timestamptz check(creation_at is null or isfinite(creation_at)),
 source_name text not null check(length(source_name) between 1 and 200 and btrim(source_name)<>'' and source_name!~'[[:cntrl:]]'),
 source_version text not null default '' check(length(source_version)<=100 and source_version!~'[[:cntrl:]]'),
 source_device text not null default '' check(length(source_device)<=1000 and source_device!~'[[:cntrl:]]'),
 selected_date date not null,
 selected_timezone text not null check(length(selected_timezone) between 1 and 100),
 dedupe_key text not null check(dedupe_key~'^[0-9a-f]{64}$'),
 imported_at timestamptz not null default clock_timestamp(),
 unique(user_id,dedupe_key)
);
create index health_export_review_owner_start_idx on public.health_export_review_samples(user_id,client_id,start_at,id);
alter table public.health_export_review_samples enable row level security;
revoke all on public.health_export_review_samples from public,anon,authenticated;
grant select,insert on public.health_export_review_samples to authenticated;
grant all on public.health_export_review_samples to service_role;
create policy "members read own review-only exports" on public.health_export_review_samples for select to authenticated
 using(user_id=(select auth.uid()) and exists(select 1 from public.clients c where c.client_id=health_export_review_samples.client_id and c.auth_user_id=(select auth.uid())) and public.member_has_capability(client_id,'healthRecords'));
create policy "members insert own review-only exports" on public.health_export_review_samples for insert to authenticated
 with check(user_id=(select auth.uid()) and exists(select 1 from public.clients c where c.client_id=health_export_review_samples.client_id and c.auth_user_id=(select auth.uid())) and public.member_has_capability(client_id,'healthRecords'));

create function public.guard_health_export_review_sample()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op<>'INSERT' then raise exception 'Imported review records are append-only' using errcode='42501'; end if;
 if current_user in ('authenticated','anon') and (auth.uid() is null or new.user_id is distinct from auth.uid()
   or not exists(select 1 from public.clients c where c.client_id=new.client_id and c.auth_user_id=auth.uid())
   or public.member_has_capability(new.client_id,'healthRecords') is distinct from true) then
  raise exception 'Owned health-record capability is required' using errcode='42501';
 end if;
 if new.provider is distinct from 'apple_health_export' or new.provenance is distinct from 'Apple Health export; user imported'
   or new.review_only is distinct from true or new.dedupe_key is not null then
  raise exception 'Export provenance and identity are server-derived' using errcode='22023';
 end if;
 if not exists(select 1 from pg_catalog.pg_timezone_names z where z.name=new.selected_timezone)
   or (new.start_at at time zone new.selected_timezone)::date is distinct from new.selected_date then
  raise exception 'Export record does not match the selected local day' using errcode='22023';
 end if;
 -- Epoch instants and trim_scale numeric values are independent of session
 -- timezone, input formatting, import date, filename and selected preview zone.
 new.dedupe_key:=encode(sha256(convert_to(jsonb_build_array('apple-health-export-v1',new.metric_type,
   trim_scale(new.value)::text,trim_scale(extract(epoch from new.start_at))::text,
   trim_scale(extract(epoch from new.end_at))::text,
   case when new.creation_at is null then null else trim_scale(extract(epoch from new.creation_at))::text end,
   new.source_name,new.source_version,new.source_device)::text,'UTF8')),'hex');
 new.imported_at:=clock_timestamp();
 return new;
end $$;
revoke all on function public.guard_health_export_review_sample() from public,anon,authenticated;
create trigger health_export_review_identity before insert or update on public.health_export_review_samples
 for each row execute function public.guard_health_export_review_sample();

create function public.import_health_export_review_batch(p_client_id text,p_date date,p_timezone text,p_records jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare owner_id uuid:=(select auth.uid()); inserted_count integer; input_count integer; record jsonb;
 batch_identity text; saved_batch health_export_private.review_batches%rowtype; replayed boolean;
begin
 if owner_id is null or not exists(select 1 from public.clients c where c.client_id=p_client_id and c.auth_user_id=owner_id)
   or public.member_has_capability(p_client_id,'healthRecords') is distinct from true then
  raise exception 'Owned health-record capability is required' using errcode='42501';
 end if;
 if p_date is null or p_timezone is null or not exists(select 1 from pg_catalog.pg_timezone_names z where z.name=p_timezone)
   or p_records is null or jsonb_typeof(p_records)<>'array' or octet_length(p_records::text)>131072 then
  raise exception 'Invalid export batch' using errcode='22023';
 end if;
 input_count:=jsonb_array_length(p_records);
 if input_count not between 1 and 100 then raise exception 'Invalid export batch size' using errcode='22023'; end if;
 for record in select * from jsonb_array_elements(p_records) loop
  if jsonb_typeof(record)<>'object' or (select count(*) from jsonb_object_keys(record))<>9
    or exists(select 1 from jsonb_object_keys(record) k where k not in ('metric','value','unit','startAt','endAt','creationAt','sourceName','sourceVersion','sourceDevice'))
    or jsonb_typeof(record->'value')<>'number'
    or exists(select 1 from jsonb_each(record) a where a.key<>'value' and a.key<>'creationAt' and jsonb_typeof(a.value)<>'string')
    or jsonb_typeof(record->'creationAt') not in ('string','null')
    or (record->>'startAt')!~'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$'
    or (record->>'endAt')!~'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$'
    or (record->>'creationAt' is not null and (record->>'creationAt')!~'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$') then
   raise exception 'Invalid normalized export record' using errcode='22023';
  end if;
 end loop;
 -- Bounded ordered source identities define the batch. No filename, caller job
 -- identifier, raw record JSON or health answers are persisted in confirmations.
 select encode(sha256(convert_to(jsonb_build_array('apple-health-export-batch-v1',to_char(p_date,'YYYY-MM-DD'),p_timezone,
   jsonb_agg(encode(sha256(convert_to(jsonb_build_array('apple-health-export-v1',r->>'metric',
     trim_scale((r->>'value')::numeric)::text,trim_scale(extract(epoch from (r->>'startAt')::timestamptz))::text,
     trim_scale(extract(epoch from (r->>'endAt')::timestamptz))::text,
     case when r->>'creationAt' is null then null else trim_scale(extract(epoch from (r->>'creationAt')::timestamptz))::text end,
     r->>'sourceName',r->>'sourceVersion',r->>'sourceDevice')::text,'UTF8')),'hex') order by position))::text,'UTF8')),'hex')
 into batch_identity from jsonb_array_elements(p_records) with ordinality as elements(r,position);
 perform pg_advisory_xact_lock(hashtextextended(owner_id::text||':'||batch_identity,0));
 select * into saved_batch from health_export_private.review_batches where user_id=owner_id and batch_key=batch_identity;
 replayed:=found;
 with inserted as (
  insert into public.health_export_review_samples(user_id,client_id,metric_type,value,unit,start_at,end_at,creation_at,source_name,source_version,source_device,selected_date,selected_timezone)
   select owner_id,p_client_id,r->>'metric',(r->>'value')::numeric,r->>'unit',(r->>'startAt')::timestamptz,(r->>'endAt')::timestamptz,
    (r->>'creationAt')::timestamptz,r->>'sourceName',r->>'sourceVersion',r->>'sourceDevice',p_date,p_timezone
   from jsonb_array_elements(p_records) r on conflict(user_id,dedupe_key) do nothing returning id
 ) select count(*)::integer into inserted_count from inserted;
 if not replayed then
  insert into health_export_private.review_batches(user_id,client_id,batch_key,selected_date,selected_timezone,input_count,imported_count,already_present_count)
   values(owner_id,p_client_id,batch_identity,p_date,p_timezone,input_count,inserted_count,input_count-inserted_count) returning * into saved_batch;
 end if;
 return jsonb_build_object('imported',inserted_count,'alreadyPresent',input_count-inserted_count,'replayed',replayed,
   'receipt',jsonb_build_object('id',saved_batch.id,'date',to_char(saved_batch.selected_date,'YYYY-MM-DD'),'timezone',saved_batch.selected_timezone,
     'inputCount',saved_batch.input_count,'imported',saved_batch.imported_count,'alreadyPresent',saved_batch.already_present_count,'confirmedAt',saved_batch.confirmed_at));
end $$;
revoke all on function public.import_health_export_review_batch(text,date,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.import_health_export_review_batch(text,date,text,jsonb) to authenticated;

create function public.get_health_export_review_day(p_client_id text,p_date date,p_timezone text,p_offset integer default 0)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare owner_id uuid:=(select auth.uid()); result jsonb;
begin
 if owner_id is null or not exists(select 1 from public.clients c where c.client_id=p_client_id and c.auth_user_id=owner_id)
   or public.member_has_capability(p_client_id,'healthRecords') is distinct from true then
  raise exception 'Owned health-record capability is required' using errcode='42501';
 end if;
 if p_date is null or p_timezone is null or not exists(select 1 from pg_catalog.pg_timezone_names z where z.name=p_timezone)
   or p_offset is null or p_offset not between 0 and 1000000 then raise exception 'Invalid export review day' using errcode='22023'; end if;
 with day_rows as (
  -- Local calendar membership includes both occurrences of a repeated
  -- midnight; PostgreSQL's ambiguous timestamp conversion chooses only one.
  select * from public.health_export_review_samples where user_id=owner_id and client_id=p_client_id
    and (start_at at time zone p_timezone)::date=p_date
 ), page as (select * from day_rows order by start_at,id offset p_offset limit 100)
 select jsonb_build_object('total',(select count(*)::integer from day_rows),
  'counts',jsonb_build_object('heart_rate',(select count(*)::integer from day_rows where metric_type='heart_rate'),'resting_heart_rate',(select count(*)::integer from day_rows where metric_type='resting_heart_rate')),
  'range',(select case when count(*)=0 then null else jsonb_build_object('startAt',min(start_at),'endAt',max(end_at)) end from day_rows),
  'receipts',coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'date',to_char(b.selected_date,'YYYY-MM-DD'),'timezone',b.selected_timezone,
    'inputCount',b.input_count,'imported',b.imported_count,'alreadyPresent',b.already_present_count,'confirmedAt',b.confirmed_at) order by b.confirmed_at desc,b.id)
    from (select * from health_export_private.review_batches where user_id=owner_id and client_id=p_client_id and selected_date=p_date and selected_timezone=p_timezone order by confirmed_at desc,id limit 10) b),'[]'::jsonb),
  'records',coalesce((select jsonb_agg(jsonb_build_object('metric',metric_type,'value',value,'unit',unit,
    'startAt',to_char(start_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'endAt',to_char(end_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'creationAt',case when creation_at is null then null else to_char(creation_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end,
    'sourceName',source_name,'sourceVersion',source_version,'sourceDevice',source_device,'importedAt',imported_at) order by start_at,id) from page),'[]'::jsonb)) into result;
 return result;
end $$;
revoke all on function public.get_health_export_review_day(text,date,text,integer) from public,anon,authenticated,service_role;
grant execute on function public.get_health_export_review_day(text,date,text,integer) to authenticated;
commit;
