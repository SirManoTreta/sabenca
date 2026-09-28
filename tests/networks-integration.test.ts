import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import postgres from "postgres";
import ExcelJS from "exceljs";
import { readFileSync, readdirSync } from "node:fs";
import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
const state = vi.hoisted(() => ({
  sql: null as unknown as ReturnType<typeof postgres>,
  requireUser: vi.fn(),
  signed: vi.fn(),
}));
vi.mock("@/lib/institution/database", () => ({ database: () => state.sql }));
vi.mock("@/services/session", () => ({
  requireUser: state.requireUser,
  requireAdmin: vi.fn(),
}));
import { saveCourse } from "@/services/courses";
import { searchNetworks, getNetworks } from "@/services/networks";
import { previewImport, confirmImport } from "@/services/institution-import";
import { createStudentTemplate } from "@/lib/institution/template";
import { saveProfile } from "@/services/profile-write";

const uid = (index: number) =>
  `10000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
const actor = uid(0),
  admin = uid(99);
let db: PGlite, server: PGLiteSocketServer;
let computation: string,
  administration: string,
  react: string,
  games: string,
  python: string;
async function asUser(id: string, query: string) {
  return state.sql.begin(async (sql) => {
    await sql`select set_config('request.jwt.claim.sub', ${id}, true)`;
    await sql`set local role authenticated`;
    return sql.unsafe(query);
  });
}
async function workbook(course: string) {
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(
    (await createStudentTemplate()) as unknown as ExcelJS.Buffer,
  );
  book.worksheets[0].addRow([
    "009999",
    "Importado Teste",
    "import@example.test",
    "19999999999",
    "14/05/2000",
    "52998224725",
    course,
    8,
  ]);
  return Buffer.from(await book.xlsx.writeBuffer());
}
beforeAll(async () => {
  process.env.CPF_HMAC_SECRET = "phase3-test-cpf-secret-32-characters";
  process.env.AUTH_HMAC_SECRET = "phase3-test-auth-secret-32-characters";
  db = await PGlite.create();
  await db.exec(`create role anon; create role authenticated; create role supabase_auth_admin; create schema auth; create schema storage;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,is_anonymous boolean default false,banned_until timestamptz,raw_app_meta_data jsonb default '{}',raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth,storage to authenticated,anon;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;
    create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;`);
  const migrations = readdirSync("supabase/migrations")
    .filter((file) => file.endsWith(".sql"))
    .sort();
  for (const file of migrations.filter(
    (name) => name < "20260927030010_courses_networks.sql",
  ))
    await db.exec(readFileSync("supabase/migrations/" + file, "utf8"));
  await db.query(
    "insert into auth.users(id,email,email_confirmed_at) values ($1,'admin@example.test',now())",
    [admin],
  );
  await db.query(
    "insert into private.admin_users(user_id,institution_id) values ($1,'fatece')",
    [admin],
  );
  for (let index = 0; index <= 30; index++) {
    const id = uid(index),
      email = `student${index}@example.test`;
    const course =
      index === 2
        ? "Administração"
        : index === 1
          ? " COMPUTAÇÃO "
          : "Computação";
    const name =
      index === 1
        ? "Ana Silva"
        : index === 2
          ? "Bia Souza"
          : `Pessoa ${String(index).padStart(2, "0")}`;
    await db.query(
      "insert into auth.users(id,email,email_confirmed_at) values ($1,$2,now())",
      [id, email],
    );
    await db.query(
      "insert into private.institution_students(institution_id,auth_user_id,ra,name,email,phone,birth_date,cpf_fingerprint,course,semester,status,activated_at) values ('fatece',$1,$2,$3,$4,'5519999999999','2000-01-01',$5,$6,$7,$8,now())",
      [
        id,
        `00${index}`,
        name,
        email,
        index.toString(16).padStart(64, "0"),
        course,
        index === 1 ? 8 : index === 2 ? 2 : 1,
        index === 4 ? "blocked" : index === 5 ? "inactive" : "active",
      ],
    );
    await db.query(
      "insert into public.profiles(id,user_id,username,name,course,semester,institution,avatar_url) values ($1,$1,$2,$3,$4,$5,'FATECE',$6)",
      [
        id,
        index === 3 ? null : `person_${index}`,
        name,
        course,
        index === 1 ? 8 : index === 2 ? 2 : 1,
        index === 1 ? `${id}/avatar.png` : null,
      ],
    );
  }
  const migration = readFileSync(
    "supabase/migrations/" +
      migrations.find((name) => name.endsWith("_courses_networks.sql")),
    "utf8",
  );
  // Prove ambiguity aborts before applying the unchanged final migration.
  await db.exec(
    "begin; update public.profiles set course='Conflicting course' where username='person_1';",
  );
  await expect(db.exec(migration)).rejects.toThrow(
    "conflicting institutional courses",
  );
  await db.exec("rollback;");
  expect((await db.query("select id from public.profiles")).rows).toHaveLength(
    31,
  );
  await db.exec("begin;" + migration + "commit;");
  for (const file of migrations.filter(
    (name) => name > "20260927030010_courses_networks.sql",
  ))
    await db.exec(
      "begin;" +
        readFileSync("supabase/migrations/" + file, "utf8") +
        "commit;",
    );
  await db.exec(`insert into public.profile_skills(profile_id,skill_id) select '${uid(1)}',id from public.skills where name='React';
    insert into public.profile_skills(profile_id,skill_id) select '${uid(2)}',id from public.skills where name='Python';
    insert into public.profile_interests(profile_id,interest_id) select '${uid(1)}',id from public.interests where name='Jogos';`);
  server = new PGLiteSocketServer({ db, port: 0, host: "127.0.0.1" });
  await server.start();
  const connection = server.getServerConn();
  state.sql = postgres(
    connection.startsWith("postgres")
      ? connection
      : "postgres://postgres@" + connection + "/postgres",
    { max: 1, prepare: false, onnotice: () => {} },
  );
  computation = (
    await state.sql`select id from public.courses where normalized_name='computação'`
  )[0].id;
  administration = (
    await state.sql`select id from public.courses where normalized_name='administração'`
  )[0].id;
  react = (await state.sql`select id from public.skills where name='React'`)[0]
    .id;
  python = (
    await state.sql`select id from public.skills where name='Python'`
  )[0].id;
  games = (
    await state.sql`select id from public.interests where name='Jogos'`
  )[0].id;
  state.requireUser.mockResolvedValue({
    user: { id: actor },
    client: { storage: { from: () => ({ createSignedUrls: state.signed }) } },
  });
});
afterAll(async () => {
  await state.sql?.end({ timeout: 1 });
  await server?.stop();
  await db?.close();
});

describe("institutional course catalog", () => {
  it("preserves all legacy records and safe equivalent references", async () => {
    expect(await state.sql`select id from public.courses`).toHaveLength(2);
    expect(
      await state.sql`select id from private.institution_students where course_id is null`,
    ).toHaveLength(0);
    expect(
      await state.sql`select p.id from public.profiles p join private.institution_students s on s.auth_user_id=p.user_id where p.course_id is distinct from s.course_id`,
    ).toHaveLength(0);
    expect(
      (
        await state.sql`select course from public.profiles where id=${uid(1)}`
      )[0].course,
    ).toBe(" COMPUTAÇÃO ");
  });
  it("allows admin creation but rejects members, blocked admins and browser writes", async () => {
    const id = await saveCourse(admin, {
      name: " Engenharia   de Software ",
      status: "active",
    });
    expect(
      (await state.sql`select name from public.courses where id=${id}`)[0].name,
    ).toBe("Engenharia de Software");
    await expect(
      saveCourse(actor, { name: "Forbidden", status: "active" }),
    ).rejects.toThrow("revogado");
    for (const caller of [actor, admin])
      await expect(
        asUser(
          caller,
          "insert into public.courses(institution_id,name) values ('fatece','Forged')",
        ),
      ).rejects.toThrow(/permission denied/);
    await state.sql`update auth.users set banned_until=now()+interval '1 day' where id=${admin}`;
    await expect(
      saveCourse(admin, { name: "Forbidden", status: "active" }),
    ).rejects.toThrow("revogado");
    await state.sql`update auth.users set banned_until=null where id=${admin}`;
  });
  it("rejects normalized duplicates and destructive removal of associated courses", async () => {
    await expect(
      saveCourse(admin, { name: "  COMPUTAÇÃO ", status: "active" }),
    ).rejects.toMatchObject({ code: "23505" });
    await expect(
      state.sql`delete from public.courses where id=${computation}`,
    ).rejects.toMatchObject({ code: "23001" });
    await expect(
      asUser(
        actor,
        `update public.profiles set course_id='${administration}' where user_id='${actor}'`,
      ),
    ).rejects.toThrow(/permission denied/);
  });
  it("renames and deactivates without rewriting legacy text or losing references", async () => {
    await saveCourse(admin, {
      id: computation,
      name: "Bacharelado em Computação",
      status: "inactive",
    });
    const result = await searchNetworks(actor, { q: "Ana" });
    expect(result.students[0].course).toBe("Bacharelado em Computação");
    expect(result.courses.some((item) => item.id === computation)).toBe(false);
    expect(
      (
        await state.sql`select course from public.profiles where id=${uid(1)}`
      )[0].course,
    ).toBe(" COMPUTAÇÃO ");
    await expect(
      state.sql`update private.institution_students set course_id=${computation} where auth_user_id=${uid(2)}`,
    ).rejects.toMatchObject({ code: "23514" });
    await saveCourse(admin, {
      id: computation,
      name: "Computação",
      status: "active",
    });
  });
});
describe("catalog-aware import", () => {
  it("reports unknown/inactive courses without creating records", async () => {
    const before = await state.sql`select id from public.courses`;
    const unknown = await previewImport(
      admin,
      await workbook("Curso inexistente"),
      "alunos.xlsx",
    );
    expect(unknown.valid).toBe(0);
    expect(unknown.lines[0].errors.join(" ")).toContain("Cadastre o curso");
    await saveCourse(admin, {
      id: computation,
      name: "Computação",
      status: "inactive",
    });
    const inactive = await previewImport(
      admin,
      await workbook("Computação"),
      "alunos.xlsx",
    );
    expect(inactive.lines[0].errors).toContain(
      "O curso informado está inativo.",
    );
    expect(await state.sql`select id from public.courses`).toHaveLength(
      before.length,
    );
    expect(await state.sql`select id from private.import_batches`).toHaveLength(
      0,
    );
    await saveCourse(admin, {
      id: computation,
      name: "Computação",
      status: "active",
    });
  });
  it("accepts optional blank courses and revalidates changes after preview", async () => {
    expect(
      (await previewImport(admin, await workbook(""), "alunos.xlsx")).valid,
    ).toBe(1);
    const file = await workbook("  COMPUTAÇÃO ");
    const preview = await previewImport(admin, file, "alunos.xlsx");
    expect(preview.lines[0]).toMatchObject({
      course: "Computação",
      course_id: computation,
      errors: [],
    });
    await saveCourse(admin, {
      id: computation,
      name: "Computação",
      status: "inactive",
    });
    await expect(
      confirmImport(admin, file, "alunos.xlsx", preview.receipt),
    ).rejects.toThrow("mudaram desde a prévia");
    await saveCourse(admin, {
      id: computation,
      name: "Computação",
      status: "active",
    });
    await confirmImport(
      admin,
      file,
      "alunos.xlsx",
      (await previewImport(admin, file, "alunos.xlsx")).receipt,
    );
    expect(
      (
        await state.sql`select course,course_id from private.institution_students where ra='009999'`
      )[0],
    ).toEqual({ course: null, course_id: computation });
  });
});
describe("Networks queries with actual RLS", () => {
  it("preserves social editing and synchronizes institutional course references", async () => {
    await saveProfile(actor, {
      username: "person_0",
      bio: "Perfil preservado",
      skills: ["React"],
      interests: ["Jogos"],
    });
    expect(
      (
        await state.sql`select course_id,bio from public.profiles where id=${actor}`
      )[0],
    ).toMatchObject({ course_id: computation, bio: "Perfil preservado" });
    await state.sql`update private.institution_students set course_id=${administration} where auth_user_id=${actor}`;
    expect(
      (
        await state.sql`select course_id from public.profiles where id=${actor}`
      )[0].course_id,
    ).toBe(administration);
    await state.sql`update private.institution_students set course_id=${computation} where auth_user_id=${actor}`;
  });
  it("paginates alphabetically and excludes self, incomplete and inactive profiles", async () => {
    const first = await searchNetworks(actor, {}),
      second = await searchNetworks(actor, { page: "2" });
    expect(first.total).toBe(27);
    expect(first.students).toHaveLength(24);
    expect(second.students).toHaveLength(3);
    const all = [...first.students, ...second.students];
    expect(new Set(all.map((item) => item.id)).size).toBe(27);
    for (const index of [0, 3, 4, 5])
      expect(all.some((item) => item.id === uid(index))).toBe(false);
    expect(first.students[0].name).toBe("Ana Silva");
    expect(first.students[1].name).toBe("Bia Souza");
    expect((await searchNetworks(actor, { page: "10000" })).total).toBe(27);
  });
  it.each(["Ana", "person_1", "React"])(
    "searches name, username or skill: %s",
    async (q) => {
      const result = await searchNetworks(actor, { q });
      expect(result.students.some((student) => student.id === uid(1))).toBe(
        true,
      );
      if (q !== "person_1") expect(result.total).toBe(1);
    },
  );
  it("combines course, semester, skill and interest with AND", async () => {
    expect(
      (await searchNetworks(actor, { course: administration })).total,
    ).toBe(1);
    expect((await searchNetworks(actor, { semester: "8" })).total).toBe(1);
    expect(
      (await searchNetworks(actor, { skill: python })).students[0].id,
    ).toBe(uid(2));
    expect((await searchNetworks(actor, { interest: games })).total).toBe(1);
    const filters = {
      course: computation,
      semester: "8",
      skill: react,
      interest: games,
    };
    expect((await searchNetworks(actor, filters)).students[0].id).toBe(uid(1));
    expect(
      (await searchNetworks(actor, { ...filters, course: administration }))
        .total,
    ).toBe(0);
  });
  it("rejects invalid input and treats SQL wildcard characters literally", async () => {
    expect(
      (await searchNetworks(actor, { course: "invalid" })).error,
    ).toBeTruthy();
    expect((await searchNetworks(actor, { q: "%" })).total).toBe(0);
    expect((await searchNetworks(actor, { q: "' OR true --" })).total).toBe(0);
  });
  it("denies admin-only and blocked viewers at the database boundary", async () => {
    await expect(searchNetworks(admin, {})).rejects.toThrow("denied");
    await expect(searchNetworks(uid(4), {})).rejects.toThrow("denied");
    expect(await asUser(uid(4), "select id from public.courses")).toHaveLength(
      0,
    );
    expect(await asUser(admin, "select id from public.profiles")).toHaveLength(
      0,
    );
  });
  it("signs avatars in one batch and serializes no private fields", async () => {
    state.signed.mockResolvedValueOnce({
      data: [
        {
          path: `${uid(1)}/avatar.png`,
          signedUrl: "https://storage.example/signed",
        },
      ],
      error: null,
    });
    const result = await getNetworks({ q: "React" });
    expect(state.signed).toHaveBeenLastCalledWith(
      [`${uid(1)}/avatar.png`],
      300,
    );
    expect(result.students[0].avatar_url).toBe(
      "https://storage.example/signed",
    );
    for (const field of [
      "email",
      "phone",
      "birth_date",
      "cpf",
      "cpf_fingerprint",
      "auth_user_id",
      "user_id",
    ])
      expect(result.students[0]).not.toHaveProperty(field);
    expect(JSON.stringify(result)).not.toContain("@example.test");
    state.signed.mockResolvedValueOnce({
      data: null,
      error: { message: "denied" },
    });
    expect(
      (await getNetworks({ q: "React" })).students[0].avatar_url,
    ).toBeNull();
  });
});
