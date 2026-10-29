import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import postgres from 'postgres';

export const projectRefs = { DEV: 'fidndjlresfxvmerkbhs', PROD: 'qybcbxrxghykkchnvmhy' };
const originalVersion = '20261027191347';
const digest = (value) => crypto.createHash('sha256').update(value).digest('hex');
const canonical = (value) => value.replaceAll('\r\n', '\n').trim();
const quote = (name) => '"' + name.replaceAll('"', '""') + '"';
const rows = async (connection, query, parameters = []) => (await connection.query(query, parameters)).rows;

/** The first fourteen records predate this release. Never rewrite their SQL. */
export function migrationPlan(history, migrations, environment) {
  if (!projectRefs[environment] || migrations.length !== 16 || migrations[14].version !== originalVersion)
    throw new Error('Unexpected release migration inventory');
  const initialCount = environment === 'PROD' ? 14 : 15;
  if (![initialCount, 16].includes(history.length))
    throw new Error('Unexpected migration count; no intermediate Production state is accepted');
  for (const [index, record] of history.entries()) {
    const expected = migrations[index];
    if (record.version !== expected.version || record.name !== expected.name)
      throw new Error('Migration version/name differs from the reviewed inventory');
    if (index >= 14 && canonical((record.statements ?? []).join('\n')) !== canonical(expected.sql))
      throw new Error('Previously applied release SQL differs from the reviewed file');
  }
  return migrations.slice(history.length);
}

async function history(connection) {
  return rows(connection, 'select version,name,statements,md5(to_jsonb(h)::text) as digest from supabase_migrations.schema_migrations h order by version');
}

export async function dataSnapshot(connection) {
  const tables = await rows(connection, `select t.schemaname as schema,t.tablename as name,array_agg(a.attname::text order by a.attnum) as columns
    from pg_tables t join pg_class c on c.oid=format('%I.%I',t.schemaname,t.tablename)::regclass
    join pg_attribute a on a.attrelid=c.oid and a.attnum>0 and not a.attisdropped
    where t.schemaname in ('public','private','auth','storage','vault','supabase_migrations')
    group by t.schemaname,t.tablename order by 1,2`);
  for (const table of tables) {
    // Only the database-maintained compatibility projection may change here.
    if (table.schema === 'public' && table.name === 'listings')
      table.columns = table.columns.filter((column) => !['certificate_id', 'updated_at'].includes(column));
  }
  const proofs = await rows(connection, tables.map((table, index) =>
    `select ${index}::int as table_index,coalesce(jsonb_agg(digest order by digest),'[]'::jsonb) as digests from
    (select md5(jsonb_build_array(${table.columns.map((column) => 't.' + quote(column)).join(',')})::text) as digest
     from ${quote(table.schema)}.${quote(table.name)} t) proof`).join(' union all '));
  for (const proof of proofs) tables[proof.table_index].digests = proof.digests;
  const present = tables.some((table) => table.schema === 'public' && table.name === 'listing_certificates');
  const associations = present
    ? await rows(connection, 'select md5(jsonb_build_array(listing_id,certificate_id,position)::text) as digest from public.listing_certificates order by digest')
    : await rows(connection, 'select md5(jsonb_build_array(id,certificate_id,0::smallint)::text) as digest from public.listings where certificate_id is not null order by digest');
  return { tables, associations: associations.map((record) => record.digest), hadJunction: present };
}

function missingValues(before, after) {
  const available = new Map();
  for (const value of after) available.set(value, (available.get(value) ?? 0) + 1);
  return before.filter((value) => {
    const remaining = available.get(value) ?? 0;
    if (remaining) available.set(value, remaining - 1);
    return !remaining;
  }).length;
}

export function assertPreserved(before, after) {
  for (const table of before.tables) {
    const current = after.tables.find((item) => item.schema === table.schema && item.name === table.name);
    if (!current || JSON.stringify(current.columns) !== JSON.stringify(table.columns) || missingValues(table.digests, current.digests))
      throw new Error(`Previous records changed: ${table.schema}.${table.name}`);
  }
  if (JSON.stringify(before.associations) !== JSON.stringify(after.associations))
    throw new Error('Credential associations or their order changed during migration');
}

