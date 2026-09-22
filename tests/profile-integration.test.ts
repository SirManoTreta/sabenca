import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import postgres from "postgres";
import { readFileSync, readdirSync } from "node:fs";
import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
const state = vi.hoisted(() => ({
  sql: null as unknown as ReturnType<typeof postgres>,
}));
vi.mock("@/lib/institution/database", () => ({ database: () => state.sql }));
import { saveProfile } from "@/services/profile-write";

const alice = "11111111-1111-4111-8111-111111111111";
const bob = "22222222-2222-4222-8222-222222222222";
const admin = "33333333-3333-4333-8333-333333333333";
let db: PGlite, server: PGLiteSocketServer;
async function asUser(id: string, query: string) {
  return state.sql.begin(async (sql) => {
    await sql`select set_config('request.jwt.claim.sub', ${id}, true)`;
    await sql`set local role authenticated`;
    return sql.unsafe(query);
  });
}
beforeAll(async () => {
  db = await PGlite.create();
  await db.exec(`create role anon; create role authenticated; create role supabase_auth_admin; create schema auth; create schema storage;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,is_anonymous boolean default false,banned_until timestamptz,raw_app_meta_data jsonb default '{}',raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth,storage to authenticated,anon;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;
    grant select,insert,update,delete on storage.objects to authenticated;
    create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;`);
  const migrations = readdirSync("supabase/migrations")
    .filter((file) => file.endsWith(".sql"))
    .sort();
  for (const file of migrations.filter(
    (file) => !file.endsWith("_profile_phase.sql"),
  ))
    await db.exec(readFileSync("supabase/migrations/" + file, "utf8"));
  for (const [index, id] of [alice, bob, admin].entries()) {
    await db.query(
      "insert into auth.users(id,email,email_confirmed_at) values ($1,$2,now())",
      [id, `${id}@example.test`],
    );
    if (id !== admin) {
      await db.query(
        "insert into private.institution_students(institution_id,auth_user_id,ra,name,email,phone,birth_date,cpf_fingerprint,status,activated_at) values ('fatece',$1,$2,'Nome institucional',$3,'5519999999999','2000-01-01',$4,'active',now())",
        [id, `00${index}`, `${id}@example.test`, String(index).repeat(64)],
      );
      await db.query(
        "insert into public.profiles(id,user_id,name,course,semester,institution) values ($1,$1,'Nome institucional','Computação',8,'FATECE')",
        [id],
      );
    }
  }
  await db.exec(`insert into private.admin_users(user_id,institution_id) values ('${admin}','fatece');
    insert into public.profile_skills(profile_id,skill_id) select '${alice}',id from public.skills where lower(btrim(name))='react';
    insert into public.profile_interests(profile_id,interest_id) select '${alice}',id from public.interests where lower(btrim(name))='jogos';`);
  for (const file of migrations.filter((file) =>
    file.endsWith("_profile_phase.sql"),
  ))
    await db.exec(readFileSync("supabase/migrations/" + file, "utf8"));
  server = new PGLiteSocketServer({ db, port: 0, host: "127.0.0.1" });
  await server.start();
  const connection = server.getServerConn();
  state.sql = postgres(
    connection.startsWith("postgres")
      ? connection
      : "postgres://postgres@" + connection + "/postgres",
    { max: 1, prepare: false, onnotice: () => {} },
  );
});
afterAll(async () => {
  await state.sql?.end({ timeout: 1 });
  await server?.stop();
  await db?.close();
});

