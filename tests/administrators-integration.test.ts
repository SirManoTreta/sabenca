import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import postgres from "postgres";
import { readFileSync, readdirSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const state = vi.hoisted(() => ({
  sql: null as unknown as ReturnType<typeof postgres>,
  invite: vi.fn(),
}));
vi.mock("@/lib/institution/database", () => ({ database: () => state.sql }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: { admin: { inviteUserByEmail: state.invite } },
  }),
}));
vi.mock("@/services/session", () => ({ requireAdmin: vi.fn() }));
import {
  addAdministrator,
  administratorEmail,
  revokeAdministrator,
} from "@/services/administrators";
const admin = "11111111-1111-4111-8111-111111111111";
const member = "22222222-2222-4222-8222-222222222222";
const created = "33333333-3333-4333-8333-333333333333";
let db: PGlite, server: PGLiteSocketServer;
beforeAll(async () => {
  db = await PGlite.create();
  await db.exec(`create role anon;create role authenticated;create role supabase_auth_admin;create schema auth;create schema storage;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,is_anonymous boolean default false,banned_until timestamptz,raw_app_meta_data jsonb default '{}',raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth,storage to authenticated,anon;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;
    create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;`);
  for (const file of readdirSync("supabase/migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await db.exec(readFileSync(`supabase/migrations/${file}`, "utf8"));
  await db.exec(`insert into auth.users(id,email,email_confirmed_at) values ('${admin}','admin@example.test',now()),('${member}','member@example.test',now());
    insert into private.admin_users(user_id,institution_id) values ('${admin}','fatece');`);
  server = new PGLiteSocketServer({ db, port: 0, host: "127.0.0.1" });
  await server.start();
  const uri = server.getServerConn();
  state.sql = postgres(
    uri.startsWith("postgres") ? uri : `postgres://postgres@${uri}/postgres`,
    { max: 1, prepare: false, onnotice() {} },
  );
});
afterAll(async () => {
  await state.sql?.end();
  await server?.stop();
  await db?.close();
});

describe("administrator management", () => {
  it("normalizes e-mail and rejects malformed addresses", () => {
    expect(administratorEmail.parse(" Staff@Example.test ")).toBe(
      "staff@example.test",
    );
    expect(administratorEmail.safeParse("bad").success).toBe(false);
  });
  it("refuses non-admins before privileged Auth calls", async () => {
    await expect(
      addAdministrator(member, "new@example.test", "https://example.test"),
    ).rejects.toThrow("revogado");
    expect(state.invite).not.toHaveBeenCalled();
  });
  it("protects self and the final confirmed administrator", async () => {
    await expect(revokeAdministrator(admin, admin)).rejects.toThrow("próprio");
    await expect(
      state.sql`delete from private.admin_users where user_id=${admin}`,
    ).rejects.toMatchObject({ code: "23514" });
  });
  it("promotes a confirmed existing account without recreating it, prevents duplicates and revokes permission only", async () => {
    await addAdministrator(
      admin,
      " MEMBER@EXAMPLE.TEST ",
      "https://example.test",
    );
    expect(state.invite).not.toHaveBeenCalled();
    await expect(
      addAdministrator(admin, "member@example.test", "https://example.test"),
    ).rejects.toThrow("já é administrador");
    await revokeAdministrator(admin, member);
    expect(
      await state.sql`select id from auth.users where id=${member}`,
    ).toHaveLength(1);
    expect(
      await state.sql`select user_id from private.admin_users where user_id=${member}`,
    ).toHaveLength(0);
  });
  it("sends an invitation only after the closed-signup lease is committed", async () => {
    state.invite.mockImplementationOnce(async () => {
      expect(
        await state.sql`select email from private.admin_invitations where email='new@example.test'`,
      ).toHaveLength(1);
      await state.sql`insert into auth.users(id,email) values (${created},'new@example.test')`;
      return { data: { user: { id: created } }, error: null };
    });
    await addAdministrator(admin, "new@example.test", "https://example.test");
    expect(state.invite).toHaveBeenCalledWith("new@example.test", {
      redirectTo: "https://example.test/auth/convite",
    });
    expect(
      await state.sql`select user_id from private.admin_users where user_id=${created}`,
    ).toHaveLength(1);
    expect(
      await state.sql`select email from private.admin_invitations where email='new@example.test'`,
    ).toHaveLength(0);
    await revokeAdministrator(admin, created);
  });
  it("retains failed provisioning for retry without opening public signup", async () => {
    state.invite.mockResolvedValueOnce({
      data: { user: null },
      error: { code: "smtp_failed" },
    });
    await expect(
      addAdministrator(admin, "retry@example.test", "https://example.test"),
    ).rejects.toThrow("convite");
    const [pending] =
      await state.sql`select delivery_failed from private.admin_invitations where email='retry@example.test'`;
    expect(pending.delivery_failed).toBe(true);
    state.invite.mockImplementationOnce(async () => {
      await state.sql`insert into auth.users(id,email) values ('44444444-4444-4444-8444-444444444444','retry@example.test')`;
      return {
        data: { user: { id: "44444444-4444-4444-8444-444444444444" } },
        error: null,
      };
    });
    await addAdministrator(admin, "retry@example.test", "https://example.test");
    expect(
      await state.sql`select email from private.admin_invitations where email='retry@example.test'`,
    ).toHaveLength(0);
  });
  it("refuses revocation by an actor whose permission has been removed", async () => {
    await expect(revokeAdministrator(member, created)).rejects.toThrow(
      "revogado",
    );
  });
  it("resends an unconfirmed admin invitation without duplicating authorization", async () => {
    state.invite
      .mockReset()
      .mockResolvedValue({ data: { user: { id: created } }, error: null });
    await addAdministrator(admin, "new@example.test", "https://example.test");
    await addAdministrator(
      admin,
      "new@example.test",
      "https://example.test",
      true,
    );
    expect(state.invite).toHaveBeenCalledTimes(2);
    expect(
      await state.sql`select user_id from private.admin_users where user_id=${created}`,
    ).toHaveLength(1);
  });
  it("recovers when Auth created the account but its response was interrupted", async () => {
    const partial = "55555555-5555-4555-8555-555555555555";
    state.invite.mockReset().mockImplementationOnce(async () => {
      await state.sql`insert into auth.users(id,email) values (${partial},'partial@example.test')`;
      throw new Error("Interrupted Auth response");
    });
    await expect(
      addAdministrator(admin, "partial@example.test", "https://example.test"),
    ).rejects.toThrow("Interrupted");
    expect(
      await state.sql`select email from private.admin_invitations where email='partial@example.test' and delivery_failed`,
    ).toHaveLength(1);
    state.invite.mockResolvedValueOnce({
      data: { user: { id: partial } },
      error: null,
    });
    await addAdministrator(
      admin,
      "partial@example.test",
      "https://example.test",
    );
    expect(
      await state.sql`select id from auth.users where email='partial@example.test'`,
    ).toHaveLength(1);
    expect(
      await state.sql`select user_id from private.admin_users where user_id=${partial}`,
    ).toHaveLength(1);
    expect(
      await state.sql`select email from private.admin_invitations where email='partial@example.test'`,
    ).toHaveLength(0);
  });
});