async function validateSchema(connection, migrations) {
  const [table] = await rows(connection, "select relrowsecurity as rls from pg_class where oid='public.listing_certificates'::regclass");
  const constraints = await rows(connection, "select conname,pg_get_constraintdef(oid) as definition from pg_constraint where conrelid='public.listing_certificates'::regclass");
  const policies = await rows(connection, "select policyname from pg_policies where schemaname='public' and tablename='listing_certificates'");
  const [security] = await rows(connection, "select has_table_privilege('anon','public.listing_certificates','SELECT,INSERT,UPDATE,DELETE') as anon_access,has_function_privilege('anon','public.listing_credentials(uuid)','EXECUTE') as anon_rpc,has_function_privilege('authenticated','public.listing_credentials(uuid)','EXECUTE') as member_rpc");
  const [projection] = await rows(connection, `select count(*)::int as mismatches from public.listings l where l.certificate_id is distinct from (select r.certificate_id from public.listing_certificates r where r.listing_id=l.id order by r.position limit 1)`);
  const [products] = await rows(connection, 'select count(*)::int as invalid from public.listing_certificates r join public.listings l on l.id=r.listing_id join public.categories c on c.id=l.category_id where not c.is_service');
  if (!table?.rls || policies.length !== 4 || security.anon_access || security.anon_rpc || !security.member_rpc || projection.mismatches || products.invalid)
    throw new Error('Post-migration security or projection invariant failed');
  for (const expected of ['listing_certificates_pkey', 'listing_certificates_position_check', 'listing_certificates_listing_id_position_key'])
    if (!constraints.some((constraint) => constraint.conname === expected)) throw new Error('Credential constraint missing');
  const [foreignKey] = await rows(connection, "select condeferrable,condeferred,confdeltype from pg_constraint where conrelid='public.listings'::regclass and conname='listings_certificate_id_fkey'");
  if (!foreignKey?.condeferrable || !foreignKey.condeferred || foreignKey.confdeltype !== 'a')
    throw new Error('Compatibility projection foreign key is not safely deferred');
  const triggers = await rows(connection, "select t.tgname,t.tgtype,t.tgenabled,c.relname as table_name,n.nspname as function_schema,p.proname as function_name,pg_get_triggerdef(t.oid) as definition from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_proc p on p.oid=t.tgfoid join pg_namespace n on n.oid=p.pronamespace where not t.tgisinternal and t.tgrelid in ('public.listings'::regclass,'public.listing_certificates'::regclass)");
  for (const [name, tableName, functionName, type, column] of [
    ['listing_00_legacy_certificate_isolation', 'listings', 'require_listing_certificate_read_committed', 22, 'certificate_id'],
    ['listing_certificates_isolation', 'listing_certificates', 'require_listing_certificate_read_committed', 30, null],
    ['listing_00_legacy_certificate_write', 'listings', 'guard_legacy_listing_certificate_write', 23, 'certificate_id'],
    ['listing_legacy_certificate_write', 'listings', 'apply_legacy_listing_certificate_write', 21, 'certificate_id'],
    ['listing_product_certificate_cleanup', 'listings', 'clear_product_listing_certificates', 17, 'category_id'],
    ['listing_certificates_delete_lock', 'listing_certificates', 'lock_listing_certificate_delete', 11, null],
    ['listing_certificates_projection', 'listing_certificates', 'project_listing_certificate', 29, null],
  ]) {
    const trigger = triggers.find((item) => item.tgname === name && item.table_name === tableName);
    if (!trigger || trigger.function_schema !== 'private' || trigger.function_name !== functionName || trigger.tgtype !== type || trigger.tgenabled !== 'O' || (column && !trigger.definition.includes('UPDATE OF ' + column)))
      throw new Error('Compatibility trigger definition differs from the reviewed design');
  }
  const functions = [...migrations[15].sql.matchAll(/create(?:\s+or\s+replace)?\s+function\s+(private\.[a-z_]+)\(\)\s+returns\s+trigger\s+[\s\S]*?\bas\s+\$\$([\s\S]*?)\$\$;/gi)];
  if (functions.length !== 7) throw new Error('Unexpected compatibility function inventory');
  for (const [, signature, source] of functions) {
    const [live] = await rows(connection, "select prosrc,prosecdef,proconfig,has_function_privilege('anon',oid,'EXECUTE') as anon_execute,has_function_privilege('authenticated',oid,'EXECUTE') as member_execute from pg_proc where oid=$1::regprocedure", [signature + '()']);
    if (!live?.prosecdef || !live.proconfig?.includes('search_path=""') || live.anon_execute || live.member_execute || canonical(live.prosrc) !== canonical(source))
      throw new Error('Compatibility function source, search_path or grants differ');
  }
}

