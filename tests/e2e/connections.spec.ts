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
  ra: string;
  email: string;
  password: string;
  name: string;
  username: string;
  profileId: string;
  userId: string;
};
type Fixture = {
  a: Member;
  b: Member;
  blockPeer: () => Promise<void>;
  relationCount: () => Promise<number>;
};
const test = base.extend<{ members: Fixture }>({
  members: async ({}, provide) => {
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
    const userIds: string[] = [],
      studentIds: string[] = [];
    const makeMember = async (label: string): Promise<Member> => {
      const token = randomUUID().replaceAll("-", "").slice(0, 16),
        studentId = randomUUID(),
        password = `${randomUUID()}Aa1!`;
      const ra = `e2e${token}`,
        email = `connections-${token}@example.com`,
        username = `e2e_${token}`,
        name = `Aluno ${label} Conexões ${token}`;
      await sql`insert into private.institution_students(id,institution_id,ra,name,email,phone,birth_date,cpf_fingerprint,semester)
        values (${studentId},'fatece',${ra},${name},${email},'5511999999999','2000-01-01',${createHash("sha256").update(token).digest("hex")},4)`;
      studentIds.push(studentId);
      const created = await auth.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (created.error || !created.data.user)
        throw new Error("Could not create synthetic connections member");
      const userId = created.data.user.id;
      userIds.push(userId);
      await sql`update private.institution_students set auth_user_id=${userId},status='active',activated_at=now() where id=${studentId}`;
      const [profile] =
        await sql`insert into public.profiles(user_id,username,name,semester,institution,institution_id) values (${userId},${username},${name},4,'FATECE','fatece') returning id`;
      return {
        ra,
        email,
        password,
        name,
        username,
        userId,
        profileId: profile.id as string,
      };
    };
    try {
      const a = await makeMember("A"),
        b = await makeMember("B");
      await provide({
        a,
        b,
        blockPeer: async () => {
          await sql`update private.institution_students set status='blocked' where auth_user_id=${b.userId}`;
        },
        relationCount: async () => {
          const [row] =
            await sql`select count(*)::integer as count from public.connections where requester_id in (${a.profileId},${b.profileId}) or receiver_id in (${a.profileId},${b.profileId})`;
          return row.count as number;
        },
      });
    } finally {
      try {
        if (studentIds.length)
          await sql`delete from private.institution_students where id in ${sql(studentIds)}`;
        for (const userId of userIds) {
          const removed = await auth.auth.admin.deleteUser(userId);
          if (removed.error) throw removed.error;
        }
        if (userIds.length) {
          const [audit] =
            await sql`select (select count(*) from auth.users where id in ${sql(userIds)}) + (select count(*) from public.profiles where user_id in ${sql(userIds)}) + (select count(*) from private.institution_students where id in ${sql(studentIds)}) as remaining`;
          if (Number(audit.remaining) !== 0)
            throw new Error("Synthetic connections fixture cleanup incomplete");
        }
      } finally {
        await sql.end();
      }
    }
  },
});
test.skip(
  process.env.SABENCA_E2E_INTEGRATION !== "1",
  "Requires explicit authorization for synthetic accounts in the configured Supabase.",
);
test.setTimeout(180_000);
const expect = baseExpect.configure({ timeout: 20_000 });
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
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}
test("Networks request, mutual acceptance and confirmed removal", async ({
  page,
  browser,
  members,
}, info) => {
  const peerContext = await browser.newContext({
    viewport: page.viewportSize()!,
  });
  const peer = await peerContext.newPage();
  try {
    await login(page, members.a);
    await page.goto(`/networks?q=${members.b.username}`);
    await expect(page.locator("article")).toHaveCount(1);
    await page.getByRole("button", { name: "Conectar", exact: true }).click();
    await expect(
      page.getByText("Solicitação enviada", { exact: true }),
    ).toBeVisible();
    await noOverflow(page);
    await login(peer, members.b);
    await peer.goto("/connections");
    const received = peer.getByRole("region", {
      name: "Solicitações recebidas (1)",
    });
    await expect(
      received.getByRole("heading", { name: members.a.name }),
    ).toBeVisible();
    await noOverflow(peer);
    await peer.screenshot({
      path: info.outputPath("connections-incoming.png"),
      animations: "disabled",
      fullPage: true,
    });
    await received
      .getByRole("button", { name: "Aceitar", exact: true })
      .click();
    await expect(
      peer
        .getByRole("region", { name: "Minhas conexões (1)" })
        .getByText("Conectado", { exact: true }),
    ).toBeVisible();
    await page.goto(`/users/${members.b.username}`);
    await expect(page.getByText("Conectado", { exact: true })).toBeVisible();
    await page.goto("/connections");
    await expect(
      page.getByRole("heading", { name: members.b.name }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Remover conexão", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Cancelar" }),
    ).toBeFocused();
    await noOverflow(page);
    await page.screenshot({
      path: info.outputPath("connections-remove.png"),
      animations: "disabled",
      fullPage: true,
    });
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(
      page.getByRole("button", { name: "Remover conexão", exact: true }),
    ).toBeFocused();
    expect(await members.relationCount()).toBe(1);
    await page
      .getByRole("button", { name: "Remover conexão", exact: true })
      .click();
    await dialog.getByRole("button", { name: "Remover", exact: true }).click();
    await expect(
      page.getByText("Você ainda não possui conexões.", { exact: true }),
    ).toBeVisible();
    await peer.reload();
    await expect(
      peer.getByText("Você ainda não possui conexões.", { exact: true }),
    ).toBeVisible();
    expect(await members.relationCount()).toBe(0);
  } finally {
    await peerContext.close();
  }
});
test("profile requests can be canceled or declined and blocked peers disappear", async ({
  page,
  browser,
  members,
}, info) => {
  const peerContext = await browser.newContext({
    viewport: page.viewportSize()!,
  });
  const peer = await peerContext.newPage();
  try {
    await login(page, members.a);
    await page.goto(`/users/${members.a.username}`);
    await expect(
      page.getByRole("button", { name: "Conectar", exact: true }),
    ).toHaveCount(0);
    await page.goto(`/users/${members.b.username}`);
    await page.getByRole("button", { name: "Conectar", exact: true }).click();
    await expect(
      page.getByText("Solicitação enviada", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Cancelar", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Conectar", exact: true }),
    ).toBeVisible();
    expect(await members.relationCount()).toBe(0);
    await login(peer, members.b);
    await peer.goto("/connections");
    await expect(peer.getByText("Nenhuma solicitação recebida.")).toBeVisible();
    await page.getByRole("button", { name: "Conectar", exact: true }).click();
    await expect(
      page.getByText("Solicitação enviada", { exact: true }),
    ).toBeVisible();
    await peer.goto(`/users/${members.a.username}`);
    await expect(
      peer.getByRole("button", { name: "Aceitar", exact: true }),
    ).toBeVisible();
    await expect(
      peer.getByRole("button", { name: "Recusar", exact: true }),
    ).toBeVisible();
    await noOverflow(peer);
    await peer.screenshot({
      path: info.outputPath("profile-incoming.png"),
      animations: "disabled",
      fullPage: true,
    });
    await peer.getByRole("button", { name: "Recusar", exact: true }).click();
    await expect(
      peer.getByRole("button", { name: "Conectar", exact: true }),
    ).toBeVisible();
    expect(await members.relationCount()).toBe(0);
    await page.reload();
    await page.getByRole("button", { name: "Conectar", exact: true }).click();
    await expect(
      page.getByText("Solicitação enviada", { exact: true }),
    ).toBeVisible();
    await members.blockPeer();
    await page.goto("/connections");
    await expect(page.getByText("Nenhuma solicitação enviada.")).toBeVisible();
    await page.goto(`/users/${members.b.username}`);
    await expect(
      page.getByRole("button", { name: "Conectar", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: members.b.name }),
    ).toHaveCount(0);
    expect(await members.relationCount()).toBe(1);
  } finally {
    await peerContext.close();
  }
});

