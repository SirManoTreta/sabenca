import { assertDevEnvironment } from "./dev-environment";
import {
  test as base,
  expect as baseExpect,
  type Page,
} from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import { readFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
type Member = {
  userId: string;
  profileId: string;
  ra: string;
  email: string;
  name: string;
  password: string;
  username: string;
  studentId: string;
};
type Fixture = {
  a: Member;
  b: Member;
  staff: Member;
  token: string;
  sql: ReturnType<typeof postgres>;
};
const test = base.extend<{ fixture: Fixture }>({
  fixture: async ({}, provide) => {
    assertDevEnvironment();
    const ref = "fidndjlresfxvmerkbhs",
      url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const dbUrl = new URL(process.env.DATABASE_URL!);
    if (
      url !== `https://${ref}.supabase.co` ||
      !(
        dbUrl.hostname === `db.${ref}.supabase.co` ||
        decodeURIComponent(dbUrl.username) === `postgres.${ref}`
      )
    )
      throw new Error("MVP fixtures require Supabase DEV exclusively");
    const sql = postgres(process.env.DATABASE_URL!, {
      ssl: {
        rejectUnauthorized: true,
        ca: readFileSync(process.env.DATABASE_SSL_CA_FILE!, "utf8"),
      },
      prepare: false,
      max: 1,
      onnotice() {},
    });
    const admin = createClient(url, process.env.SUPABASE_SECRET_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const token = randomUUID().replaceAll("-", "").slice(0, 12),
      members: Member[] = [];
    async function makeMember(label: string, staff = false) {
      const suffix = randomUUID().replaceAll("-", "");
      const m: Member = {
        userId: "",
        profileId: "",
        studentId: randomUUID(),
        ra: `mvp${suffix.slice(0, 16)}`,
        username: `mvp_${suffix.slice(0, 16)}`,
        email: `mvp-${suffix}@example.com`,
        name: `${label} MVP ${token}`,
        password: `${randomUUID()}Aa1!`,
      };
      members.push(m);
      if (staff)
        await sql`insert into private.admin_invitations(email,institution_id) values (${m.email},'fatece')`;
      else
        await sql`insert into private.institution_students(id,institution_id,ra,name,email,phone,birth_date,cpf_fingerprint,semester) values (${m.studentId},'fatece',${m.ra},${m.name},${m.email},'5511999999999','2000-01-01',${createHash("sha256").update(suffix).digest("hex")},8)`;
      const created = await admin.auth.admin.createUser({
        email: m.email,
        password: m.password,
        email_confirm: true,
      });
      if (created.error || !created.data.user)
        throw new Error("Unable to create MVP fixture");
      m.userId = created.data.user.id;
      if (staff) {
        await sql`insert into private.admin_users(user_id,institution_id) values (${m.userId},'fatece')`;
        await sql`delete from private.admin_invitations where email=${m.email}`;
      } else {
        await sql`update private.institution_students set auth_user_id=${m.userId},status='active',activated_at=now() where id=${m.studentId}`;
        const [p] =
          await sql`insert into public.profiles(user_id,username,name,bio,semester,institution,institution_id) values (${m.userId},${m.username},${m.name},${`Bio confidencial ${token}`},8,'FATECE','fatece') returning id`;
        m.profileId = p.id;
      }
      return m;
    }
    try {
      const a = await makeMember("Alfa"),
        b = await makeMember("Beta"),
        staff = await makeMember("Equipe", true);
      await provide({ a, b, staff, token, sql });
    } finally {
      for (const m of members) {
        if (m.userId) {
          for (const bucket of [
            "certificates",
            "listing-images",
            "avatars",
            "project-images",
          ]) {
            async function clean(folder: string) {
              const { data, error } = await admin.storage
                .from(bucket)
                .list(folder);
              if (error) throw new Error("MVP Storage cleanup failed");
              for (const e of data ?? []) {
                const path = `${folder}/${e.name}`;
                if (!e.id) await clean(path);
                else {
                  const r = await admin.storage.from(bucket).remove([path]);
                  if (r.error) throw new Error("MVP Storage removal failed");
                }
              }
            }
            await clean(m.userId);
          }
          await sql`delete from private.admin_access_events where actor_id=${m.userId} or target_id=${m.userId}`;
        }
        await sql`delete from private.admin_invitations where email=${m.email}`;
        await sql`delete from private.institution_students where id=${m.studentId}`;
      }
      for (const m of members)
        if (m.userId) {
          const r = await admin.auth.admin.deleteUser(m.userId);
          if (r.error) throw new Error("MVP Auth cleanup failed");
        }
      if (members.length) {
        const ids = members.filter((m) => m.userId).map((m) => m.userId);
        if (ids.length) {
          const [r] =
            await sql`select count(*)::integer as n from auth.users where id in ${sql(ids)}`;
          if (r.n) throw new Error("MVP fixture residue");
        }
      }
      await sql.end();
    }
  },
});
test.skip(
  process.env.SABENCA_E2E_INTEGRATION !== "1",
  "Requires isolated DEV integration fixtures and server credentials.",
);
test.use({ trace: "off" });
test.setTimeout(240000);
const expect = baseExpect.configure({ timeout: 20000 });
async function login(page: Page, m: Member, staff = false) {
  await page.goto(staff ? "/auth/admin" : "/auth/login");
  await page
    .getByLabel(staff ? "E-mail administrativo" : "RA (registro acadêmico)", {
      exact: true,
    })
    .fill(staff ? m.email : m.ra);
  await page.getByLabel("Senha", { exact: true }).fill(m.password);
  await page
    .getByRole("button", {
      name: staff ? "Entrar na administração" : "Entrar no SABENÇA",
      exact: true,
    })
    .click();
  await expect(page).toHaveURL(staff ? /\/admin\/alunos$/ : /\/marketplace$/);
}
async function fits(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1cAAAAASUVORK5CYII=",
  "base64",
);

test("certificate lifecycle, private files, admin management and review", async ({
  page,
  browser,
  fixture: f,
}) => {
  await login(page, f.a);
  await page.goto("/profile/certificados");
  const title = `Certificado MVP ${f.token}`;
  await page.getByLabel("Título", { exact: true }).fill(title);
  await page.getByLabel("Instituição emissora").fill("Universidade de teste");
  await page.getByLabel("Data de emissão").fill("2026-01-01");
  await page.getByLabel(/Documento privado \(PDF/).setInputFiles({
    name: "certificado.png",
    mimeType: "image/png",
    buffer: png,
  });
  await page
    .getByRole("button", { name: "Cadastrar certificado", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Status: Pendente de análise", { exact: true }),
  ).toBeVisible();
  const [cert] =
    await f.sql`select id from public.profile_certificates where user_id=${f.a.userId} and title=${title}`;
  const peerContext = await browser.newContext(),
    peer = await peerContext.newPage();
  const adminContext = await browser.newContext(),
    staff = await adminContext.newPage();
  try {
    await login(peer, f.b);
    await peer.goto(`/users/${f.a.username}`);
    await expect(
      peer.getByRole("heading", { name: title, exact: true }),
    ).toHaveCount(0);
    const denied = await peer.request.get(`/certificados/${cert.id}/documento`);
    expect(denied.status()).toBe(404);
    await peer.goto("/admin/administradores");
    await expect(peer).toHaveURL(/\/auth\/acesso-negado/);
    await login(staff, f.staff, true);
    await staff.goto("/admin/administradores");
    await staff
      .getByLabel("E-mail do novo administrador")
      .fill(` ${f.b.email.toUpperCase()} `);
    await staff
      .getByRole("button", { name: "Adicionar administrador", exact: true })
      .click();
    await expect(
      staff.getByText("Administrador adicionado. Use a senha já cadastrada.", {
        exact: true,
      }),
    ).toBeVisible();
    const adminCard = staff.getByRole("listitem").filter({
      has: staff.getByRole("heading", { name: f.b.email, exact: true }),
    });
    await adminCard
      .getByLabel("Confirmo revogar este acesso administrativo")
      .check();
    await adminCard
      .getByRole("button", { name: "Revogar acesso", exact: true })
      .click();
    await expect(
      staff.getByRole("heading", { name: f.b.email, exact: true }),
    ).toHaveCount(0);
    await staff.goto("/admin/certificados");
    const review = staff.getByRole("article").filter({
      has: staff.getByRole("heading", { name: title, exact: true }),
    });
    await review.getByLabel("Resultado da análise").selectOption("rejected");
    await review
      .getByLabel("Motivo da rejeição")
      .fill("Complementar dados do emissor.");
    await review
      .getByRole("button", { name: "Registrar análise", exact: true })
      .click();
    await expect(review.getByText(/Status: rejected/)).toBeVisible();
    await page.reload();
    await expect(
      page.getByText("Motivo: Complementar dados do emissor.", { exact: true }),
    ).toBeVisible();
    await review.getByLabel("Resultado da análise").selectOption("verified");
    await review
      .getByRole("button", { name: "Registrar análise", exact: true })
      .click();
    await expect(review.getByText(/Status: verified/)).toBeVisible();
    const response = await staff.request.get(
      `/certificados/${cert.id}/documento`,
      { maxRedirects: 0 },
    );
    expect(response.status()).toBe(307);
    expect(response.headers()["location"]).toContain(
      "/storage/v1/object/sign/certificates/",
    );
    await peer.goto(`/users/${f.a.username}`);
    await expect(
      peer.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    await expect(
      peer.getByText("Documento verificado pelo SABENÇA", { exact: true }),
    ).toBeVisible();
    expect(await peer.locator("body").textContent()).not.toContain("file_path");
    expect(await peer.locator("body").textContent()).not.toContain(
      "/storage/v1/object/sign/certificates/",
    );
    await page.reload();
    const own = page
      .getByRole("article")
      .filter({ has: page.getByRole("heading", { name: title, exact: true }) });
    await own.getByText("Editar certificado", { exact: true }).click();
    await own.getByLabel("Título", { exact: true }).fill(`${title} editado`);
    await own
      .getByRole("button", { name: "Salvar certificado", exact: true })
      .click();
    const edited = page
      .getByRole("article")
      .filter({
        has: page.getByRole("heading", {
          name: `${title} editado`,
          exact: true,
        }),
      });
    await expect(
      edited.getByText("Status: Pendente de análise", { exact: true }),
    ).toBeVisible();
    await edited
      .getByLabel("Confirmo excluir este certificado e seu documento")
      .check();
    await edited
      .getByRole("button", { name: "Excluir certificado", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: `${title} editado`, exact: true }),
    ).toHaveCount(0);
    expect(
      await f.sql`select id from storage.objects where bucket_id='certificates' and name like ${`${f.a.userId}/%`}`,
    ).toHaveLength(0);
    for (const width of [360, 390, 768, 1024, 1440]) {
      await staff.setViewportSize({ width, height: 900 });
      for (const route of [
        "/admin/administradores",
        "/admin/certificados",
        "/admin/denuncias",
      ]) {
        await staff.goto(route);
        await fits(staff);
      }
    }
  } finally {
    await peerContext.close();
    await adminContext.close();
  }
});

test("privacy, reporting, bilateral block and responsive community", async ({
  page,
  browser,
  fixture: f,
}) => {
  await login(page, f.a);
  await page.goto("/profile/privacidade");
  await page.getByLabel("Biografia", { exact: true }).uncheck();
  await page.getByLabel("Semestre", { exact: true }).uncheck();
  await page
    .getByRole("button", { name: "Salvar privacidade", exact: true })
    .click();
  await expect(
    page.getByText("Privacidade salva.", { exact: true }),
  ).toBeVisible();
  const peerContext = await browser.newContext(),
    peer = await peerContext.newPage();
  const adminContext = await browser.newContext(),
    staff = await adminContext.newPage();
  try {
    await login(peer, f.b);
    await peer.goto(`/users/${f.a.username}`);
    await expect(
      peer.getByRole("heading", { name: f.a.name, exact: true }),
    ).toBeVisible();
    await expect(
      peer.getByText(`Bio confidencial ${f.token}`, { exact: true }),
    ).toHaveCount(0);
    await expect(peer.getByText(/8º semestre/)).toHaveCount(0);
    await peer.getByText("Denunciar perfil", { exact: true }).click();
    await peer
      .getByLabel("Detalhes (opcional)")
      .fill(`Denúncia MVP ${f.token}`);
    await peer
      .getByRole("button", { name: "Enviar denúncia", exact: true })
      .click();
    await expect(
      peer.getByText("Denúncia enviada à administração.", { exact: true }),
    ).toBeVisible();
    await login(staff, f.staff, true);
    await staff.goto("/admin/denuncias");
    const report = staff
      .getByRole("article")
      .filter({ hasText: `Denúncia MVP ${f.token}` });
    await report
      .getByRole("link", { name: "Consultar conteúdo denunciado" })
      .click();
    await expect(
      staff.getByRole("heading", { name: f.a.name, exact: true }),
    ).toBeVisible();
    await staff.goto("/admin/denuncias");
    await report.getByLabel("Tratamento").selectOption("actioned");
    await report
      .getByRole("button", { name: "Registrar tratamento", exact: true })
      .click();
    await expect(
      report.getByText("Status: actioned", { exact: true }),
    ).toBeVisible();
    await peer.getByLabel(/Confirmo bloquear este usuário/).check();
    await peer
      .getByRole("button", { name: "Bloquear usuário", exact: true })
      .click();
    await expect(peer).toHaveURL(/\/profile\/privacidade\?blocked=1$/);
    await page.goto(`/users/${f.b.username}`);
    await expect(
      page.getByRole("heading", {
        name: "Vamos voltar ao campus?",
        exact: true,
      }),
    ).toBeVisible();
    await peer
      .getByRole("button", { name: "Desbloquear usuário", exact: true })
      .click();
    await expect(
      peer.getByText(
        "Usuário desbloqueado. Conexões anteriores não são restauradas.",
        { exact: true },
      ),
    ).toBeVisible();
    for (const width of [360, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const route of [
        "/profile",
        "/profile/edit",
        "/profile/certificados",
        "/profile/privacidade",
        "/networks",
        "/connections",
        "/marketplace",
        "/marketplace/novo",
      ]) {
        await page.goto(route);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await fits(page);
      }
    }
  } finally {
    await peerContext.close();
    await adminContext.close();
  }
});
