import { PGlite, type Transaction } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { expect, it } from "vitest";
import {
  applyMigrationBatch,
  checkedDatabaseUrl,
  migrationPlan,
} from "../scripts/release-credentials.mjs";

const originalVersion = "20261027191347";
const migrationFiles = readdirSync("supabase/migrations")
  .filter((file) => /^\d{14}_.+\.sql$/.test(file))
  .sort();
const migrations = migrationFiles.map((file) => ({
  version: file.slice(0, 14),
  name: file.slice(15, -4),
  sql: readFileSync(`supabase/migrations/${file}`, "utf8"),
}));
const adapter = (db: PGlite) => ({
  transaction: <T>(callback: (tx: Transaction) => Promise<T>) =>
    db.transaction(callback),
});

async function oldDatabase() {
  const db = await PGlite.create();
  await db.exec(`create role anon;create role authenticated;create role supabase_auth_admin;
    create schema auth;create schema storage;create schema supabase_migrations;
    create table supabase_migrations.schema_migrations(version text primary key,name text,statements text[]);
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,is_anonymous boolean default false,banned_until timestamptz,raw_app_meta_data jsonb default '{}',raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth,storage to authenticated,anon;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
    alter table storage.objects enable row level security;
    grant select,insert,update,delete on storage.objects to authenticated;
    create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;`);
  for (const migration of migrations.filter(
    (item) => item.version < originalVersion,
  )) {
    await db.exec(migration.sql);
    await db.query(
      "insert into supabase_migrations.schema_migrations values ($1,$2,$3::text[])",
      [migration.version, migration.name, [migration.sql]],
    );
  }
  await db.exec(`insert into auth.users(id,email,email_confirmed_at) values ('80000000-0000-4000-8000-000000000001','release@example.test',now());
    insert into private.institution_students(institution_id,auth_user_id,ra,name,email,phone,birth_date,cpf_fingerprint,status,activated_at)
    values ('fatece','80000000-0000-4000-8000-000000000001','RELEASE','Teste','release@example.test','5511999999999','2000-01-01',repeat('1',64),'active',now());
    insert into public.profiles(id,user_id,username,name,institution,institution_id)
    values ('90000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000001','release_test','Teste','FATECE','fatece');
    insert into public.profile_certificates(id,user_id,title,issuer,issue_date,verification_url,status)
    values ('70000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000001','Linux','Teste','2026-01-01','https://example.test/linux','verified');
    insert into public.listings(id,seller_id,title,description,price,category_id,condition,certificate_id)
    select '60000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000001','Serviço preservado','Descrição preservada',10,id,'not_applicable','70000000-0000-4000-8000-000000000001' from public.categories where is_service limit 1;`);
  return db;
}

it("applies the original and corrective SQL with their real history in one transaction, preserving legacy data", async () => {
  const db = await oldDatabase();
  try {
    const result = await applyMigrationBatch(
      adapter(db),
      migrations,
      { environment: "PROD" },
    );
    expect(result.beforeCount).toBe(14);
    expect(result.afterCount).toBe(16);
    expect(result.applied.map((item: { version: string }) => item.version)).toEqual(
      migrations.slice(14).map((item) => item.version),
    );
    expect(result.preservedAssociations).toBe(1);
    const records = await db.query<{ statements: string[] }>(
      "select statements from supabase_migrations.schema_migrations order by version desc limit 2",
    );
    expect(records.rows.map((record) => record.statements)).toEqual(
      migrations
        .slice(14)
        .reverse()
        .map((item) => [item.sql]),
    );
    expect(
      (
        await db.query("select certificate_id,position from public.listing_certificates")
      ).rows,
    ).toEqual([
      { certificate_id: "70000000-0000-4000-8000-000000000001", position: 0 },
    ]);
  } finally {
    await db.close();
  }
}, 30000);

