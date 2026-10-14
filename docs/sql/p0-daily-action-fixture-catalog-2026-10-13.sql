-- Read-only catalog export for disposable local rehearsals. No customer rows.
-- Capture the result as docs/p0-daily-action-production-fixture-metadata-2026-10-13.json.
select jsonb_build_object(
 'tables', (select coalesce(jsonb_agg(jsonb_build_object(
   'name',c.relname,'rls_enabled',c.relrowsecurity,'rls_forced',c.relforcerowsecurity,
   'columns',(select jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),
     'notnull',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid),'identity',a.attidentity,'generated',a.attgenerated,
     'acl',(select coalesce(jsonb_agg(jsonb_build_object('role',case when x.grantee=0 then 'PUBLIC' else pg_get_userbyid(x.grantee) end,
       'privilege',x.privilege_type,'grantable',x.is_grantable)),'[]'::jsonb) from aclexplode(a.attacl) x)) order by a.attnum) from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
     where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped),
   'constraints',(select coalesce(jsonb_agg(jsonb_build_object('name',k.conname,'definition',pg_get_constraintdef(k.oid),'type',k.contype)), '[]'::jsonb)
     from pg_constraint k where k.conrelid=c.oid),
   'acl',(select coalesce(jsonb_agg(jsonb_build_object('role',case when x.grantee=0 then 'PUBLIC' else pg_get_userbyid(x.grantee) end,
     'privilege',x.privilege_type,'grantable',x.is_grantable)),'[]'::jsonb) from aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) x)
 ) order by c.relname),'[]'::jsonb) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p')),
 'sequences',(select coalesce(jsonb_agg(jsonb_build_object('name',c.relname,'type',format_type(s.seqtypid,null),'start',s.seqstart,
   'increment',s.seqincrement,'min',s.seqmin,'max',s.seqmax,'cache',s.seqcache,'cycle',s.seqcycle,
   'owned_by',(select jsonb_build_object('table',r.relname,'column',a.attname,'dependency',d.deptype)
     from pg_depend d join pg_class r on r.oid=d.refobjid join pg_attribute a on a.attrelid=r.oid and a.attnum=d.refobjsubid
     where d.objid=c.oid and d.classid='pg_class'::regclass and d.refclassid='pg_class'::regclass and d.deptype in ('a','i') limit 1),
   'acl',(select coalesce(jsonb_agg(jsonb_build_object('role',case when x.grantee=0 then 'PUBLIC' else pg_get_userbyid(x.grantee) end,
     'privilege',x.privilege_type,'grantable',x.is_grantable)),'[]'::jsonb) from aclexplode(coalesce(c.relacl,acldefault('S',c.relowner))) x)
 )),'[]'::jsonb) from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_sequence s on s.seqrelid=c.oid where n.nspname='public'),
 'indexes',(select coalesce(jsonb_agg(jsonb_build_object('name',i.relname,'table',c.relname,'definition',pg_get_indexdef(i.oid))), '[]'::jsonb)
   from pg_index x join pg_class i on i.oid=x.indexrelid join pg_class c on c.oid=x.indrelid join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and not exists(select 1 from pg_constraint k where k.conindid=i.oid)),
 'policies',(select coalesce(jsonb_agg(to_jsonb(p)),'[]'::jsonb) from pg_policies p where p.schemaname='public'),
 'functions',(select coalesce(jsonb_agg(jsonb_build_object('name',p.proname,'identity_args',pg_get_function_identity_arguments(p.oid),
   'definition',pg_get_functiondef(p.oid),'acl',(select coalesce(jsonb_agg(jsonb_build_object('role',case when x.grantee=0 then 'PUBLIC' else pg_get_userbyid(x.grantee) end,
     'privilege',x.privilege_type,'grantable',x.is_grantable)),'[]'::jsonb) from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) x)
 )),'[]'::jsonb) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f'),
 'views',(select coalesce(jsonb_agg(jsonb_build_object('name',c.relname,'definition',pg_get_viewdef(c.oid),'options',c.reloptions,
   'acl',(select coalesce(jsonb_agg(jsonb_build_object('role',case when x.grantee=0 then 'PUBLIC' else pg_get_userbyid(x.grantee) end,
     'privilege',x.privilege_type,'grantable',x.is_grantable)),'[]'::jsonb) from aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) x)
 )),'[]'::jsonb) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='v'),
 'triggers',(select coalesce(jsonb_agg(jsonb_build_object('table',c.relname,'definition',pg_get_triggerdef(t.oid),'enabled',t.tgenabled)), '[]'::jsonb)
   from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not t.tgisinternal),
 'default_acl',(select coalesce(jsonb_agg(jsonb_build_object('owner',pg_get_userbyid(d.defaclrole),'schema',n.nspname,'type',d.defaclobjtype,
   'acl',(select jsonb_agg(jsonb_build_object('role',case when x.grantee=0 then 'PUBLIC' else pg_get_userbyid(x.grantee) end,
     'privilege',x.privilege_type,'grantable',x.is_grantable)) from aclexplode(d.defaclacl) x))), '[]'::jsonb)
   from pg_default_acl d left join pg_namespace n on n.oid=d.defaclnamespace where d.defaclnamespace=0 or n.nspname='public')
) as metadata;
