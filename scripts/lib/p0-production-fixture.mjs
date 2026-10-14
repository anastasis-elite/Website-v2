// Schema-only production reconstruction in disposable PGlite; never connects remotely.
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'

export const fixtureMetadataPath = new URL('../../docs/p0-daily-action-production-fixture-metadata-2026-10-13.json', import.meta.url)
const q = value => '"' + String(value).replaceAll('"', '""') + '"'
const literal = value => "'" + String(value).replaceAll("'", "''") + "'"
const principals = acl => (acl || []).map(item => item.role).filter(role => role !== 'PUBLIC')

export async function setFixtureIdentity(db, role, userId = '', appMetadata = {}) {
  await db.exec('reset role')
  await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",
    [userId, JSON.stringify({ sub: userId || undefined, role, app_metadata: appMetadata })])
  await db.exec('set role ' + q(role))
}

export async function createProductionFixture(path = fixtureMetadataPath) {
  const captured = JSON.parse(readFileSync(path, 'utf8'))
  const metadata = captured.metadata || captured
  if (!Array.isArray(metadata.tables) || !Array.isArray(metadata.functions) || !Array.isArray(metadata.default_acl)) {
    throw new Error('Exact schema fixture export is required; run docs/sql/p0-daily-action-fixture-catalog-2026-10-13.sql read-only and save its metadata result.')
  }
  const db = new PGlite()
  const allAcls = [...metadata.tables, ...metadata.views, ...metadata.functions, ...metadata.sequences, ...metadata.default_acl]
  const policyRoles = metadata.policies.flatMap(p => Array.isArray(p.roles) ? p.roles : String(p.roles).replace(/[{}]/g, '').split(','))
  const roles = new Set(['anon', 'authenticated', 'service_role', ...allAcls.flatMap(item => principals(item.acl)),
    ...metadata.tables.flatMap(t => t.columns.flatMap(c => principals(c.acl))), ...policyRoles,
    ...metadata.default_acl.map(item => item.owner)])
  roles.delete('public'); roles.delete('PUBLIC'); roles.delete('postgres')
  for (const role of roles) await db.exec(`create role ${q(role)}${role === 'service_role' ? ' bypassrls' : ''}`)
  await db.exec(`create schema auth;create schema extensions;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_app_meta_data jsonb not null default '{}');
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb)$$;
    create function auth.role() returns text language sql stable as $$select auth.jwt()->>'role'$$;
    create function extensions.gen_random_uuid() returns uuid language sql volatile as $$select pg_catalog.gen_random_uuid()$$;
    grant usage on schema public,auth to anon,authenticated,service_role;
    grant execute on all functions in schema auth to anon,authenticated,service_role;
    set check_function_bodies=off;`)

  for (const s of metadata.sequences) {
    if (s.owned_by?.dependency === 'i') continue
    await db.exec(`create sequence public.${q(s.name)} as ${s.type} increment by ${s.increment} minvalue ${s.min} maxvalue ${s.max} start with ${s.start} cache ${s.cache}${s.cycle ? ' cycle' : ' no cycle'}`)
  }
  for (const table of metadata.tables) {
    const columns = table.columns.map(c => {
      const generation = c.identity ? ` generated ${c.identity === 'a' ? 'always' : 'by default'} as identity` :
        c.generated ? ` generated always as (${c.default}) stored` : c.default ? ` default ${c.default}` : ''
      return `${q(c.name)} ${c.type}${generation}${c.notnull ? ' not null' : ''}`
    })
    const constraints = table.constraints.filter(c => c.type !== 'f').map(c => `constraint ${q(c.name)} ${c.definition}`)
    await db.exec(`create table public.${q(table.name)}(${[...columns, ...constraints].join(',')})`)
  }
  for (const table of metadata.tables) for (const c of table.constraints.filter(c => c.type === 'f')) {
    await db.exec(`alter table public.${q(table.name)} add constraint ${q(c.name)} ${c.definition}`)
  }
  for (const index of metadata.indexes) await db.exec(index.definition)
  for (const fn of metadata.functions) await db.exec(fn.definition)
  // Views can depend on other views; defer only missing relations while preserving real definitions.
  let remaining = [...metadata.views]
  while (remaining.length) {
    const deferred = []
    for (const view of remaining) {
      try {
        await db.exec(`create view public.${q(view.name)}${view.options?.length ? ' with (' + view.options.join(',') + ')' : ''} as ${view.definition}`)
      } catch (error) {
        if (error.code !== '42P01') throw error
        deferred.push(view)
      }
    }
    if (deferred.length === remaining.length) throw new Error('Unresolved production view dependencies: ' + deferred.map(v => v.name).join(', '))
    remaining = deferred
  }
  for (const table of metadata.tables) {
    if (table.rls_enabled) await db.exec(`alter table public.${q(table.name)} enable row level security`)
    if (table.rls_forced) await db.exec(`alter table public.${q(table.name)} force row level security`)
  }
  for (const p of metadata.policies) {
    const policyRoleList = Array.isArray(p.roles) ? p.roles : String(p.roles).replace(/[{}]/g, '').split(',')
    await db.exec(`create policy ${q(p.policyname)} on public.${q(p.tablename)} as ${p.permissive} for ${p.cmd} to ${policyRoleList.map(role => role.toLowerCase() === 'public' ? 'public' : q(role)).join(',')}${p.qual ? ' using (' + p.qual + ')' : ''}${p.with_check ? ' with check (' + p.with_check + ')' : ''}`)
  }
  const denied = ['PUBLIC', ...roles].map(role => role === 'PUBLIC' ? role : q(role)).join(',')
  async function restoreAcl(kind, target, acl) {
    await db.exec(`revoke all on ${kind} ${target} from ${denied}`)
    for (const item of acl || []) {
      if (item.role === 'postgres') continue
      await db.exec(`grant ${item.privilege} on ${kind} ${target} to ${item.role === 'PUBLIC' ? 'PUBLIC' : q(item.role)}${item.grantable ? ' with grant option' : ''}`)
    }
  }
  for (const item of [...metadata.tables, ...metadata.views]) await restoreAcl('table', 'public.' + q(item.name), item.acl)
  for (const table of metadata.tables) for (const col of table.columns) for (const item of col.acl || []) {
    if (item.role === 'postgres') continue
    await db.exec(`grant ${item.privilege} (${q(col.name)}) on table public.${q(table.name)} to ${item.role === 'PUBLIC' ? 'PUBLIC' : q(item.role)}${item.grantable ? ' with grant option' : ''}`)
  }
  for (const s of metadata.sequences) await restoreAcl('sequence', 'public.' + q(s.name), s.acl)
  for (const fn of metadata.functions) await restoreAcl('function', `public.${q(fn.name)}(${fn.identity_args})`, fn.acl)
  for (const trigger of metadata.triggers) {
    await db.exec(trigger.definition)
    if (trigger.enabled === 'D') await db.exec(`alter table public.${q(trigger.table)} disable trigger all`)
  }
  const defaultKinds = { r: 'tables', S: 'sequences', f: 'functions', T: 'types', n: 'schemas' }
  for (const item of metadata.default_acl) {
    const kind = defaultKinds[item.type]
    if (!kind) throw new Error('Unsupported production default ACL kind ' + item.type)
    const scope = `for role ${q(item.owner)}${item.schema ? ' in schema ' + q(item.schema) : ''}`
    await db.exec(`alter default privileges ${scope} revoke all on ${kind} from ${denied}`)
    for (const acl of item.acl) {
      if (acl.role === item.owner) continue
      await db.exec(`alter default privileges ${scope} grant ${acl.privilege} on ${kind} to ${acl.role === 'PUBLIC' ? 'PUBLIC' : q(acl.role)}${acl.grantable ? ' with grant option' : ''}`)
    }
  }
  await db.exec('set check_function_bodies=on')
  return { db, metadata, adaptations: ['auth.users/auth.uid/auth.jwt/auth.role and extensions.gen_random_uuid are local fixtures; no production auth users or claims loaded', 'Sequence counters and customer cardinalities are not captured; values are synthetic'] }
}
