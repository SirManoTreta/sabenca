import { test as base, expect as baseExpect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import { readFileSync } from "node:fs";
import { randomUUID, createHash } from "node:crypto";

// Explicit opt-in: these tests create and remove isolated, synthetic students
// in the configured Supabase. No e-mails are sent and no existing account is used.
type Student = {
  id: string;
  ra: string;
  username: string;
  password: string;
  setBlocked: (blocked: boolean) => Promise<void>;
};
const test = base.extend<{ student: Student }>({
  student: async ({}, provide) => {
    const databaseUrl = process.env.DATABASE_URL;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY;
    if (!databaseUrl || !url || !key)
      throw new Error("Configure the integration environment first.");
    const sql = postgres(databaseUrl, {
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
    const admin = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const token = randomUUID().replaceAll("-", "");
    const studentId = randomUUID();
    const email = `sabenca-e2e-${token}@example.com`;
    const ra = `e2e${token.slice(0, 16)}`;
    const username = `e2e_${token.slice(0, 16)}`;
    const password = `${randomUUID()}Aa1!`;
    let userId: string | undefined;
    try {
      await sql`insert into private.institution_students(id,institution_id,ra,name,email,phone,birth_date,cpf_fingerprint,course,semester)
        values (${studentId},'fatece',${ra},'Estudante de teste Fase 2',${email},'5511999999999','2000-01-01',${createHash("sha256").update(token).digest("hex")},'Ciência da Computação',8)`;
      const created = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (created.error || !created.data.user)
        throw new Error("Unable to create isolated Auth fixture");
      userId = created.data.user.id;
      await sql`update private.institution_students set auth_user_id=${userId},status='active',activated_at=now() where id=${studentId}`;
      await sql`insert into public.profiles(user_id,name,course,semester,institution) values (${userId},'Estudante de teste Fase 2','Ciência da Computação',8,'FATECE')`;
      await provide({
        id: userId,
        ra,
        username,
        password,
        setBlocked: async (blocked) => {
          await sql`update private.institution_students set status=${blocked ? "blocked" : "active"} where id=${studentId}`;
        },
      });
    } finally {
      // Remove only objects under the account created by this fixture.
      if (userId) {
        for (const bucket of ["avatars", "project-images"]) {
          async function cleanupFolder(folder: string) {
            const { data, error } = await admin.storage
              .from(bucket)
              .list(folder);
            if (error) throw error;
            for (const entry of data ?? []) {
              const path = `${folder}/${entry.name}`;
              if (!entry.id) await cleanupFolder(path);
              else {
                const removed = await admin.storage.from(bucket).remove([path]);
                if (removed.error) throw removed.error;
              }
            }
          }
          await cleanupFolder(userId);
        }
      }
      await sql`delete from private.institution_students where id=${studentId}`;
      if (userId) {
        const removed = await admin.auth.admin.deleteUser(userId);
        if (removed.error) throw removed.error;
      }
      // The only newly created catalog names in this fixture carry its random ID.
      await sql`delete from public.skills where name=${`Skill ${token.slice(0, 16)}`} and not exists (select 1 from public.profile_skills where skill_id=skills.id)`;
      await sql`delete from public.interests where name=${`Interesse ${token.slice(0, 16)}`} and not exists (select 1 from public.profile_interests where interest_id=interests.id)`;
      await sql.end();
    }
  },
});
test.skip(
  process.env.SABENCA_E2E_INTEGRATION !== "1",
  "Requires explicit integration opt-in and Supabase server credentials.",
);
test.setTimeout(180_000);
const expect = baseExpect.configure({ timeout: 20_000 });

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1cAAAAASUVORK5CYII=",
  "base64",
);
test("student edits profile, labels, private images and project portfolio", async ({
  page,
  student,
}, testInfo) => {
  await page.goto("/auth/login");
  await page
    .getByLabel("RA (registro acadêmico)", { exact: true })
    .fill(student.ra);
  await page.getByLabel("Senha", { exact: true }).fill(student.password);
  await page
    .getByRole("button", { name: "Entrar no SABENÇA", exact: true })
    .click();
  await expect(page).toHaveURL(/\/marketplace$/);
  await page.getByRole("link", { name: "Meu perfil", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Estudante de teste Fase 2" }),
  ).toBeVisible();
  await expect(
    page.getByText("Nenhuma habilidade adicionada ainda."),
  ).toBeVisible();
  await page.getByRole("link", { name: "Editar perfil", exact: true }).click();
  await page.getByLabel("Username", { exact: true }).fill(student.username);
  await page
    .getByLabel("Sobre mim", { exact: true })
    .fill("Criando projetos e aprendendo com a comunidade.");
  await page.getByLabel("Pesquisar habilidades").fill("React");
  await page.getByRole("button", { name: "React", exact: true }).click();
  const suffix = student.username.slice(4);
  await page.getByLabel("Pesquisar habilidades").fill(`Skill ${suffix}`);
  await page
    .getByRole("button", { name: `Criar “Skill ${suffix}”`, exact: true })
    .click();
  await page.getByLabel("Pesquisar interesses").fill("Jogos");
  await page.getByRole("button", { name: "Jogos", exact: true }).click();
  await page
    .getByRole("button", { name: "Salvar perfil", exact: true })
    .click();
  await expect(
    page.getByText("Perfil atualizado.", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Escolher foto de perfil")
    .setInputFiles({ name: "avatar.png", mimeType: "image/png", buffer: png });
  await page.getByRole("button", { name: "Salvar foto", exact: true }).click();
  await expect(
    page.getByText("Foto de perfil atualizada.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByAltText("Foto de Estudante de teste Fase 2"),
  ).toBeVisible();
  await page.getByRole("link", { name: "Voltar ao perfil" }).click();
  await expect(
    page.getByText(`@${student.username}`, { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("React", { exact: true })).toBeVisible();
  await expect(page.getByText("Jogos", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Adicionar projeto" }).click();
  await page.getByLabel("Título do projeto").fill("Meu primeiro projeto");
  await page
    .getByLabel("Descrição", { exact: true })
    .fill("Um experimento para compartilhar conhecimento.");
  await page.getByLabel("URL do projeto").fill("https://example.com/projeto");
  await page
    .getByLabel("Imagem do projeto")
    .setInputFiles({ name: "project.png", mimeType: "image/png", buffer: png });
  await page
    .getByRole("button", { name: "Criar projeto", exact: true })
    .click();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(
    page.getByRole("heading", { name: "Meu primeiro projeto" }),
  ).toBeVisible();
  await expect(
    page.getByAltText("Imagem de Meu primeiro projeto"),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("perfil.png"),
    fullPage: true,
  });
  await page
    .getByRole("link", { name: "Ver meu perfil na comunidade" })
    .click();
  await expect(page).toHaveURL(new RegExp(`/users/${student.username}$`));
  await expect(
    page.getByRole("link", { name: "Editar perfil", exact: true }),
  ).toHaveCount(0);
  const html = await page.content();
  for (const secret of [
    "cpf_fingerprint",
    "birth_date",
    "auth_user_id",
    "sabenca-e2e-",
    student.ra,
  ])
    expect(html).not.toContain(secret);
  await page.goto("/profile");
  await page.getByRole("link", { name: "Editar projeto", exact: true }).click();
  await page.getByLabel("Título do projeto").fill("Projeto atualizado");
  await page
    .getByRole("button", { name: "Salvar projeto", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Projeto atualizado" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Editar projeto", exact: true }).click();
  await page
    .getByRole("button", { name: "Excluir projeto", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirmar exclusão", exact: true })
    .click();
  await expect(
    page.getByText("Nenhum projeto adicionado ainda."),
  ).toBeVisible();
  await page.goto("/profile/edit");
  await page
    .getByRole("button", { name: "Remover React", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Remover Jogos", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Salvar perfil", exact: true })
    .click();
  await expect(
    page.getByText("Perfil atualizado.", { exact: true }),
  ).toBeVisible();
  await page.goto("/profile");
  await expect(page.getByText("React", { exact: true })).toHaveCount(0);
  await expect(
    page.getByText("Nenhum interesse adicionado ainda."),
  ).toBeVisible();
  await student.setBlocked(true);
  await page.goto(`/users/${student.username}`);
  await expect(page).toHaveURL(/\/auth\/acesso-negado$/);
  await page.goto("/profile/edit");
  await expect(page).toHaveURL(/\/auth\/acesso-negado$/);
});