/** adapter.transaction must wrap every query in ONE real PostgreSQL transaction. */
export async function applyMigrationBatch(adapter, migrations, { environment, expectedHistory, verifyBefore } = {}) {
  return adapter.transaction(async (connection) => {
    await connection.exec("set local lock_timeout='20s'; set local statement_timeout='120s'; set local timezone='UTC'");
    await connection.query('lock table supabase_migrations.schema_migrations in exclusive mode');
    await connection.query('lock table public.listings in share row exclusive mode');
    const [{ present }] = await rows(connection, "select to_regclass('public.listing_certificates') is not null as present");
    if (present) await connection.query('lock table public.listing_certificates in share row exclusive mode');
    const beforeHistory = await history(connection);
    if (expectedHistory && JSON.stringify(beforeHistory) !== JSON.stringify(expectedHistory))
      throw new Error('Migration history moved after preflight');
    const pending = migrationPlan(beforeHistory, migrations, environment);
    if ((beforeHistory.length === 14) === present) throw new Error('Partial release schema exists');
    const before = await dataSnapshot(connection);
    if (verifyBefore) await verifyBefore(connection, before);
    for (const migration of pending) {
      await connection.exec(migration.sql);
      await connection.query('insert into supabase_migrations.schema_migrations(version,name,statements) values ($1,$2,$3::text[])', [migration.version, migration.name, [migration.sql]]);
    }
    const afterHistory = await history(connection);
    migrationPlan(afterHistory, migrations, environment);
    if (afterHistory.length !== 16 || beforeHistory.some((record, index) => record.digest !== afterHistory[index].digest))
      throw new Error('Migration history was not preserved');
    await validateSchema(connection, migrations);
    const after = await dataSnapshot(connection);
    assertPreserved(before, after);
    return { applied: pending.map(({ version, name, sha256 }) => ({ version, name, sha256 })), alreadyApplied: pending.length === 0, beforeCount: beforeHistory.length, afterCount: afterHistory.length, before, after, preservedTables: before.tables.length, preservedAssociations: before.associations.length };
  });
}

/** @param {string} environment @param {Record<string, string | undefined>} [variables] */
export function checkedDatabaseUrl(environment, variables = process.env) {
  if (!projectRefs[environment]) throw new Error('Use DEV or PROD explicitly');
  const value = variables[`${environment}_DB_URL`] ?? variables[`${environment}_DATABASE_URL`];
  let url;
  try { url = new URL(value); } catch { throw new Error('Database configuration unavailable'); }
  const username = decodeURIComponent(url.username);
  const direct = url.hostname === `db.${projectRefs[environment]}.supabase.co` && username === 'postgres';
  const pooler = url.hostname.endsWith('.pooler.supabase.com') && username === `postgres.${projectRefs[environment]}`;
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.port !== '5432' || !url.password || url.hash || !(direct || pooler))
    throw new Error('Database configuration does not match the explicit project ref');
  return value;
}