it("rolls back the first DDL, both histories and all data if the corrective migration fails", async () => {
  const db = await oldDatabase();
  try {
    const before = (
      await db.query("select to_jsonb(l) as data from public.listings l order by id")
    ).rows;
    const failed = migrations.map((migration, index) =>
      index === 15
        ? { ...migration, sql: migration.sql + "\nselect 1/0;" }
        : migration,
    );
    await expect(
      applyMigrationBatch(
        adapter(db),
        failed,
        { environment: "PROD" },
      ),
    ).rejects.toThrow(/division by zero/);
    expect(
      (
        await db.query(
          "select to_regclass('public.listing_certificates') as junction,(select count(*)::int from supabase_migrations.schema_migrations) as migrations",
        )
      ).rows,
    ).toEqual([{ junction: null, migrations: 14 }]);
    expect(
      (
        await db.query("select to_jsonb(l) as data from public.listings l order by id")
      ).rows,
    ).toEqual(before);
    // A retry executes both files; it does not mark the failed SQL as applied.
    const retry = await applyMigrationBatch(
      adapter(db),
      migrations,
      { environment: "PROD" },
    );
    expect(retry.applied).toHaveLength(2);
    expect(retry.afterCount).toBe(16);
  } finally {
    await db.close();
  }
}, 30000);

it("applies only the correction on DEV and validates an already-applied batch without repeating SQL", async () => {
  const db = await oldDatabase();
  try {
    await db.exec(migrations[14].sql);
    await db.query(
      "insert into supabase_migrations.schema_migrations values ($1,$2,$3::text[])",
      [migrations[14].version, migrations[14].name, [migrations[14].sql]],
    );
    const first = await applyMigrationBatch(
      adapter(db),
      migrations,
      { environment: "DEV" },
    );
    expect(first.beforeCount).toBe(15);
    expect(first.applied.map((item: { version: string }) => item.version)).toEqual([
      migrations[15].version,
    ]);
    const again = await applyMigrationBatch(
      adapter(db),
      migrations,
      { environment: "DEV" },
    );
    expect(again.alreadyApplied).toBe(true);
    expect(again.applied).toEqual([]);
    expect(again.afterCount).toBe(16);
  } finally {
    await db.close();
  }
}, 30000);

it("aborts before commit if migration SQL changes a preexisting business field", async () => {
  const db = await oldDatabase();
  try {
    const altered = migrations.map((migration, index) =>
      index === 15
        ? {
            ...migration,
            sql:
              migration.sql +
              "\nupdate public.listings set title='Unexpected business change';",
          }
        : migration,
    );
    await expect(
      applyMigrationBatch(adapter(db), altered, { environment: "PROD" }),
    ).rejects.toThrow("Previous records changed: public.listings");
    expect(
      (
        await db.query(
          "select title,to_regclass('public.listing_certificates') as junction,(select count(*)::int from supabase_migrations.schema_migrations) as migrations from public.listings",
        )
      ).rows,
    ).toEqual([
      { title: "Serviço preservado", junction: null, migrations: 14 },
    ]);
  } finally {
    await db.close();
  }
}, 30000);

it("refuses a partially applied Production release and changed history SQL", () => {
  const records = migrations.map((migration) => ({
    version: migration.version,
    name: migration.name,
    statements: [migration.sql],
  }));
  expect(() => migrationPlan(records.slice(0, 15), migrations, "PROD")).toThrow(
    /intermediate Production state/,
  );
  records[15].statements = ["select 'not the migration';"];
  expect(() => migrationPlan(records, migrations, "PROD")).toThrow(
    /SQL differs/,
  );
});

it("requires a database URL bound to the explicitly selected project", () => {
  expect(() =>
    checkedDatabaseUrl("PROD", {
      PROD_DB_URL:
        "postgres://postgres:fictional@db.fidndjlresfxvmerkbhs.supabase.co:5432/postgres",
    }),
  ).toThrow(/explicit project ref/);
  expect(() =>
    checkedDatabaseUrl("PROD", {
      PROD_DB_URL:
        "postgres://postgres.qybcbxrxghykkchnvmhy:fictional@arbitrary.example.test:5432/postgres",
    }),
  ).toThrow(/explicit project ref/);
});
