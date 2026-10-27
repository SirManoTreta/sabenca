import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { expect, it } from "vitest";

it("backfills current and historically invalid legacy links without replacing listings or dropping the old column", async () => {
  const db = await PGlite.create();
  const migration = "20261027191347_listing_multiple_certificates.sql";
  const owner = "80000000-0000-4000-8000-000000000001";
  const profile = "90000000-0000-4000-8000-000000000001";
  const current = "70000000-0000-4000-8000-000000000001";
  const historical = "70000000-0000-4000-8000-000000000002";
  const first = "60000000-0000-4000-8000-000000000001";
  const second = "60000000-0000-4000-8000-000000000002";
  try {
    await db.exec(`create role anon;create role authenticated;create role supabase_auth_admin;create schema auth;create schema storage;
      create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,is_anonymous boolean default false,banned_until timestamptz,raw_app_meta_data jsonb default '{}',raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema public,auth,storage to authenticated,anon;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;
      grant select,insert,update,delete on storage.objects to authenticated;
      create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;`);
    for (const file of readdirSync("supabase/migrations")
      .filter((f) => f.endsWith(".sql") && f < migration)
      .sort())
      await db.exec(readFileSync(`supabase/migrations/${file}`, "utf8"));
    await db.query(
      "insert into auth.users(id,email,email_confirmed_at) values ($1,'legacy@example.test',now())",
      [owner],
    );
    await db.query(
      "insert into private.institution_students(institution_id,auth_user_id,ra,name,email,phone,birth_date,cpf_fingerprint,status,activated_at) values ('fatece',$1,'LEGACY','Legado','legacy@example.test','5511999999999','2000-01-01',$2,'active',now())",
      [owner, "1".repeat(64)],
    );
    await db.query(
      "insert into public.profiles(id,user_id,username,name,institution,institution_id) values ($1,$2,'legacy_test','Legado','FATECE','fatece')",
      [profile, owner],
    );
    await db.query(
      "insert into public.profile_certificates(id,user_id,title,issuer,issue_date,verification_url,status) values ($1,$3,'Linux','Instituição','2026-01-01','https://example.test/linux','verified'),($2,$3,'Redes','Instituição','2026-01-01','https://example.test/redes','verified')",
      [current, historical, owner],
    );
    await db.query(
      "insert into public.listings(id,seller_id,title,description,price,category_id,condition,certificate_id) select $1,$2,'Serviço legado A','Preservar A',10,c.id,'not_applicable',$3 from public.categories c where is_service limit 1",
      [first, profile, current],
    );
    await db.query(
      "insert into public.listings(id,seller_id,title,description,price,category_id,condition,certificate_id) select $1,$2,'Serviço legado B','Preservar B',20,c.id,'not_applicable',$3 from public.categories c where is_service limit 1",
      [second, profile, historical],
    );
    // A real owner metadata edit invalidates approval while keeping the old association.
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      owner,
    ]);
    await db.query(
      "update public.profile_certificates set title='Redes revisado' where id=$1",
      [historical],
    );
    const before = (
      await db.query(
        "select id,seller_id,title,description,price,category_id,condition,status,certificate_id,created_at,updated_at from public.listings order by id",
      )
    ).rows;
    await db.exec(readFileSync(`supabase/migrations/${migration}`, "utf8"));
    expect(
      (
        await db.query(
          "select id,seller_id,title,description,price,category_id,condition,status,certificate_id,created_at,updated_at from public.listings order by id",
        )
      ).rows,
    ).toEqual(before);
    expect(
      (
        await db.query(
          "select listing_id,certificate_id,position from public.listing_certificates order by listing_id",
        )
      ).rows,
    ).toEqual([
      { listing_id: first, certificate_id: current, position: 0 },
      { listing_id: second, certificate_id: historical, position: 0 },
    ]);
    expect(
      (
        await db.query(
          "select status from public.profile_certificates where id=$1",
          [historical],
        )
      ).rows,
    ).toEqual([{ status: "pending" }]);
    expect(
      (
        await db.query(
          "select column_name from information_schema.columns where table_schema='public' and table_name='listings' and column_name='certificate_id'",
        )
      ).rows,
    ).toHaveLength(1);
    await db.exec("set role authenticated");
    expect(
      (
        await db.query<{ credentials: { id: string }[] }>(
          "select public.listing_credentials($1) as credentials",
          [first],
        )
      ).rows[0].credentials.map((c) => c.id),
    ).toEqual([current]);
    expect(
      (
        await db.query("select public.listing_credentials($1) as credentials", [
          second,
        ])
      ).rows,
    ).toEqual([{ credentials: [] }]);
    await db.query(
      "delete from public.listing_certificates where listing_id=$1",
      [first],
    );
    expect(
      (
        await db.query(
          "select certificate_id from public.listings where id=$1",
          [first],
        )
      ).rows,
    ).toEqual([{ certificate_id: current }]);
    // Clearing the authoritative relation must not resurrect the old snapshot.
    expect(
      (
        await db.query(
          "select public.listing_credentials($1) as credentials,public.listing_credential($1) as legacy_lookup",
          [first],
        )
      ).rows,
    ).toEqual([{ credentials: [], legacy_lookup: null }]);
  } finally {
    await db.close();
  }
}, 30000);