export function loadReleaseMigrations(root, expectedSha) {
  if (!/^[0-9a-f]{40}$/.test(expectedSha)) throw new Error('Pass the full reviewed Git SHA');
  const git = (args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  if (git(['rev-parse', 'HEAD']).trim() !== expectedSha) throw new Error('HEAD differs from the reviewed release');
  return fs.readdirSync(path.join(root, 'supabase/migrations')).filter((file) => /^\d{14}_.+\.sql$/.test(file)).sort().map((file) => {
    const relative = 'supabase/migrations/' + file;
    const sql = fs.readFileSync(path.join(root, relative), 'utf8');
    const committed = git(['show', `${expectedSha}:${relative}`]);
    if (canonical(sql) !== canonical(committed)) throw new Error('Migration file differs from the reviewed Git SHA');
    return { version: file.slice(0, 14), name: file.slice(15, -4), sql, sha256: digest(sql), canonicalSha256: digest(canonical(sql)) };
  });
}

function localPath(root, value) {
  const resolved = path.resolve(root, value);
  if (!resolved.startsWith(path.resolve(root, '.local') + path.sep)) throw new Error('Private evidence must remain below .local');
  return resolved;
}

function writeNew(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
}

function verifiedBackup(root, filename, baselineCreatedAt) {
  const state = JSON.parse(fs.readFileSync(localPath(root, filename), 'utf8'));
  const directory = localPath(root, state.directory);
  const bytes = fs.readFileSync(path.join(directory, 'manifest.json'));
  const manifest = JSON.parse(bytes.toString('utf8'));
  if (state.projectRef !== projectRefs.PROD || manifest.projectRef !== projectRefs.PROD || digest(bytes) !== state.manifestSha256 || !state.archiveIntegrityVerified || !state.storageIntegrityVerified || !manifest.archive_list_verified || !manifest.archive_payload_verified || !manifest.storage_snapshot_metadata_unchanged || !manifest.backup_artifacts_verified)
    throw new Error('Current Production backup is not verified');
  if (!Number.isFinite(Date.parse(state.createdAt)) || Date.parse(state.createdAt) < Date.parse(baselineCreatedAt) || Date.now() - Date.parse(state.createdAt) > 2 * 60 * 60 * 1000)
    throw new Error('Backup must be current and created after this preflight');
  for (const artifact of [...manifest.files, ...manifest.objects]) {
    const file = path.resolve(directory, artifact.filename);
    if (!file.startsWith(directory + path.sep)) throw new Error('Invalid backup artifact path');
    const content = fs.readFileSync(file);
    if (content.length !== artifact.bytes || digest(content) !== artifact.sha256) throw new Error('Backup checksum mismatch');
  }
  return { state, manifest };
}

async function verifyBackupCurrent(connection, backup) {
  // Business records and physical objects must match the fresh backup. Session
  // timestamps/counters may legitimately move during ordinary authentication.
  for (const name of ['public.profiles', 'public.listings', 'public.profile_certificates', 'private.admin_users', 'private.institution_students', 'storage.objects']) {
    const [schema, table] = name.split('.');
    const expected = backup.manifest.tableProofs.find((proof) => proof.name === name);
    const [actual] = await rows(connection, `select count(*)::bigint::text as count,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) as digest from ${quote(schema)}.${quote(table)} t`);
    if (!expected || expected.count !== actual.count || expected.digest !== actual.digest) throw new Error('Business records changed since backup; create a new backup');
  }
  const [{ count }] = await rows(connection, 'select count(*)::int as count from storage.objects');
  if (count !== backup.manifest.objects.length) throw new Error('Physical Storage backup is stale');
}

export async function main(argv = process.argv.slice(2)) {
  const parameters = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    if (!['--mode', '--environment', '--expected-sha', '--evidence-dir', '--backup-state'].includes(argv[index]) || !argv[index + 1] || parameters.has(argv[index]))
      throw new Error('Invalid or duplicate release argument');
    parameters.set(argv[index], argv[index + 1]);
  }
  const root = process.cwd();
  const environment = parameters.get('--environment');
  const mode = parameters.get('--mode') ?? 'prepare';
  if (!['prepare', 'apply', 'validate'].includes(mode)) throw new Error('Use prepare, apply or validate');
  const expectedSha = parameters.get('--expected-sha');
  const directory = localPath(root, parameters.get('--evidence-dir') ?? '');
  const migrations = loadReleaseMigrations(root, expectedSha);
  const value = checkedDatabaseUrl(environment);
  const url = new URL(value);
  const db = postgres({ host: url.hostname, port: 5432, username: decodeURIComponent(url.username), password: decodeURIComponent(url.password), database: decodeURIComponent(url.pathname.slice(1) || 'postgres'), ssl: 'require', max: 1, prepare: false, connect_timeout: 20, onnotice() {} });
  const wrap = (sql) => ({
    query: async (query, args = []) => ({ rows: Array.from(await sql.unsafe(query, args)) }),
    exec: (query) => sql.unsafe(query),
  });
  const baselineFile = path.join(directory, `${environment.toLowerCase()}-preflight.json`);
  try {
    if (mode === 'prepare') {
      const baseline = await db.begin('isolation level repeatable read read only', async (tx) => {
        const connection = wrap(tx);
        await connection.query("set local timezone='UTC'");
        const records = await history(connection);
        const pending = migrationPlan(records, migrations, environment);
        return { capturedAt: new Date().toISOString(), environment, projectRef: projectRefs[environment], expectedSha, history: records, pending: pending.map(({ version, name, sha256 }) => ({ version, name, sha256 })), snapshot: await dataSnapshot(connection) };
      });
      writeNew(baselineFile, baseline);
      console.log(JSON.stringify({ mode, projectRef: baseline.projectRef, migrations: baseline.history.length, pending: baseline.pending.map((item) => item.version), remoteWrites: false }));
      return;
    }
    const baseline = JSON.parse(fs.readFileSync(baselineFile, 'utf8'));
    if (baseline.environment !== environment || baseline.projectRef !== projectRefs[environment] || baseline.expectedSha !== expectedSha)
      throw new Error('Preflight does not belong to the reviewed release');
    if (mode === 'validate') {
      const current = await db.begin('isolation level repeatable read read only', async (tx) => {
        const connection = wrap(tx);
        await connection.query("set local timezone='UTC'");
        const records = await history(connection);
        if (migrationPlan(records, migrations, environment).length) throw new Error('Release has pending migrations');
        await validateSchema(connection, migrations);
        return dataSnapshot(connection);
      });
      assertPreserved(baseline.snapshot, current);
      writeNew(path.join(directory, `${environment.toLowerCase()}-validation-${crypto.randomUUID()}.json`), { checkedAt: new Date().toISOString(), projectRef: projectRefs[environment], expectedSha, passed: true, snapshot: current });
      console.log(JSON.stringify({ mode, passed: true, migrations: 16, remoteWrites: false }));
      return;
    }
    const currentHistory = await history(wrap(db));
    const pending = migrationPlan(currentHistory, migrations, environment);
    const backup = environment === 'PROD' && pending.length ? verifiedBackup(root, parameters.get('--backup-state') ?? '', baseline.capturedAt) : null;
    const result = await applyMigrationBatch({ transaction: (callback) => db.begin('isolation level repeatable read', (tx) => callback(wrap(tx))) }, migrations, {
      environment,
      expectedHistory: currentHistory,
      verifyBefore: async (connection, current) => {
        assertPreserved(baseline.snapshot, current);
        if (backup) await verifyBackupCurrent(connection, backup);
      },
    });
    writeNew(path.join(directory, `${environment.toLowerCase()}-applied-${crypto.randomUUID()}.json`), { completedAt: new Date().toISOString(), projectRef: projectRefs[environment], expectedSha, backupVerified: Boolean(backup), ...result });
    console.log(JSON.stringify({ mode, projectRef: projectRefs[environment], migrations: result.afterCount, applied: result.applied.map((item) => item.version), preservedTables: result.preservedTables, preservedAssociations: result.preservedAssociations, alreadyApplied: result.alreadyApplied }));
  } finally { await db.end(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    // PostgreSQL error details can contain record values. Never print the raw error.
    const safe = error instanceof Error && !('severity' in error) && !('query' in error) ? error.message : 'Database execution failed; transaction rolled back';
    console.error(JSON.stringify({ releaseSucceeded: false, message: safe, code: /^[0-9A-Z]{5}$/.test(error?.code ?? '') ? error.code : undefined }));
    process.exitCode = 1;
  });
}