test("direct authenticated API enforces RLS and concurrent reverse requests", async ({
  members,
}) => {
  const clients = [members.a, members.b].map(() =>
    createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    ),
  );
  for (const [index, member] of [members.a, members.b].entries()) {
    const result = await clients[index].auth.signInWithPassword({
      email: member.email,
      password: member.password,
    });
    expect(result.error).toBeNull();
  }
  const pair = {
    requester_id: members.a.profileId,
    receiver_id: members.b.profileId,
  };
  const reverse = {
    requester_id: members.b.profileId,
    receiver_id: members.a.profileId,
  };
  expect(
    (await clients[0].from("connections").insert(reverse)).error?.code,
  ).toBe("42501");
  expect(
    (
      await clients[0]
        .from("connections")
        .insert({ ...pair, status: "accepted" })
    ).error?.code,
  ).toBe("42501");
  const requests = await Promise.all([
    clients[0].from("connections").insert(pair).select("id").single(),
    clients[1].from("connections").insert(reverse).select("id").single(),
  ]);
  expect(requests.filter((r) => !r.error)).toHaveLength(1);
  expect(requests.find((r) => r.error)?.error?.code).toBe("23505");
  const winner = requests[0].data ? 0 : 1,
    receiver = 1 - winner;
  const id = requests[winner].data!.id;
  expect(
    (
      await clients[winner]
        .from("connections")
        .update({ status: "accepted" })
        .eq("id", id)
        .select("id")
    ).data,
  ).toEqual([]);
  expect(
    (
      await clients[receiver]
        .from("connections")
        .update({ requester_id: members.b.profileId })
        .eq("id", id)
    ).error?.code,
  ).toBe("42501");
  expect(
    (
      await clients[receiver]
        .from("connections")
        .update({ status: "accepted" })
        .eq("id", id)
        .select("id")
    ).data,
  ).toHaveLength(1);
  expect(
    (
      await clients[receiver]
        .from("connections")
        .update({ status: "pending" })
        .eq("id", id)
        .select("id")
    ).data,
  ).toEqual([]);
  expect(await members.relationCount()).toBe(1);
  expect(
    (
      await clients[winner]
        .from("connections")
        .delete()
        .eq("id", id)
        .select("id")
    ).data,
  ).toHaveLength(1);
  expect(await members.relationCount()).toBe(0);
});
