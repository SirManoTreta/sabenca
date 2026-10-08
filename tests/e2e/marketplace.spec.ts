import {
  test as base,
  expect as baseExpect,
  type Page,
} from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import { readFileSync } from "node:fs";
import { randomUUID, createHash } from "node:crypto";
type Member = {
  userId: string;
  profileId: string;
  studentId: string;
  ra: string;
  email: string;
  password: string;
  name: string;
};
type Fixture = {
  a: Member;
  b: Member;
  token: string;
  sql: ReturnType<typeof postgres>;
};
const test = base.extend<{ fixture: Fixture }>({
  fixture: async ({}, provide) => {
    const ref = "fidndjlresfxvmerkbhs";
    if (
      new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname !==
      `${ref}.supabase.co`
    )
      throw new Error("Marketplace fixtures require confirmed Supabase DEV");
    const database = new URL(process.env.DATABASE_URL!);
    if (
      database.hostname !== `db.${ref}.supabase.co` &&
      decodeURIComponent(database.username) !== `postgres.${ref}`
    )
      throw new Error("Marketplace database must be DEV");
    const sql = postgres(process.env.DATABASE_URL!, {
      ssl: {
        rejectUnauthorized: true,
        ca: readFileSync(process.env.DATABASE_SSL_CA_FILE!, "utf8"),
      },
      prepare: false,
      max: 1,
      onnotice: () => {},
    });
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const token = randomUUID().replaceAll("-", "").slice(0, 16),
      courseId = randomUUID();
    const members: Member[] = [];
    async function makeMember(label: string) {
      if (members.length >= 2)
        throw new Error("At most two temporary DEV members permitted");
      const suffix = randomUUID().replaceAll("-", "");
      const member: Member = {
        userId: "",
        profileId: "",
        studentId: randomUUID(),
        ra: `mkt${suffix.slice(0, 16)}`,
        email: `marketplace-${suffix}@example.com`,
        password: `${randomUUID()}Aa1!`,
        name: `${label} Mercado ${token}`,
      };
      members.push(member);
      await sql`insert into private.institution_students(id,institution_id,ra,name,email,phone,birth_date,cpf_fingerprint,course_id,semester) values (${member.studentId},'fatece',${member.ra},${member.name},${member.email},'5511999999999','2000-01-01',${createHash("sha256").update(suffix).digest("hex")},${courseId},8)`;
      const created = await admin.auth.admin.createUser({
        email: member.email,
        password: member.password,
        email_confirm: true,
      });
      if (created.error || !created.data.user)
        throw new Error("Could not create isolated DEV Auth fixture");
      member.userId = created.data.user.id;
      await sql`update private.institution_students set status='active',auth_user_id=${member.userId},activated_at=now() where id=${member.studentId}`;
      const [profile] =
        await sql`insert into public.profiles(user_id,name,course_id,semester,institution,institution_id) values (${member.userId},${member.name},${courseId},8,'FATECE','fatece') returning id`;
      member.profileId = profile.id as string;
      return member;
    }
    try {
      await sql`insert into public.courses(id,institution_id,name) values (${courseId},'fatece',${`Curso Marketplace ${token}`})`;
      const a = await makeMember("Ana"),
        b = await makeMember("Beto");
      await provide({ a, b, token, sql });
    } finally {
      for (const member of members) {
        if (member.userId) {
          const objects = await admin.storage
            .from("listing-images")
            .list(member.userId);
          if (objects.error) throw objects.error;
          for (const folder of objects.data ?? []) {
            const prefix = `${member.userId}/${folder.name}`;
            const files = await admin.storage
              .from("listing-images")
              .list(prefix);
            if (files.error) throw files.error;
            const paths = (files.data ?? []).map((f) => `${prefix}/${f.name}`);
            if (paths.length) {
              const removed = await admin.storage
                .from("listing-images")
                .remove(paths);
              if (removed.error) throw removed.error;
            }
          }
        }
        await sql`delete from private.institution_students where id=${member.studentId}`;
        if (member.userId) {
          const removed = await admin.auth.admin.deleteUser(member.userId);
          if (removed.error) throw removed.error;
        }
      }
      await sql`delete from public.courses where id=${courseId}`;
      await sql.end();
    }
  },
});
test.skip(
  process.env.SABENCA_E2E_INTEGRATION !== "1",
  "Requires explicit synthetic DEV fixture opt-in",
);
test.setTimeout(240000);
const expect = baseExpect.configure({ timeout: 20000 });
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1cAAAAASUVORK5CYII=",
  "base64",
);
async function login(page: Page, member: Member) {
  await page.goto("/auth/login");
  await page
    .getByLabel("RA (registro acadêmico)", { exact: true })
    .fill(member.ra);
  await page.getByLabel("Senha", { exact: true }).fill(member.password);
  await page
    .getByRole("button", { name: "Entrar no SABENÇA", exact: true })
    .click();
  await expect(page).toHaveURL(/\/marketplace$/);
}
test("Marketplace publishes private images, integrates seller profile, enforces ownership and manages status", async ({
  page,
  browser,
  fixture,
}, info) => {
  const { a, b, token, sql } = fixture;
  await login(page, a);
  await page.getByRole("link", { name: "Criar anúncio", exact: true }).click();
  await page.getByLabel("Título do anúncio").fill(`Livro E2E ${token}`);
  await page
    .getByLabel("Descrição", { exact: true })
    .fill("Livro de cálculo para estudantes.");
  await page.getByLabel("Preço (R$)", { exact: true }).fill("45,50");
  await page
    .getByLabel("Categoria", { exact: true })
    .selectOption({ label: "Livros" });
  await page.getByLabel("Condição", { exact: true }).selectOption("used");
  await page.getByLabel("Imagens do anúncio (opcional)").setInputFiles([
    { name: "capa.png", mimeType: "image/png", buffer: png },
    { name: "segunda.png", mimeType: "image/png", buffer: png },
  ]);
  await page
    .getByRole("button", { name: "Publicar anúncio", exact: true })
    .click();
  await expect(page).toHaveURL(/\/marketplace\/[0-9a-f-]{36}$/);
  const id = new URL(page.url()).pathname.split("/").at(-1)!;
  await expect(
    page.getByRole("heading", { name: `Livro E2E ${token}`, exact: true }),
  ).toBeVisible();
  await expect(page.getByAltText(`Imagem de Livro E2E ${token}`)).toHaveCount(
    2,
  );
  await expect
    .poll(() =>
      page
        .getByAltText(`Imagem de Livro E2E ${token}`)
        .first()
        .evaluate((img: HTMLImageElement) => img.naturalWidth),
    )
    .toBeGreaterThan(0);
  const [{ image_url: path }] =
    await sql`select image_url from public.listing_images where listing_id=${id} order by position limit 1`;
  await page.getByRole("link", { name: "Ver perfil", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/users/id/${a.profileId}$`));
  await expect(
    page.getByRole("heading", { name: "Anúncios", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: `Livro E2E ${token}`, exact: true }),
  ).toBeVisible();
  const peer = await browser.newContext({
    storageState: info.project.use.storageState,
    viewport: info.project.use.viewport,
  });
  try {
    const peerPage = await peer.newPage();
    await login(peerPage, b);
    await peerPage.goto(`/marketplace/${id}`);
    await expect(
      peerPage.getByRole("link", { name: "Ver perfil", exact: true }),
    ).toBeVisible();
    await expect(
      peerPage.getByRole("link", { name: "Editar anúncio", exact: true }),
    ).toHaveCount(0);
    await peerPage.goto(`/marketplace/${id}/editar`);
    await expect(
      peerPage.getByRole("heading", { name: "Anúncio indisponível" }),
    ).toBeVisible();
    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    expect(
      (
        await client.auth.signInWithPassword({
          email: b.email,
          password: b.password,
        })
      ).error,
    ).toBeNull();
    expect(
      (
        await client
          .from("listings")
          .update({ title: "Ataque" })
          .eq("id", id)
          .select("id")
      ).data,
    ).toEqual([]);
    expect(
      (await client.from("listings").delete().eq("id", id).select("id")).data,
    ).toEqual([]);
    expect(
      (
        await client.storage
          .from("listing-images")
          .update(path as string, png, { contentType: "image/png" })
      ).error,
    ).toBeTruthy();
    expect(
      (
        await client.storage
          .from("listing-images")
          .upload(`${b.userId}/${id}/${randomUUID()}.png`, png, {
            contentType: "image/png",
          })
      ).error,
    ).toBeTruthy();
    expect(
      (
        await client.from("listing_images").insert({
          listing_id: id,
          image_url: `${b.userId}/${id}/${randomUUID()}.png`,
          position: 2,
        })
      ).error,
    ).toBeTruthy();
    // End the API-only session without revoking the peer browser session.
    await client.auth.signOut({ scope: "local" });
    await page.goto(`/marketplace/${id}/editar`);
    await page.getByLabel("Título do anúncio").fill(`Livro editado ${token}`);
    await page
      .getByRole("button", { name: "Salvar alterações", exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`/marketplace/${id}$`));
    await page
      .getByRole("link", { name: "Editar anúncio", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Remover imagem", exact: true })
      .first()
      .click();
    await expect(
      page.getByRole("button", { name: "Remover imagem", exact: true }),
    ).toHaveCount(1);
    expect(
      (
        await sql`select position from public.listing_images where listing_id=${id}`
      )[0].position,
    ).toBe(0);
    await page.goto(`/marketplace/${id}`);
    await page
      .getByRole("button", { name: "Marcar como vendido", exact: true })
      .click();
    await expect(page.getByText("Vendido", { exact: true })).toBeVisible();
    await peerPage.goto(`/marketplace/${id}`);
    await expect(
      peerPage.getByRole("heading", { name: "Anúncio indisponível" }),
    ).toBeVisible();
    await page.goto("/marketplace/meus-anuncios");
    await page.getByLabel("Status", { exact: true }).selectOption("sold");
    await page
      .getByRole("button", { name: "Pesquisar e filtrar", exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        name: `Livro editado ${token}`,
        exact: true,
      }),
    ).toBeVisible();
    await page.goto(`/marketplace/${id}`);
    await page
      .getByRole("button", { name: "Reativar anúncio", exact: true })
      .click();
    await expect(page.getByText("Disponível", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Desativar", exact: true }).click();
    await expect(page.getByText("Inativo", { exact: true })).toBeVisible();
    await page
      .getByRole("button", { name: "Reativar anúncio", exact: true })
      .click();
    await page.goto("/marketplace");
    await page.getByLabel("Buscar anúncios").fill(token);
    await page
      .getByLabel("Categoria", { exact: true })
      .selectOption({ label: "Livros" });
    await page.getByLabel("Condição", { exact: true }).selectOption("used");
    await page.getByLabel("Preço mínimo (R$)").fill("40");
    await page.getByLabel("Preço máximo (R$)").fill("50");
    await page.getByLabel("Ordenar por").selectOption("price_asc");
    await page
      .getByRole("button", { name: "Pesquisar e filtrar", exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        name: `Livro editado ${token}`,
        exact: true,
      }),
    ).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Buscar anúncios")).toHaveValue(token);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath("marketplace.png"),
      fullPage: true,
    });
    await page.goto(`/marketplace/${id}`);
    await page.getByLabel("Confirmo a exclusão deste anúncio.").check();
    await page
      .getByRole("button", { name: "Excluir anúncio", exact: true })
      .click();
    await expect(page).toHaveURL(/\/marketplace\/meus-anuncios$/);
    expect(
      await sql`select id from public.listings where id=${id}`,
    ).toHaveLength(0);
    expect(
      await sql`select id from storage.objects where bucket_id='listing-images' and name like ${`${a.userId}/${id}/%`}`,
    ).toHaveLength(0);
    await peerPage.goto("/marketplace/novo");
    await peerPage.getByLabel("Título do anúncio").fill(`Serviço E2E ${token}`);
    await peerPage
      .getByLabel("Descrição", { exact: true })
      .fill("Aulas de programação e desenvolvimento de sites.");
    await peerPage.getByLabel("Preço (R$)", { exact: true }).fill("100,00");
    await peerPage
      .getByLabel("Categoria", { exact: true })
      .selectOption({ label: "Serviços" });
    await expect(peerPage.getByLabel("Condição", { exact: true })).toHaveCount(
      0,
    );
    await peerPage
      .getByRole("button", { name: "Publicar anúncio", exact: true })
      .click();
    await expect(peerPage).toHaveURL(/\/marketplace\/[0-9a-f-]{36}$/);
    await expect(peerPage.getByText("Condição:", { exact: false })).toHaveCount(
      0,
    );
    await peerPage.getByRole("button", { name: "Sair", exact: true }).click();
    await expect(peerPage).toHaveURL(/\/auth\/login$/);
    await peerPage.goto(`/marketplace/${id}`);
    await expect(peerPage).toHaveURL(/\/auth\/login$/);
  } finally {
    await peer.close();
  }
});
