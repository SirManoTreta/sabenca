import {
  test as base,
  expect as baseExpect,
  type Page,
} from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import ExcelJS from "exceljs";
import { readFileSync } from "node:fs";
import { randomUUID, randomInt, createHash } from "node:crypto";

type Fixture = {
  ra: string;
  email: string;
  password: string;
  username: string;
  courseId: string;
  courseName: string;
  token: string;
  makePeer: () => Promise<{ username: string; name: string }>;
  grantAdmin: () => Promise<void>;
  block: () => Promise<void>;
};
const test = base.extend<{ fixture: Fixture }>({
  fixture: async ({}, provide) => {
    const sql = postgres(process.env.DATABASE_URL!, {
      ssl: {
        rejectUnauthorized: true,
        ca: process.env.DATABASE_SSL_CA_FILE
          ? readFileSync(process.env.DATABASE_SSL_CA_FILE, "utf8")
          : undefined,
      },
      prepare: false,
      max: 1,
      onnotice: () => {},
    });
    const auth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const token = randomUUID().replaceAll("-", "").slice(0, 16),
      password = `${randomUUID()}Aa1!`;
    const courseId = randomUUID(),
      courseName = `Curso Networks ${token}`;
    const users: string[] = [],
      students: string[] = [];
    const makeMember = async (name: string) => {
      const suffix = randomUUID().replaceAll("-", "").slice(0, 16);
      const studentId = randomUUID(),
        email = `networks-${suffix}@example.com`,
        ra = `e2e${suffix}`,
        username = `e2e_${suffix}`;
      await sql`insert into private.institution_students(id,institution_id,ra,name,email,phone,birth_date,cpf_fingerprint,course_id,semester)
        values (${studentId},'fatece',${ra},${name},${email},'5511999999999','2000-01-01',${createHash("sha256").update(suffix).digest("hex")},${courseId},8)`;
      students.push(studentId);
      const created = await auth.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (created.error || !created.data.user)
        throw new Error("Could not create synthetic member");
      const userId = created.data.user.id;
      users.push(userId);
      await sql`update private.institution_students set auth_user_id=${userId},status='active',activated_at=now() where id=${studentId}`;
      const [profile] =
        await sql`insert into public.profiles(user_id,username,name,course_id,semester,institution,institution_id)
        values (${userId},${username},${name},${courseId},8,'FATECE','fatece') returning id`;
      return {
        ra,
        email,
        username,
        userId,
        profileId: profile.id as string,
        name,
      };
    };
    try {
      await sql`insert into public.courses(id,institution_id,name) values (${courseId},'fatece',${courseName})`;
      const member = await makeMember(`Estudante Networks ${token}`);
      await provide({
        ...member,
        token,
        password,
        courseId,
        courseName,
        makePeer: async () => {
          const peer = await makeMember(`Ana Networks ${token}`);
          await sql`insert into public.profile_skills(profile_id,skill_id) select ${peer.profileId},id from public.skills where name='React'`;
          await sql`insert into public.profile_interests(profile_id,interest_id) select ${peer.profileId},id from public.interests where name='Jogos'`;
          const path = `${peer.userId}/e2e.png`;
          const png = Buffer.from(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1cAAAAASUVORK5CYII=",
            "base64",
          );
          const uploaded = await auth.storage
            .from("avatars")
            .upload(path, png, { contentType: "image/png" });
          if (uploaded.error) throw uploaded.error;
          await sql`update public.profiles set avatar_url=${path} where id=${peer.profileId}`;
          return peer;
        },
        grantAdmin: async () => {
          await sql`insert into private.admin_users(user_id,institution_id) values (${member.userId},'fatece')`;
        },
        block: async () => {
          await sql`update private.institution_students set status='blocked' where auth_user_id=${member.userId}`;
        },
      });
    } finally {
      // Cleanup is restricted to IDs allocated by this fixture and its import batches.
      for (const userId of users) {
        await auth.storage.from("avatars").remove([`${userId}/e2e.png`]);
        await sql`delete from private.institution_students where import_batch_id in (select id from private.import_batches where uploaded_by=${userId})`;
        await sql`delete from private.import_batches where uploaded_by=${userId}`;
      }
      if (students.length)
        await sql`delete from private.institution_students where id in ${sql(students)}`;
      for (const userId of users) {
        const removed = await auth.auth.admin.deleteUser(userId);
        if (removed.error) throw removed.error;
      }
      await sql`delete from public.courses where id=${courseId} or name=${`Curso criado ${token}`} or name=${`Curso renomeado ${token}`}`;
      await sql.end();
    }
  },
});
test.skip(
  process.env.SABENCA_E2E_INTEGRATION !== "1",
  "Requires integration opt-in and isolated synthetic accounts.",
);
test.setTimeout(180_000);
const expect = baseExpect.configure({ timeout: 20_000 });
async function login(page: Page, fixture: Fixture) {
  await page.goto("/auth/login");
  await page
    .getByLabel("RA (registro acadêmico)", { exact: true })
    .fill(fixture.ra);
  await page.getByLabel("Senha", { exact: true }).fill(fixture.password);
  await page
    .getByRole("button", { name: "Entrar no SABENÇA", exact: true })
    .click();
  await expect(page).toHaveURL(/\/marketplace$/);
}
test("Networks searches, filters, opens a private profile and preserves URL on return", async ({
  page,
  fixture,
}, info) => {
  const peer = await fixture.makePeer();
  await login(page, fixture);
  await page.getByRole("link", { name: "Networks", exact: true }).click();
  await page
    .getByLabel("Buscar por nome, username ou habilidade")
    .fill("React");
  await page
    .getByLabel("Curso", { exact: true })
    .selectOption(fixture.courseId);
  await page
    .getByLabel("Habilidade", { exact: true })
    .selectOption({ label: "React" });
  await page
    .getByLabel("Interesse", { exact: true })
    .selectOption({ label: "Jogos" });
  await page.getByLabel("Semestre", { exact: true }).selectOption("8");
  const response = page.waitForResponse(
    (res) =>
      res.url().includes("/networks?") && res.request().isNavigationRequest(),
  );
  await page.getByRole("button", { name: "Buscar estudantes" }).click();
  const headers = (await response).headers();
  expect(headers["cache-control"]).toContain("no-store");
  await expect(page.getByRole("status")).toHaveText("1 estudante encontrado");
  await expect(page.locator("article")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: peer.name })).toBeVisible();
  await expect(page.getByAltText(`Foto de ${peer.name}`)).toBeVisible();
  await expect
    .poll(() =>
      page
        .getByAltText(`Foto de ${peer.name}`)
        .evaluate((img) => (img as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);
  expect(
    await page.locator('meta[name="robots"]').getAttribute("content"),
  ).toContain("noindex");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const html = await page.content();
  for (const secret of [
    fixture.email,
    fixture.ra,
    "cpf_fingerprint",
    "birth_date",
    "auth_user_id",
  ])
    expect(html).not.toContain(secret);
  await page.screenshot({
    path: info.outputPath("networks.png"),
    fullPage: true,
  });
  const url = page.url();
  await page.getByRole("link", { name: `Ver perfil de ${peer.name}` }).click();
  await expect(page).toHaveURL(new RegExp(`/users/${peer.username}$`));
  await expect(
    page.getByText(`${fixture.courseName} · 8º semestre`, { exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(url);
  await expect(page.getByLabel("Curso", { exact: true })).toHaveValue(
    fixture.courseId,
  );
  await fixture.block();
  await page.goto("/networks");
  await expect(page).toHaveURL(/\/auth\/acesso-negado$/);
});
test("admin manages courses, downloads the official workbook and imports a student", async ({
  page,
  fixture,
}, info) => {
  await fixture.grantAdmin();
  await page.goto("/auth/admin");
  await page
    .getByLabel("E-mail administrativo", { exact: true })
    .fill(fixture.email);
  await page.getByLabel("Senha", { exact: true }).fill(fixture.password);
  await page.getByRole("button", { name: /Entrar/ }).click();
  await expect(page).toHaveURL(/\/admin\/alunos$/);
  await page.getByRole("link", { name: "Cursos", exact: true }).click();
  // The creation form has stable IDs; every edit form uses its course UUID.
  await page.locator("#name-new").fill(`Curso criado ${fixture.token}`);
  await page.getByRole("button", { name: "Cadastrar curso" }).click();
  const summary = page
    .locator("summary")
    .filter({ hasText: `Curso criado ${fixture.token}` });
  await expect(summary).toBeVisible();
  await summary.click();
  const edit = page.locator("details").filter({ has: summary });
  await edit
    .getByLabel("Nome do curso")
    .fill(`Curso renomeado ${fixture.token}`);
  await edit.getByRole("button", { name: "Salvar curso" }).click();
  const updated = page
    .locator("summary")
    .filter({ hasText: `Curso renomeado ${fixture.token}` });
  await expect(updated).toBeVisible();
  await updated.click();
  const updatedForm = page.locator("details").filter({ has: updated });
  await updatedForm.getByLabel("Situação do curso").selectOption("inactive");
  await updatedForm.getByRole("button", { name: "Salvar curso" }).click();
  await expect(updated).toContainText("Inativo");
  await page
    .getByRole("link", { name: "Importar planilha", exact: true })
    .click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Baixar modelo de planilha" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(
    "modelo-importacao-alunos-sabenca.xlsx",
  );
  const buffer = readFileSync((await download.path())!);
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  expect(book.worksheets[0].actualRowCount).toBe(1);
  const digits = String(randomInt(100000000, 999999999)).split("").map(Number);
  for (const count of [9, 10]) {
    const remainder =
      (digits.reduce(
        (sum, digit, index) => sum + digit * (count + 1 - index),
        0,
      ) *
        10) %
      11;
    digits.push(remainder === 10 ? 0 : remainder);
  }
  book.worksheets[0].addRow([
    `import${fixture.token}`,
    "Aluno Importado E2E",
    `import-${fixture.token}@example.com`,
    "19999999999",
    "14/05/2000",
    digits.join(""),
    fixture.courseName,
    8,
  ]);
  await page.getByLabel("Selecione a planilha de alunos").setInputFiles({
    name: "alunos.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: Buffer.from(await book.xlsx.writeBuffer()),
  });
  await page.getByRole("button", { name: "Analisar planilha" }).click();
  await expect(
    page.getByText("Pronto para importar", { exact: true }),
  ).toBeVisible();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Confirmar importação" }).click();
  await expect(page.getByRole("status")).toContainText(
    "1 aluno(s) registrado(s)",
  );
  await page
    .getByRole("link", { name: "Alunos cadastrados", exact: true })
    .click();
  await page
    .getByLabel("Pesquisar aluno por RA ou nome")
    .fill(`import${fixture.token}`);
  await page.getByRole("button", { name: "Pesquisar", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: `${fixture.courseName} · 8º`, exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath("admin-import.png"),
    fullPage: true,
  });
});
