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
  adminRecoverySession: () => Promise<{
    access_token: string;
    refresh_token: string;
  }>;
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
      await provide({
        a,
        b,
        staff,
        token,
        sql,
        adminRecoverySession: async () => {
          // Exercise native Auth without sending mail to synthetic addresses.
          const redirect =
            "https://sabenca-git-develop-sirmanotretas-projects.vercel.app/auth/convite";
          const link = await admin.auth.admin.generateLink({
            type: "recovery",
            email: staff.email,
            options: { redirectTo: redirect },
          });
          if (link.error || !link.data.properties?.hashed_token)
            throw new Error("Unable to prepare isolated recovery link");
          if (link.data.properties.redirect_to !== redirect)
            throw new Error(
              "Supabase DEV must allow /auth/convite for develop Preview",
            );
          const client = createClient(
            url,
            process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
            { auth: { persistSession: false, autoRefreshToken: false } },
          );
          const verified = await client.auth.verifyOtp({
            type: "recovery",
            token_hash: link.data.properties.hashed_token,
          });
          if (verified.error || !verified.data.session)
            throw new Error("Isolated recovery verification failed");
          return {
            access_token: verified.data.session.access_token,
            refresh_token: verified.data.session.refresh_token,
          };
        },
      });
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
test("native admin recovery establishes invitation session and changes password", async ({
  page,
  fixture: f,
}) => {
  const session = await f.adminRecoverySession();
  await page.addInitScript(({ access_token, refresh_token }) => {
    if (location.pathname === "/auth/convite")
      history.replaceState(
        null,
        "",
        `/auth/convite#${new URLSearchParams({ access_token, refresh_token, type: "recovery" })}`,
      );
  }, session);
  await page.goto("/auth/convite");
  await expect(page).toHaveURL(/\/auth\/update-password$/);
  expect(new URL(page.url()).hash).toBe("");
  const password = `${randomUUID()}Aa1!`;
  await page.getByLabel("Nova senha", { exact: true }).fill(password);
  await page
    .getByLabel("Confirme a nova senha", { exact: true })
    .fill(password);
  await page
    .getByRole("button", { name: "Salvar nova senha", exact: true })
    .click();
  await expect(page).toHaveURL(/\/auth\/admin\?message=password-updated$/);
  await login(page, { ...f.staff, password }, true);
  await expect(
    page.getByRole("heading", { name: "Alunos cadastrados", exact: true }),
  ).toBeVisible();
});

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
    const edited = page.getByRole("article").filter({
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

test("service credential, optional contact, invalidation and actual listing moderation", async ({
  page,
  browser,
  fixture: f,
}) => {
  await login(page, f.a);
  const certificateTitle = `Credencial serviço ${f.token}`;
  const listingTitle = `Serviço com credencial ${f.token}`;
  await page.goto("/profile/certificados");
  await page.getByLabel("Título", { exact: true }).fill(certificateTitle);
  await page.getByLabel("Instituição emissora").fill("Instituição de teste");
  await page.getByLabel("Data de emissão", { exact: true }).fill("2026-01-01");
  await page
    .getByLabel("URL de verificação (opcional, HTTPS)")
    .fill("https://example.test/credencial");
  await page
    .getByRole("button", { name: "Cadastrar certificado", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: certificateTitle, exact: true }),
  ).toBeVisible();
  const peerContext = await browser.newContext(),
    peer = await peerContext.newPage();
  const staffContext = await browser.newContext(),
    staff = await staffContext.newPage();
  try {
    await login(staff, f.staff, true);
    await staff.goto("/admin/certificados");
    const review = staff.getByRole("article").filter({
      has: staff.getByRole("heading", {
        name: certificateTitle,
        exact: true,
      }),
    });
    await review
      .getByRole("button", { name: "Registrar análise", exact: true })
      .click();
    await expect(review.getByText(/Status: verified/)).toBeVisible();
    await page.goto("/profile/privacidade");
    await page
      .getByLabel("Link de contato", { exact: true })
      .fill("https://wa.me/5511999999999");
    await page
      .getByLabel(
        "Autorizo exibir este contato aos estudantes que podem ver meus anúncios.",
        { exact: true },
      )
      .check();
    await page
      .getByRole("button", { name: "Salvar contato", exact: true })
      .click();
    await expect(
      page.getByText("Contato salvo.", { exact: true }),
    ).toBeVisible();
    await page.goto("/marketplace/novo");
    await page
      .getByLabel("Categoria", { exact: true })
      .selectOption({ label: "Livros" });
    await expect(
      page.getByRole("group", {
        name: "Credenciais relacionadas ao serviço",
        exact: true,
      }),
    ).toHaveCount(0);
    await page
      .getByLabel("Categoria", { exact: true })
      .selectOption({ label: "Serviços" });
    await page.getByLabel("Título do anúncio").fill(listingTitle);
    await page
      .getByLabel("Descrição", { exact: true })
      .fill("Serviço para estudantes com documentação analisada.");
    await page.getByLabel("Preço (R$)").fill("50,00");
    await page
      .getByRole("checkbox", {
        name: `${certificateTitle} — Instituição de teste`,
        exact: true,
      })
      .check();
    await page
      .getByRole("button", { name: "Publicar anúncio", exact: true })
      .click();
    await expect(page).toHaveURL(/\/marketplace\/[a-f0-9-]{36}$/);
    const listingUrl = new URL(page.url()).pathname;
    await page.goto(`${listingUrl}/editar`);
    await expect(
      page.getByRole("checkbox", {
        name: `${certificateTitle} — Instituição de teste`,
        exact: true,
      }),
    ).toBeChecked();
    await page
      .getByRole("button", { name: "Salvar alterações", exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`${listingUrl}$`));
    await login(peer, f.b);
    await peer.goto(listingUrl);
    await expect(
      peer.getByText("Credencial verificada pelo SABENÇA", { exact: true }),
    ).toBeVisible();
    await expect(
      peer.getByRole("heading", { name: certificateTitle, exact: true }),
    ).toBeVisible();
    await expect(
      peer.getByRole("link", { name: "Entrar em contato", exact: true }),
    ).toHaveAttribute("href", "https://wa.me/5511999999999");
    for (const width of [360, 1440]) {
      await peer.setViewportSize({ width, height: 900 });
      await fits(peer);
      await peer.screenshot({
        path: test.info().outputPath(`service-credential-${width}.png`),
        fullPage: true,
        animations: "disabled",
      });
    }
    const body = await peer.locator("body").textContent();
    for (const value of ["file_path", f.staff.userId, f.a.email, f.a.studentId])
      expect(body).not.toContain(value);
    await page.goto("/profile/privacidade");
    await page
      .getByLabel(
        "Autorizo exibir este contato aos estudantes que podem ver meus anúncios.",
        { exact: true },
      )
      .uncheck();
    await page
      .getByRole("button", { name: "Salvar contato", exact: true })
      .click();
    await expect(
      page.getByText("Contato salvo.", { exact: true }),
    ).toBeVisible();
    await peer.reload();
    await expect(
      peer.getByRole("link", { name: "Entrar em contato", exact: true }),
    ).toHaveCount(0);
    await page.goto("/profile/certificados");
    const own = page.getByRole("article").filter({
      has: page.getByRole("heading", { name: certificateTitle, exact: true }),
    });
    await own.getByText("Editar certificado", { exact: true }).click();
    await own.getByLabel("Validade (opcional)").fill("2026-01-02");
    await own
      .getByRole("button", { name: "Salvar certificado", exact: true })
      .click();
    await expect(
      own.getByText("Status: Pendente de análise", { exact: true }),
    ).toBeVisible();
    await peer.reload();
    await expect(
      peer.getByText("Credencial verificada pelo SABENÇA", { exact: true }),
    ).toHaveCount(0);
    await staff.reload();
    await review
      .getByRole("button", { name: "Registrar análise", exact: true })
      .click();
    await expect(review.getByText(/Status: verified/)).toBeVisible();
    await peer.goto(`/users/${f.a.username}`);
    await expect(
      peer.getByText(
        "Credencial expirada · documento anteriormente verificado",
        { exact: true },
      ),
    ).toBeVisible();
    await peer.goto(listingUrl);
    await expect(
      peer.getByText("Credencial verificada pelo SABENÇA", { exact: true }),
    ).toHaveCount(0);
    await page.reload();
    await own
      .getByLabel("Confirmo excluir este certificado e seu documento")
      .check();
    await own
      .getByRole("button", { name: "Excluir certificado", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: certificateTitle, exact: true }),
    ).toHaveCount(0);
    await peer.reload();
    await expect(
      peer.getByRole("heading", { name: listingTitle, exact: true }),
    ).toBeVisible();
    await peer.getByText("Denunciar anúncio", { exact: true }).click();
    await peer
      .getByLabel("Detalhes (opcional)")
      .fill(`Moderação serviço ${f.token}`);
    await peer
      .getByRole("button", { name: "Enviar denúncia", exact: true })
      .click();
    await expect(
      peer.getByText("Denúncia enviada à administração.", { exact: true }),
    ).toBeVisible();
    await staff.goto("/admin/denuncias");
    const report = staff
      .getByRole("article")
      .filter({ hasText: `Moderação serviço ${f.token}` });
    await report
      .getByRole("link", { name: "Consultar conteúdo denunciado", exact: true })
      .click();
    await staff
      .getByLabel("Confirmo desativar administrativamente este anúncio")
      .check();
    await staff
      .getByRole("button", {
        name: "Desativar anúncio denunciado",
        exact: true,
      })
      .click();
    await expect(
      staff.getByText(
        "Anúncio desativado. Denúncia registrada como actioned.",
        { exact: true },
      ),
    ).toBeVisible();
    await peer.goto(listingUrl);
    await expect(
      peer.getByRole("heading", { name: "Anúncio indisponível", exact: true }),
    ).toBeVisible();
    const listingId = listingUrl.split("/").pop()!;
    expect(
      (await f.sql`select status from public.listings where id=${listingId}`)[0]
        .status,
    ).toBe("inactive");
    for (const width of [360, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/profile/privacidade");
      await fits(page);
      await page.goto(`${listingUrl}/editar`);
      await fits(page);
    }
  } finally {
    await peerContext.close();
    await staffContext.close();
  }
});

test("administrator updates academic semester without changing student identity", async ({
  page,
  browser,
  fixture: f,
}) => {
  await login(page, f.staff, true);
  await page
    .getByLabel("Pesquisar aluno por RA ou nome", { exact: true })
    .fill(f.a.ra);
  await page.getByRole("button", { name: "Pesquisar", exact: true }).click();
  const row = page.getByRole("row").filter({ hasText: f.a.ra });
  await row.getByText("Atualizar curso e semestre", { exact: true }).click();
  await row.getByLabel("Semestre acadêmico", { exact: true }).fill("9");
  await row
    .getByRole("button", { name: "Salvar dados acadêmicos", exact: true })
    .click();
  await expect(
    row.getByText("Dados acadêmicos atualizados.", { exact: true }),
  ).toBeVisible();
  const [student] =
    await f.sql`select ra,auth_user_id,semester from private.institution_students where id=${f.a.studentId}`;
  expect(student).toMatchObject({
    ra: f.a.ra,
    auth_user_id: f.a.userId,
    semester: 9,
  });
  const context = await browser.newContext(),
    studentPage = await context.newPage();
  try {
    await login(studentPage, f.a);
    await studentPage.goto("/profile");
    await expect(studentPage.getByText(/9º semestre/)).toBeVisible();
  } finally {
    await context.close();
  }
});

test("service selects up to three ordered credentials and hides each invalidated document independently", async ({
  page,
  browser,
  fixture: f,
}) => {
  test.setTimeout(360000);
  const certificates = [
    { id: randomUUID(), title: `Linux Essentials ${f.token}`, issuer: "Cisco" },
    {
      id: randomUUID(),
      title: `Fundamentos de Redes ${f.token}`,
      issuer: "Cisco",
    },
    {
      id: randomUUID(),
      title: `Docker Foundations ${f.token}`,
      issuer: "Docker",
    },
    {
      id: randomUUID(),
      title: `Python Essentials ${f.token}`,
      issuer: "Cisco",
    },
  ];
  // Only this test's DEV members and certificates are seeded. The review UI and
  // its evidence requirements remain covered by the lifecycle test above.
  for (const certificate of certificates)
    await f.sql`insert into public.profile_certificates(id,user_id,title,issuer,issue_date,verification_url,status,verified_at,verified_by)
      values (${certificate.id},${f.a.userId},${certificate.title},${certificate.issuer},'2026-01-01',${`https://example.test/${certificate.id}`},'verified',now(),${f.staff.userId})`;
  const [linux, networks, docker, python] = certificates;
  const listingTitle = `Configuração de servidores Linux ${f.token}`;
  const peerContext = await browser.newContext(),
    peer = await peerContext.newPage();
  const staffContext = await browser.newContext(),
    staff = await staffContext.newPage();
  let listingUrl = "";
  const checkbox = (certificate: (typeof certificates)[number]) =>
    page.getByRole("checkbox", {
      name: `${certificate.title} — ${certificate.issuer}`,
      exact: true,
    });
  const badge = (target: Page, plural: boolean) =>
    target.getByText(
      plural
        ? "Credenciais verificadas pelo SABENÇA"
        : "Credencial verificada pelo SABENÇA",
      { exact: true },
    );
  async function saveEdit() {
    await page
      .getByRole("button", { name: "Salvar alterações", exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`${listingUrl}$`));
  }
  async function expectVisibleCredentials(
    expected: (typeof certificates)[number][],
  ) {
    await peer.goto(listingUrl);
    await expect(
      peer.getByRole("heading", { name: listingTitle, exact: true }),
    ).toBeVisible();
    await expect(badge(peer, false)).toHaveCount(expected.length === 1 ? 1 : 0);
    await expect(badge(peer, true)).toHaveCount(expected.length > 1 ? 1 : 0);
    const credentialHeadings = peer
      .getByRole("heading", { level: 3 })
      .filter({ hasText: f.token });
    await expect(credentialHeadings).toHaveText(expected.map((c) => c.title));
    for (const certificate of certificates)
      if (!expected.includes(certificate))
        await expect(
          peer.getByRole("heading", {
            name: certificate.title,
            exact: true,
          }),
        ).toHaveCount(0);
  }
  try {
    await login(page, f.a);
    await login(peer, f.b);
    await peer.goto(`/users/${f.a.username}`);
    for (const certificate of certificates)
      await expect(
        peer.getByRole("heading", { name: certificate.title, exact: true }),
      ).toBeVisible();
    await expect(
      peer.getByText("Documento verificado pelo SABENÇA", { exact: true }),
    ).toHaveCount(4);

    await page.goto("/marketplace/novo");
    await page
      .getByLabel("Categoria", { exact: true })
      .selectOption({ label: "Serviços" });
    await page.getByLabel("Título do anúncio").fill(listingTitle);
    await page
      .getByLabel("Descrição", { exact: true })
      .fill(
        "Serviço fictício de configuração e manutenção de servidores Linux.",
      );
    await page.getByLabel("Preço (R$)").fill("80,00");
    await expect(
      page.getByText("0 de 3 selecionadas", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Publicar anúncio", exact: true })
      .click();
    await expect(page).toHaveURL(/\/marketplace\/[a-f0-9-]{36}$/);
    listingUrl = new URL(page.url()).pathname;
    const listingId = listingUrl.split("/").pop()!;
    await expectVisibleCredentials([]);

    await page.goto(`${listingUrl}/editar`);
    await checkbox(linux).check();
    await expect(
      page.getByText("1 de 3 selecionadas", { exact: true }),
    ).toBeVisible();
    await saveEdit();
    await expectVisibleCredentials([linux]);

    await page.goto(`${listingUrl}/editar`);
    await expect(checkbox(linux)).toBeChecked();
    await checkbox(networks).check();
    await checkbox(docker).check();
    await expect(
      page.getByText("3 de 3 selecionadas", { exact: true }),
    ).toBeVisible();
    await expect(checkbox(python)).toBeDisabled();
    await expect(checkbox(python)).not.toBeChecked();
    await saveEdit();
    await expectVisibleCredentials([linux, networks, docker]);
    expect(
      await f.sql`select certificate_id,position from public.listing_certificates where listing_id=${listingId} order by position`,
    ).toEqual([
      { certificate_id: linux.id, position: 0 },
      { certificate_id: networks.id, position: 1 },
      { certificate_id: docker.id, position: 2 },
    ]);
    for (const width of [360, 1440]) {
      await peer.setViewportSize({ width, height: 900 });
      await fits(peer);
      await peer.screenshot({
        path: test.info().outputPath(`service-three-credentials-${width}.png`),
        fullPage: true,
        animations: "disabled",
      });
    }
    const body = await peer.locator("body").textContent();
    for (const privateValue of [
      "file_path",
      f.staff.userId,
      f.a.email,
      f.a.studentId,
    ])
      expect(body).not.toContain(privateValue);

    // Editing restores the selected set and keeps the fourth option available
    // again when one is removed. Received selection order is persisted.
    await page.goto(`${listingUrl}/editar`);
    for (const certificate of [linux, networks, docker])
      await expect(checkbox(certificate)).toBeChecked();
    await checkbox(docker).uncheck();
    await expect(
      page.getByText("2 de 3 selecionadas", { exact: true }),
    ).toBeVisible();
    await expect(checkbox(python)).toBeEnabled();
    await checkbox(python).check();
    await expect(
      page.getByText("3 de 3 selecionadas", { exact: true }),
    ).toBeVisible();
    await checkbox(python).uncheck();
    await saveEdit();
    await expectVisibleCredentials([linux, networks]);
    await page.goto(`${listingUrl}/editar`);
    await checkbox(docker).check();
    await saveEdit();
    await expectVisibleCredentials([linux, networks, docker]);

    // Owner edits invalidate only Docker; its historical association remains.
    await page.goto("/profile/certificados");
    const dockerDocument = page.getByRole("article").filter({
      has: page.getByRole("heading", { name: docker.title, exact: true }),
    });
    await dockerDocument
      .getByText("Editar certificado", { exact: true })
      .click();
    await dockerDocument
      .getByLabel("Código da credencial (opcional)")
      .fill(`revisao-${f.token}`);
    await dockerDocument
      .getByRole("button", { name: "Salvar certificado", exact: true })
      .click();
    await expect(
      dockerDocument.getByText("Status: Pendente de análise", { exact: true }),
    ).toBeVisible();
    await expectVisibleCredentials([linux, networks]);
    expect(
      await f.sql`select certificate_id from public.listing_certificates where listing_id=${listingId} order by position`,
    ).toEqual([
      { certificate_id: linux.id },
      { certificate_id: networks.id },
      { certificate_id: docker.id },
    ]);

    // A reviewed, evidenced document can expire independently of review status.
    const networkDocument = page.getByRole("article").filter({
      has: page.getByRole("heading", { name: networks.title, exact: true }),
    });
    await networkDocument
      .getByText("Editar certificado", { exact: true })
      .click();
    await networkDocument.getByLabel("Validade (opcional)").fill("2026-01-02");
    await networkDocument
      .getByRole("button", { name: "Salvar certificado", exact: true })
      .click();
    await expect(
      networkDocument.getByText("Status: Pendente de análise", { exact: true }),
    ).toBeVisible();
    await login(staff, f.staff, true);
    await staff.goto("/admin/certificados");
    const review = staff.getByRole("article").filter({
      has: staff.getByRole("heading", { name: networks.title, exact: true }),
    });
    await review
      .getByRole("button", { name: "Registrar análise", exact: true })
      .click();
    await expect(review.getByText(/Status: verified/)).toBeVisible();
    await expectVisibleCredentials([linux]);
    expect(
      await f.sql`select certificate_id from public.listing_certificates where listing_id=${listingId}`,
    ).toHaveLength(3);

    await page.goto(`${listingUrl}/editar`);
    await page
      .getByLabel("Categoria", { exact: true })
      .selectOption({ label: "Livros" });
    await expect(
      page.getByRole("group", {
        name: "Credenciais relacionadas ao serviço",
        exact: true,
      }),
    ).toHaveCount(0);
    await saveEdit();
    await expectVisibleCredentials([]);
    expect(
      await f.sql`select certificate_id from public.listing_certificates where listing_id=${listingId}`,
    ).toHaveLength(0);

    // Returning to a service permits a new explicit selection, including none.
    await page.goto(`${listingUrl}/editar`);
    await page
      .getByLabel("Categoria", { exact: true })
      .selectOption({ label: "Serviços" });
    await checkbox(linux).check();
    await saveEdit();
    await expectVisibleCredentials([linux]);
    await page.goto(`${listingUrl}/editar`);
    await checkbox(linux).uncheck();
    await saveEdit();
    await expectVisibleCredentials([]);
  } finally {
    await peerContext.close();
    await staffContext.close();
  }
});
