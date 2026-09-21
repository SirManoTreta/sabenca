import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, describe, expect, it } from "vitest";

const alice = "11111111-1111-4111-8111-111111111111";
const bob = "22222222-2222-4222-8222-222222222222";
const eve = "33333333-3333-4333-8333-333333333333";
const unconfirmed = "44444444-4444-4444-8444-444444444444";
const anonymous = "55555555-5555-4555-8555-555555555555";
let db: PGlite;
async function asUser(id: string, query: string) {
  await db.exec(
    `set role authenticated; select set_config('request.jwt.claim.sub', '${id}', false);`,
  );
  try {
    return await db.query(query);
  } finally {
    await db.exec("reset role");
  }
}
beforeAll(async () => {
  db = new PGlite();
  // Minimal Supabase infrastructure fixture. The migration itself is executed unchanged.
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role supabase_auth_admin nologin;
    create schema auth; create schema storage;
    create table auth.users (id uuid primary key, email_confirmed_at timestamptz, is_anonymous boolean default false, banned_until timestamptz, email text, raw_app_meta_data jsonb default '{}', raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema public, auth, storage to authenticated, anon;
    create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects (id uuid default gen_random_uuid(), bucket_id text references storage.buckets(id), name text);
    alter table storage.objects enable row level security;
    grant select, insert, update, delete on storage.objects to authenticated;
    create function storage.foldername(text) returns text[] language sql immutable as $$ select (string_to_array($1, '/'))[1:array_length(string_to_array($1, '/'), 1)-1] $$;
  `);
  await db.exec(
    readFileSync(
      "supabase/migrations/20260913232140_initial_schema.sql",
      "utf8",
    ),
  );
  await db.exec(
    `insert into auth.users (id, email_confirmed_at) values ('${alice}', now()), ('${bob}', now()), ('${eve}', now()), ('${unconfirmed}', null); insert into auth.users (id,email_confirmed_at,is_anonymous) values ('${anonymous}', now(), true); update auth.users set email=id::text||'@example.test';`,
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/20260914013440_institutional_access.sql",
      "utf8",
    ),
  );
  for (const file of [
    "20260916014556_restrict_rls_auto_enable_execution.sql",
    "20260916015001_authorize_admin_bootstrap.sql",
  ])
    await db.exec(readFileSync("supabase/migrations/" + file, "utf8"));
  for (const [index, id] of [alice, bob, eve].entries())
    await db.exec(
      `insert into private.institution_students (institution_id,auth_user_id,ra,name,email,phone,birth_date,cpf_fingerprint,status,activated_at) values ('fatece','${id}','00${index}','Aluno teste','${id}@example.test','5519999999999','2000-01-01',repeat('${index}',64),'active',now())`,
    );
  for (const [id, name] of [
    [alice, "Alice"],
    [bob, "Bruno"],
    [eve, "Eva"],
  ])
    await asUser(
      id,
      `insert into public.profiles (id, user_id, name) values ('${id}', '${id}', '${name}')`,
    );
  await asUser(
    alice,
    `insert into public.listings (id, seller_id, title, description, price, category_id, condition) values ('${alice}', '${alice}', 'Livro de cálculo', 'Livro em bom estado.', 30.50, (select id from public.categories where name = 'Livros'), 'used')`,
  );
});
afterAll(async () => {
  await db?.close();
});
describe("database security", () => {
  it("keeps institutional data inaccessible even to an authenticated admin", async () => {
    await db.exec(
      `insert into private.admin_users (user_id,institution_id) values ('${eve}','fatece')`,
    );
    expect(
      (await asUser(eve, "select public.access_context() as context")).rows[0],
    ).toMatchObject({ context: { member: true, admin: true } });
    await expect(
      asUser(eve, "select * from private.institution_students"),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asUser(eve, "select * from private.import_batches"),
    ).rejects.toThrow(/permission denied/);
  });
  it("a verified Supabase account alone has no institutional membership", async () => {
    const outsider = "66666666-6666-4666-8666-666666666666";
    await db.exec(
      `insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values ('${outsider}','outsider@example.test',now(),'{"admin":true,"status":"active"}')`,
    );
    expect(
      (await asUser(outsider, "select public.access_context() as context"))
        .rows[0],
    ).toEqual({ context: { member: false, admin: false } });
    expect(
      (await asUser(outsider, "select * from public.profiles")).rows,
    ).toHaveLength(0);
  });
  it("blocking revokes data access despite a still-valid Auth identity", async () => {
    await db.exec(
      `update private.institution_students set status='blocked' where auth_user_id='${bob}'`,
    );
    expect(
      (await asUser(bob, "select * from public.profiles")).rows,
    ).toHaveLength(0);
    expect(
      (await asUser(bob, "select * from public.categories")).rows,
    ).toHaveLength(0);
    expect(
      (await asUser(bob, "select * from storage.objects")).rows,
    ).toHaveLength(0);
    await db.exec(
      `update private.institution_students set status='active' where auth_user_id='${bob}'`,
    );
  });
  it("rejects arbitrary signup even if the Auth signup endpoint is enabled", async () => {
    await db.exec(
      "grant usage on schema auth to supabase_auth_admin; grant insert on auth.users to supabase_auth_admin; set role supabase_auth_admin",
    );
    try {
      await expect(
        db.exec(
          `insert into auth.users(id,email,raw_user_meta_data) values ('77777777-7777-4777-8777-777777777777','unknown@example.test','{"sabenca_admin":true}')`,
        ),
      ).rejects.toThrow(/Institutional authorization required/);
    } finally {
      await db.exec("reset role");
    }
  });
  it("enables RLS on every application table", async () => {
    const result = await db.query<{ relname: string }>(
      "select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname in ('public','private') and relkind = 'r' and not relrowsecurity",
    );
    expect(result.rows).toEqual([]);
  });
  it("creates invited staff before Auth adds metadata without granting admin access", async () => {
    const staff = "88888888-8888-4888-8888-888888888888";
    await db.exec(
      "insert into private.admin_invitations(email,institution_id) values ('staff@example.test','fatece')",
    );
    await db.exec("set role supabase_auth_admin");
    try {
      await db.exec(
        `insert into auth.users(id,email,email_confirmed_at) values ('${staff}','staff@example.test',now())`,
      );
    } finally {
      await db.exec("reset role");
    }
    expect(
      (await asUser(staff, "select public.access_context() as context"))
        .rows[0],
    ).toEqual({ context: { member: false, admin: false } });
    await db.exec(
      "delete from private.admin_invitations where email='staff@example.test'",
    );
  });
  it("rejects expired staff invitations even with admin metadata", async () => {
    await db.exec(
      "insert into private.admin_invitations(email,institution_id,expires_at) values ('expired@example.test','fatece',now()-interval '1 minute')",
    );
    await db.exec("set role supabase_auth_admin");
    try {
      await expect(
        db.exec(
          `insert into auth.users(id,email,raw_app_meta_data) values ('99999999-9999-4999-8999-999999999999','expired@example.test','{"sabenca_admin":true}')`,
        ),
      ).rejects.toThrow(/Institutional authorization required/);
    } finally {
      await db.exec("reset role");
    }
  });
  it("prevents application users from issuing staff invitations", async () => {
    await expect(
      asUser(
        eve,
        "insert into private.admin_invitations(email,institution_id) values ('attacker@example.test','fatece')",
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asUser(eve, "select * from private.admin_invitations"),
    ).rejects.toThrow(/permission denied/);
  });
  it("denies anonymous database access", async () => {
    await db.exec("set role anon");
    try {
      await expect(db.query("select * from public.profiles")).rejects.toThrow(
        /permission denied/,
      );
    } finally {
      await db.exec("reset role");
    }
  });
  it("denies unconfirmed and anonymous auth users", async () => {
    for (const id of [unconfirmed, anonymous]) {
      expect(
        (await asUser(id, "select * from public.profiles")).rows,
      ).toHaveLength(0);
      await expect(
        asUser(
          id,
          `insert into public.profiles (user_id, name) values ('${id}', 'Pessoa')`,
        ),
      ).rejects.toThrow(/row-level security/);
    }
  });
  it("allows member discovery without exposing email columns", async () => {
    const result = await asUser(bob, "select * from public.profiles");
    expect(result.rows).toHaveLength(3);
    expect(result.rows[0]).not.toHaveProperty("email");
  });
  it("prevents editing or impersonating another profile", async () => {
    expect(
      (
        await asUser(
          bob,
          `update public.profiles set bio = 'invaded' where id = '${alice}' returning id`,
        )
      ).rows,
    ).toHaveLength(0);
    await expect(
      asUser(
        bob,
        `update public.profiles set user_id = '${alice}' where id = '${bob}'`,
      ),
    ).rejects.toThrow(/permission denied/);
  });
  it("allows own edits and updates timestamp", async () => {
    expect(
      (
        await asUser(
          alice,
          `update public.profiles set bio = 'Aprendendo React' where id = '${alice}' returning bio, updated_at`,
        )
      ).rows[0],
    ).toMatchObject({ bio: "Aprendendo React" });
  });
  it("protects projects, skill links and listing ownership", async () => {
    await expect(
      asUser(
        bob,
        `insert into public.projects (profile_id, title, description) values ('${alice}', 'Projeto', 'Descrição')`,
      ),
    ).rejects.toThrow(/row-level security/);
    await expect(
      asUser(
        bob,
        `insert into public.profile_skills (profile_id, skill_id) values ('${alice}', (select id from public.skills limit 1))`,
      ),
    ).rejects.toThrow(/row-level security/);
    expect(
      (
        await asUser(
          bob,
          `delete from public.listings where id = '${alice}' returning id`,
        )
      ).rows,
    ).toHaveLength(0);
  });
  it("hides inactive listings from other members", async () => {
    await asUser(
      alice,
      `update public.listings set status = 'inactive' where id = '${alice}'`,
    );
    expect(
      (await asUser(bob, "select * from public.listings")).rows,
    ).toHaveLength(0);
    expect(
      (await asUser(alice, "select * from public.listings")).rows,
    ).toHaveLength(1);
  });
  it("restricts connections to participants and recipient decisions", async () => {
    await expect(
      asUser(
        alice,
        `insert into public.connections (requester_id, receiver_id, status) values ('${alice}', '${bob}', 'accepted')`,
      ),
    ).rejects.toThrow(/row-level security/);
    await asUser(
      alice,
      `insert into public.connections (requester_id, receiver_id) values ('${alice}', '${bob}')`,
    );
    expect(
      (await asUser(eve, "select * from public.connections")).rows,
    ).toHaveLength(0);
    expect(
      (
        await asUser(
          alice,
          "update public.connections set status = 'accepted' returning id",
        )
      ).rows,
    ).toHaveLength(0);
    await expect(
      asUser(
        bob,
        `insert into public.connections (requester_id, receiver_id) values ('${bob}', '${alice}')`,
      ),
    ).rejects.toThrow(/unique constraint/);
    expect(
      (
        await asUser(
          bob,
          "update public.connections set status = 'accepted' returning status",
        )
      ).rows,
    ).toEqual([{ status: "accepted" }]);
    expect(
      (
        await asUser(
          bob,
          "update public.connections set status = 'pending' returning id",
        )
      ).rows,
    ).toHaveLength(0);
  });
  it("keeps Storage private and blocks writes in another user's folder", async () => {
    expect(
      (await db.query("select id from storage.buckets where public = true"))
        .rows,
    ).toHaveLength(0);
    await asUser(
      alice,
      `insert into storage.objects (bucket_id, name) values ('avatars', '${alice}/photo.webp')`,
    );
    await expect(
      asUser(
        bob,
        `insert into storage.objects (bucket_id, name) values ('avatars', '${alice}/other.webp')`,
      ),
    ).rejects.toThrow(/row-level security/);
    expect(
      (
        await asUser(
          bob,
          `update storage.objects set name = '${bob}/stolen.webp' returning id`,
        )
      ).rows,
    ).toHaveLength(0);
  });
});