describe("phase 2 migration and transactional profile service", () => {
  it("preserves the existing catalog and associations", async () => {
    expect(
      await state.sql`select * from public.profile_skills where profile_id=${alice}`,
    ).toHaveLength(1);
    expect(
      await state.sql`select * from public.profile_interests where profile_id=${alice}`,
    ).toHaveLength(1);
    expect(
      await state.sql`select * from public.skills where normalized_name='react'`,
    ).toHaveLength(1);
  });
  it("updates only social fields and associates existing/new normalized labels", async () => {
    await saveProfile(alice, {
      username: "Alice",
      bio: "Aprendendo!",
      skills: ["React", " DOCKER ", "docker"],
      interests: ["Jogos", " Ciência   de Dados "],
    });
    expect(
      (
        await state.sql`select username,bio,name,course,semester from public.profiles where id=${alice}`
      )[0],
    ).toMatchObject({
      username: "alice",
      bio: "Aprendendo!",
      name: "Nome institucional",
      course: "Computação",
      semester: 8,
    });
    expect(
      await state.sql`select * from public.profile_skills where profile_id=${alice}`,
    ).toHaveLength(2);
    expect(
      await state.sql`select * from public.skills where normalized_name='docker'`,
    ).toHaveLength(1);
    await saveProfile(bob, {
      username: "bruno",
      bio: "",
      skills: ["Docker"],
      interests: ["ciência de dados"],
    });
    expect(
      await state.sql`select * from public.interests where normalized_name='ciência de dados'`,
    ).toHaveLength(1);
  });
  it("rolls back the entire update on duplicate username", async () => {
    await expect(
      saveProfile(bob, {
        username: "alice",
        bio: "not saved",
        skills: ["Must roll back"],
        interests: [],
      }),
    ).rejects.toMatchObject({
      code: "23505",
      constraint_name: "profiles_username_key",
    });
    expect(
      await state.sql`select * from public.skills where normalized_name='must roll back'`,
    ).toHaveLength(0);
    expect(
      (
        await state.sql`select username,bio from public.profiles where id=${bob}`
      )[0],
    ).toMatchObject({ username: "bruno", bio: null });
    expect(
      await state.sql`select * from public.profile_skills where profile_id=${bob}`,
    ).toHaveLength(1);
  });
  it("removes associations without deleting the shared catalog", async () => {
    await saveProfile(alice, {
      username: "alice",
      bio: "",
      skills: [],
      interests: [],
    });
    expect(
      await state.sql`select * from public.profile_skills where profile_id=${alice}`,
    ).toHaveLength(0);
    expect(
      await state.sql`select * from public.profile_interests where profile_id=${alice}`,
    ).toHaveLength(0);
    expect(
      await state.sql`select * from public.skills where normalized_name='docker'`,
    ).toHaveLength(1);
    expect(
      await state.sql`select * from public.profile_skills where profile_id=${bob}`,
    ).toHaveLength(1);
  });
  it("refuses a blocked student and an administrator without membership", async () => {
    await state.sql`update private.institution_students set status='blocked' where auth_user_id=${bob}`;
    for (const id of [bob, admin]) {
      await expect(
        saveProfile(id, {
          username: "blocked",
          bio: "",
          skills: [],
          interests: [],
        }),
      ).rejects.toThrow("access denied");
      expect(await asUser(id, "select id from public.profiles")).toHaveLength(
        0,
      );
      expect(await asUser(id, "select id from public.projects")).toHaveLength(
        0,
      );
    }
    await state.sql`update private.institution_students set status='active' where auth_user_id=${bob}`;
  });
});
describe("phase 2 RLS and column permissions", () => {
  it("protects institutional identity, ownership and catalog creation", async () => {
    for (const query of [
      `update public.profiles set name='Forged' where id='${alice}'`,
      `update public.profiles set course='Forged', semester=1 where id='${alice}'`,
      `update public.profiles set institution='Forged' where id='${alice}'`,
      `delete from public.profiles where id='${alice}'`,
      `insert into public.profiles(user_id,name) values ('${alice}','Forged')`,
      "insert into public.skills(name) values ('Uncontrolled')",
      "insert into public.interests(name) values ('Uncontrolled')",
    ])
      await expect(asUser(alice, query)).rejects.toThrow(/permission denied/);
    expect(
      await asUser(
        bob,
        `update public.profiles set bio='Invaded' where id='${alice}' returning id`,
      ),
    ).toHaveLength(0);
    await expect(
      asUser(
        alice,
        `update public.profiles set username='sa' where id='${alice}'`,
      ),
    ).rejects.toThrow(/check constraint/);
    for (const [table, column] of [
      ["profile_skills", "skill_id"],
      ["profile_interests", "interest_id"],
    ]) {
      const catalog = table.replace("profile_", "");
      await expect(
        asUser(
          alice,
          `insert into public.${table}(profile_id,${column}) values ('${bob}',(select id from public.${catalog} limit 1))`,
        ),
      ).rejects.toThrow(/row-level security/);
      expect(
        await asUser(
          alice,
          `delete from public.${table} where profile_id='${bob}' returning id`,
        ),
      ).toHaveLength(0);
    }
  });
  it("supports project CRUD with immutable ownership and cross-user protection", async () => {
    await asUser(
      alice,
      `insert into public.projects(id,profile_id,title,description) values ('${alice}','${alice}','Projeto acadêmico','Descrição')`,
    );
    expect(await asUser(bob, "select title from public.projects")).toHaveLength(
      1,
    );
    expect(
      await asUser(
        bob,
        `update public.projects set title='Invaded' where id='${alice}' returning id`,
      ),
    ).toHaveLength(0);
    expect(
      await asUser(
        bob,
        `delete from public.projects where id='${alice}' returning id`,
      ),
    ).toHaveLength(0);
    await expect(
      asUser(
        bob,
        `insert into public.projects(profile_id,title,description) values ('${alice}','Invaded','Not mine')`,
      ),
    ).rejects.toThrow(/row-level security/);
    await expect(
      asUser(
        alice,
        `update public.projects set profile_id='${bob}' where id='${alice}'`,
      ),
    ).rejects.toThrow(/permission denied/);
    expect(
      await asUser(
        alice,
        `update public.projects set title='Projeto atualizado' where id='${alice}' returning title`,
      ),
    ).toEqual([{ title: "Projeto atualizado" }]);
    expect(
      await asUser(
        alice,
        `delete from public.projects where id='${alice}' returning id`,
      ),
    ).toHaveLength(1);
  });
  it("keeps buckets private and enforces active membership and object ownership", async () => {
    expect(
      await state.sql`select * from storage.buckets where public=true`,
    ).toHaveLength(0);
    await asUser(
      alice,
      `insert into storage.objects(bucket_id,name) values ('avatars','${alice}/avatar.png')`,
    );
    expect(await asUser(bob, "select name from storage.objects")).toHaveLength(
      1,
    );
    await expect(
      asUser(
        bob,
        `insert into storage.objects(bucket_id,name) values ('project-images','${alice}/stolen.png')`,
      ),
    ).rejects.toThrow(/row-level security/);
    expect(
      await asUser(bob, "delete from storage.objects returning id"),
    ).toHaveLength(0);
    await state.sql`update private.institution_students set status='blocked' where auth_user_id=${bob}`;
    expect(await asUser(bob, "select name from storage.objects")).toHaveLength(
      0,
    );
    await state.sql`update private.institution_students set status='active' where auth_user_id=${bob}`;
  });
});
