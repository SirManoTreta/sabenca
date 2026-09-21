import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import postgres from "postgres";
import ExcelJS from "exceljs";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import type { User } from "@supabase/supabase-js";
vi.mock("server-only", () => ({}));
const state = vi.hoisted(() => ({
  sql: null as unknown as ReturnType<typeof postgres>,
  cookie: "",
  otp: vi.fn(),
  resend: vi.fn(),
  createUser: vi.fn(),
  cookiesSet: vi.fn(),
}));
vi.mock("@/lib/institution/database", () => ({ database: () => state.sql }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => (state.cookie ? { value: state.cookie } : undefined),
    set: (_name: string, value: string) => {
      state.cookie = value;
    },
    delete: () => {
      state.cookie = "";
    },
  }),
  headers: async () => new Headers(),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: { admin: { createUser: state.createUser } },
  }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { signInWithOtp: state.otp, resend: state.resend },
  }),
}));
import { previewImport, confirmImport } from "@/services/institution-import";
import {
  beginActivation,
  activationFor,
  activateStudent,
  permitAttempt,
} from "@/services/institution-auth";
import { importColumns } from "@/lib/institution/importer";
const admin = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const account = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
let db: PGlite, server: PGLiteSocketServer, file: Buffer;
beforeAll(async () => {
  process.env.CPF_HMAC_SECRET = "cpf-integration-secret-32-characters";
  process.env.AUTH_HMAC_SECRET = "auth-integration-secret-32-characters";
  process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
  db = await PGlite.create();
  await db.exec(`create role anon; create role authenticated; create role supabase_auth_admin; create schema auth; create schema storage;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,is_anonymous boolean default false,banned_until timestamptz,raw_app_meta_data jsonb default '{}',raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema public,auth,storage to authenticated,anon;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;
 create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;`);
  for (const file of [
    "20260913232140_initial_schema.sql",
    "20260914013440_institutional_access.sql",
    "20260916014556_restrict_rls_auto_enable_execution.sql",
    "20260916015001_authorize_admin_bootstrap.sql",
  ])
    await db.exec(readFileSync("supabase/migrations/" + file, "utf8"));
  await db.exec(
    `insert into auth.users(id,email,email_confirmed_at) values ('${admin}','admin@example.test',now());insert into private.admin_users(user_id,institution_id) values ('${admin}','fatece');`,
  );
  server = new PGLiteSocketServer({ db, port: 0, host: "127.0.0.1" });
  await server.start();
  const connection = server.getServerConn();
  state.sql = postgres(
    connection.startsWith("postgres")
      ? connection
      : "postgres://postgres@" + connection + "/postgres",
    { max: 1, prepare: false, onnotice: () => {} },
  );
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet("Alunos");
  sheet.addRow(importColumns);
  sheet.addRow([
    "00123",
    "Aluno Teste",
    "student@example.test",
    "19999999999",
    "14/05/2003",
    "52998224725",
    "Computação",
    "8",
  ]);
  sheet.addRow([
    "00124",
    "Outra Pessoa",
    "other@example.test",
    "19999999999",
    "31/02/2003",
    "invalid",
    "",
    "",
  ]);
  file = Buffer.from(await book.xlsx.writeBuffer());
});
afterAll(async () => {
  await state.sql?.end({ timeout: 1 });
  await server?.stop();
  await db?.close();
});
describe("institutional workflow with real PostgreSQL transactions", () => {
  it("preview writes no students or import history", async () => {
    const preview = await previewImport(admin, file, "alunos.xlsx");
    expect(preview).toMatchObject({ total: 2, valid: 1, invalid: 1 });
    expect(
      await state.sql`select * from private.institution_students`,
    ).toHaveLength(0);
    expect(await state.sql`select * from private.import_batches`).toHaveLength(
      0,
    );
    expect(JSON.stringify(preview)).not.toContain("52998224725");
  });
  it("confirmation imports only reviewed valid rows and is idempotent", async () => {
    const preview = await previewImport(admin, file, "alunos.xlsx");
    expect(
      await confirmImport(admin, file, "alunos.xlsx", preview.receipt),
    ).toBe(1);
    expect(
      await confirmImport(admin, file, "alunos.xlsx", preview.receipt),
    ).toBe(1);
    expect(
      await state.sql`select status,ra from private.institution_students`,
    ).toEqual(expect.arrayContaining([{ status: "pending", ra: "00123" }]));
    expect(await state.sql`select * from private.import_batches`).toHaveLength(
      1,
    );
  });
  it("reimport preserves blocked/existing records", async () => {
    await state.sql`update private.institution_students set status='blocked'`;
    const preview = await previewImport(admin, file, "alunos.xlsx");
    expect(preview.valid).toBe(0);
    expect(preview.lines[0].errors.join(" ")).toContain("preservado");
    await expect(
      confirmImport(admin, file, "alunos.xlsx", preview.receipt),
    ).rejects.toThrow("linhas válidas");
    await state.sql`update private.institution_students set status='pending'`;
  });
  it("wrong birth date never provisions an account or delivers a link", async () => {
    await beginActivation("00123", "2001-01-01");
    expect(state.createUser).not.toHaveBeenCalled();
    expect(state.otp).not.toHaveBeenCalled();
    expect(state.resend).not.toHaveBeenCalled();
  });
  it("binds first access to the imported identity and email confirmation", async () => {
    state.createUser.mockImplementation(async () => {
      await state.sql`insert into auth.users(id,email) values (${account},'student@example.test')`;
      return { data: { user: { id: account } }, error: null };
    });
    state.otp.mockResolvedValue({ error: null });
    state.resend.mockResolvedValue({ error: null });
    await beginActivation("00123", "2003-05-14");
    expect(state.otp).not.toHaveBeenCalled();
    expect(state.resend).toHaveBeenCalledWith({
      type: "signup",
      email: "student@example.test",
      options: {
        emailRedirectTo:
          "http://localhost:3000/auth/callback?next=/auth/definir-senha",
      },
    });
    const user = {
      id: account,
      email: "student@example.test",
      is_anonymous: false,
    } as User;
    expect(await activationFor(user)).toBeNull();
    await state.sql`update auth.users set email_confirmed_at=now() where id=${account}`;
    // A confirmed account with an unfinished activation needs a new sign-in link.
    await beginActivation("00123", "2003-05-14");
    expect(state.otp).toHaveBeenCalledWith({
      email: "student@example.test",
      options: {
        shouldCreateUser: false,
        emailRedirectTo:
          "http://localhost:3000/auth/callback?next=/auth/definir-senha",
      },
    });
    user.email_confirmed_at = new Date().toISOString();
    expect(await activationFor(user)).not.toBeNull();
    await activateStudent(user);
    expect(
      (await state.sql`select status from private.institution_students`)[0]
        .status,
    ).toBe("active");
    const [profile] = await state.sql`select * from public.profiles`;
    expect(profile.name).toBe("Aluno Teste");
    expect(profile).not.toHaveProperty("cpf");
    expect(profile).not.toHaveProperty("phone");
    expect(profile).not.toHaveProperty("birth_date");
    expect(profile).not.toHaveProperty("email");
    await expect(activateStudent(user)).rejects.toThrow();
  });
  it("distributed attempt budget stops the sixth request", async () => {
    for (let i = 0; i < 5; i++)
      expect(await permitAttempt("test", "RA-TEST")).toBe(true);
    expect(await permitAttempt("test", "RA-TEST")).toBe(false);
  });
  it("revoked administrator cannot confirm a prepared file", async () => {
    const preview = await previewImport(admin, file, "alunos.xlsx");
    await state.sql`delete from private.admin_users where user_id=${admin}`;
    await expect(
      confirmImport(admin, file, "alunos.xlsx", preview.receipt),
    ).rejects.toThrow("revogado");
  });
});
