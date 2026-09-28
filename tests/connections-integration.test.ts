import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import postgres from "postgres";
import { readFileSync, readdirSync } from "node:fs";
import {
  beforeAll,
  beforeEach,
  afterAll,
  describe,
  it,
  expect,
  vi,
} from "vitest";
vi.mock("server-only", () => ({}));
const state = vi.hoisted(() => ({
  sql: null as unknown as ReturnType<typeof postgres>,
  session: vi.fn(),
  signed: vi.fn(),
}));
vi.mock("@/lib/institution/database", () => ({ database: () => state.sql }));
vi.mock("@/services/session", () => ({ requireUser: state.session }));
import {
  getConnections,
  getConnectionState,
  sendConnectionRequest,
  acceptConnectionRequest,
  rejectConnectionRequest,
  cancelConnectionRequest,
  removeConnection,
  connectionStatesFor,
} from "@/services/connections";
import { searchNetworks } from "@/services/networks";

const uid = (i: number) =>
  `40000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
const profile = (i: number) => uid(1000 + i);
let db: PGlite, server: PGLiteSocketServer;
function login(i: number) {
  state.session.mockResolvedValue({
    user: { id: uid(i) },
    client: { storage: { from: () => ({ createSignedUrls: state.signed }) } },
  });
}
async function asUser(i: number, query: string) {
  return state.sql.begin(async (sql) => {
    await sql`select set_config('request.jwt.claim.sub', ${uid(i)}, true)`;
    await sql`set local role authenticated`;
    return sql.unsafe(query);
  });
}
async function relation(status = "pending", from = 0, to = 1) {
  const [row] =
    await state.sql`insert into public.connections(requester_id,receiver_id,status) values (${profile(from)},${profile(to)},${status}) returning id`;
  return row.id as string;
}
beforeAll(async () => {
  db = await PGlite.create();
  await db.exec(`create role anon; create role authenticated; create role supabase_auth_admin; create schema auth; create schema storage;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,is_anonymous boolean default false,banned_until timestamptz,raw_app_meta_data jsonb default '{}',raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth,storage to authenticated,anon;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;
    create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;`);
  const migrations = readdirSync("supabase/migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort();
  const phase = migrations.find((f) => f.endsWith("_connections_phase.sql"))!;
  for (const file of migrations.filter((f) => f < phase))
    await db.exec(
      "begin;" +
        readFileSync("supabase/migrations/" + file, "utf8") +
        "commit;",
    );
  // The current schema itself forbids a second institutional context.
  await expect(
    db.exec(
      "insert into private.institutions(id,name) values ('other','Other institution')",
    ),
  ).rejects.toMatchObject({ code: "23514" });
  for (let i = 0; i < 64; i++) {
    await db.query(
      "insert into auth.users(id,email,email_confirmed_at,is_anonymous,banned_until) values ($1,$2,$3,$4,$5)",
      [
        uid(i),
        `student${i}@example.test`,
        i === 58 ? null : new Date(),
        i === 59,
        i === 60 ? "2099-01-01" : null,
      ],
    );
    if (i === 63) continue;
    await db.query(
      "insert into private.institution_students(institution_id,auth_user_id,ra,name,email,phone,birth_date,cpf_fingerprint,status,activated_at) values ($1,$2,$3,$4,$5,'5519999999999','2000-01-01',$6,$7,now())",
      [
        "fatece",
        uid(i),
        `400${i}`,
        `Pessoa ${String(i).padStart(2, "0")}`,
        `student${i}@example.test`,
        i.toString(16).padStart(64, "0"),
        i === 56 ? "blocked" : i === 57 ? "inactive" : "active",
      ],
    );
    await db.query(
      "insert into public.profiles(id,user_id,username,name,institution,institution_id,avatar_url) values ($1,$2,$3,$4,$5,$6,$7)",
      [
        profile(i),
        uid(i),
        `person_${i}`,
        `Pessoa ${String(i).padStart(2, "0")}`,
        "FATECE",
        "fatece",
        i === 1 ? `${uid(i)}/avatar.png` : null,
      ],
    );
  }
  await db.query(
    "insert into private.admin_users(user_id,institution_id) values ($1,'fatece')",
    [uid(63)],
  );
  await db.query(
    "update auth.users set email='changed@example.test' where id=$1",
    [uid(61)],
  );
  await db.exec(`insert into public.connections(id,requester_id,receiver_id,status,created_at,updated_at) values
    ('${uid(2000)}','${profile(0)}','${profile(1)}','pending','2026-01-01','2026-01-02'),
    ('${uid(2001)}','${profile(0)}','${profile(2)}','accepted','2026-01-03','2026-01-04')`);
  const before = (
    await db.query("select * from public.connections order by id")
  ).rows;
  const migration = readFileSync("supabase/migrations/" + phase, "utf8");
  await db.exec(
    `begin; insert into public.connections(requester_id,receiver_id,status) values ('${profile(1)}','${profile(2)}','rejected');`,
  );
  await expect(db.exec(migration)).rejects.toThrow("review existing rejected");
  await db.exec("rollback;");
  expect(
    (await db.query("select * from public.connections order by id")).rows,
  ).toEqual(before);
  await db.exec("begin;" + migration + "commit;");
  expect(
    (await db.query("select * from public.connections order by id")).rows,
  ).toEqual(before);
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
beforeEach(async () => {
  await state.sql`delete from public.connections`;
  await state.sql`update private.institution_students set status='active' where auth_user_id=${uid(1)}`;
  state.signed.mockReset().mockResolvedValue({
    data: [
      {
        path: `${uid(1)}/avatar.png`,
        signedUrl: "https://example.test/signed",
      },
    ],
    error: null,
  });
  login(0);
});
afterAll(async () => {
  await state.sql?.end({ timeout: 1 });
  await server?.stop();
  await db?.close();
});

describe("connections migration and direct database policies", () => {
  it("preserves pending/accepted and aborts rejected (verified during migration setup)", async () => {
    await expect(
      state.sql`insert into public.connections(requester_id,receiver_id,status) values (${profile(0)},${profile(1)},'rejected')`,
    ).rejects.toMatchObject({ code: "23514" });
  });
  it("allows an active requester and only exposes the relation to its participants", async () => {
    await asUser(
      0,
      `insert into public.connections(requester_id,receiver_id) values ('${profile(0)}','${profile(1)}')`,
    );
    expect(await asUser(0, "select id from public.connections")).toHaveLength(
      1,
    );
    expect(await asUser(1, "select id from public.connections")).toHaveLength(
      1,
    );
    expect(await asUser(2, "select id from public.connections")).toHaveLength(
      0,
    );
    await expect(
      state.sql.begin(async (sql) => {
        await sql`set local role anon`;
        return sql`select * from public.connections`;
      }),
    ).rejects.toMatchObject({ code: "42501" });
  });
  it.each([56, 57, 58, 59, 60, 61, 63])(
    "denies unavailable target %s and unavailable actor",
    async (i) => {
      await expect(
        asUser(
          0,
          `insert into public.connections(requester_id,receiver_id) values ('${profile(0)}','${profile(i)}')`,
        ),
      ).rejects.toMatchObject({ code: "42501" });
      await expect(
        asUser(
          i,
          `insert into public.connections(requester_id,receiver_id) values ('${profile(i)}','${profile(0)}')`,
        ),
      ).rejects.toMatchObject({ code: "42501" });
    },
  );
  it("denies forged requester, self, accepted insert and fabricated timestamps", async () => {
    for (const query of [
      `insert into public.connections(requester_id,receiver_id) values ('${profile(1)}','${profile(2)}')`,
      `insert into public.connections(requester_id,receiver_id) values ('${profile(0)}','${profile(0)}')`,
      `insert into public.connections(requester_id,receiver_id,status) values ('${profile(0)}','${profile(1)}','accepted')`,
      `insert into public.connections(requester_id,receiver_id,created_at) values ('${profile(0)}','${profile(1)}',now())`,
    ])
      await expect(asUser(0, query)).rejects.toMatchObject({ code: "42501" });
    await expect(relation("pending", 0, 0)).rejects.toMatchObject({
      code: "23514",
    });
  });
  it("allows only receiver acceptance and prevents reversals or identity changes", async () => {
    const id = await relation();
    const accept = `update public.connections set status='accepted' where id='${id}' returning id`;
    expect(await asUser(0, accept)).toHaveLength(0);
    expect(await asUser(2, accept)).toHaveLength(0);
    for (const column of ["requester_id", "receiver_id", "id", "created_at"])
      await expect(
        asUser(
          1,
          `update public.connections set ${column}=${column} where id='${id}'`,
        ),
      ).rejects.toMatchObject({ code: "42501" });
    expect(await asUser(1, accept)).toHaveLength(1);
    expect(
      await asUser(
        1,
        `update public.connections set status='pending' where id='${id}' returning id`,
      ),
    ).toHaveLength(0);
  });
  it.each([
    ["pending", 0],
    ["pending", 1],
    ["accepted", 0],
    ["accepted", 1],
  ] as const)(
    "allows deletion of %s by participant %s",
    async (status, participant) => {
      const id = await relation(status);
      expect(
        await asUser(
          2,
          `delete from public.connections where id='${id}' returning id`,
        ),
      ).toHaveLength(0);
      expect(
        await asUser(
          participant,
          `delete from public.connections where id='${id}' returning id`,
        ),
      ).toHaveLength(1);
    },
  );
  it("hides and protects relations after a participant is blocked without deleting them", async () => {
    const id = await relation();
    await state.sql`update private.institution_students set status='blocked' where auth_user_id=${uid(1)}`;
    expect(await asUser(0, "select id from public.connections")).toHaveLength(
      0,
    );
    expect(
      await asUser(
        1,
        `delete from public.connections where id='${id}' returning id`,
      ),
    ).toHaveLength(0);
    expect(
      await asUser(
        1,
        `update public.connections set status='accepted' where id='${id}' returning id`,
      ),
    ).toHaveLength(0);
    expect(await state.sql`select id from public.connections`).toHaveLength(1);
  });
});

describe("connections services and Networks", () => {
  it("runs the mutual connection lifecycle with distinct profile and auth UUIDs", async () => {
    expect(await getConnectionState(profile(0))).toEqual({ kind: "self" });
    expect(await getConnectionState(profile(1))).toEqual({ kind: "none" });
    const id = await sendConnectionRequest(profile(1));
    expect(await getConnectionState(profile(1))).toEqual({
      kind: "outgoing",
      id,
    });
    await expect(acceptConnectionRequest(id)).rejects.toThrow(
      "não está mais disponível",
    );
    await expect(rejectConnectionRequest(id)).rejects.toThrow(
      "não está mais disponível",
    );
    login(1);
    expect(await getConnectionState(profile(0))).toEqual({
      kind: "incoming",
      id,
    });
    await expect(cancelConnectionRequest(id)).rejects.toThrow(
      "não está mais disponível",
    );
    await acceptConnectionRequest(id);
    expect((await getConnections()).accepted.items[0].person.profile_id).toBe(
      profile(0),
    );
    login(0);
    expect(await getConnectionState(profile(1))).toEqual({
      kind: "accepted",
      id,
    });
    await expect(cancelConnectionRequest(id)).rejects.toThrow(
      "não está mais disponível",
    );
    await removeConnection(id);
    expect(await getConnectionState(profile(1))).toEqual({ kind: "none" });
  });
  it("cancels and declines by deletion, allowing a fresh request in either direction", async () => {
    const first = await sendConnectionRequest(profile(1));
    await cancelConnectionRequest(first);
    const second = await sendConnectionRequest(profile(1));
    login(1);
    await rejectConnectionRequest(second);
    await sendConnectionRequest(profile(0));
    expect(await state.sql`select id from public.connections`).toHaveLength(1);
  });
  it("maps duplicate, reverse duplicate and queued concurrent requests safely", async () => {
    const results = await Promise.allSettled([
      sendConnectionRequest(profile(1)),
      sendConnectionRequest(profile(1)),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      (
        results.find(
          (result) => result.status === "rejected",
        ) as PromiseRejectedResult
      ).reason.message,
    ).toContain("Já existe");
    login(1);
    await expect(sendConnectionRequest(profile(0))).rejects.toThrow(
      "Já existe",
    );
    expect(await state.sql`select id from public.connections`).toHaveLength(1);
  });
  it("rejects invalid IDs, missing records, self and unavailable targets", async () => {
    for (const method of [
      sendConnectionRequest,
      getConnectionState,
      acceptConnectionRequest,
      rejectConnectionRequest,
      cancelConnectionRequest,
      removeConnection,
    ])
      await expect(method("invalid")).rejects.toThrow();
    for (const method of [
      acceptConnectionRequest,
      rejectConnectionRequest,
      cancelConnectionRequest,
      removeConnection,
    ])
      await expect(method(uid(9999))).rejects.toThrow(
        "não está mais disponível",
      );
    await expect(sendConnectionRequest(profile(0))).rejects.toThrow(
      "consigo mesmo",
    );
    for (const i of [56, 57, 58, 59, 60, 61, 63])
      await expect(sendConnectionRequest(profile(i))).rejects.toThrow(
        "não está disponível",
      );
    expect(await getConnectionState(profile(56))).toEqual({
      kind: "unavailable",
    });
    login(63);
    await expect(getConnections()).rejects.toThrow(
      "Seu perfil não está disponível",
    );
  });
  it("builds bounded lists, sorts requests and accepted names, signs all avatars together and excludes private data", async () => {
    await relation("pending", 1, 0);
    const newer = await relation("pending", 2, 0);
    await state.sql`update public.connections set created_at='2099-01-01' where id=${newer}`;
    await relation("pending", 0, 3);
    for (let i = 4; i < 56; i++) await relation("accepted", 0, i);
    const result = await getConnections();
    expect(result.incoming.items.map((row) => row.person.profile_id)).toEqual([
      profile(2),
      profile(1),
    ]);
    expect(result.outgoing.items).toHaveLength(1);
    expect(result.accepted.total).toBe(52);
    expect(result.accepted.items).toHaveLength(50);
    expect(result.accepted.items[0].person.name).toBe("Pessoa 04");
    expect(result.accepted.items[49].person.name).toBe("Pessoa 53");
    expect(state.signed).toHaveBeenCalledExactlyOnceWith(
      [`${uid(1)}/avatar.png`],
      300,
    );
    expect(result.incoming.items[1].person.avatar_url).toBe(
      "https://example.test/signed",
    );
    for (const key of [
      "email",
      "phone",
      "birth_date",
      "cpf",
      "cpf_fingerprint",
      "auth_user_id",
      "user_id",
      "ra",
    ])
      expect(JSON.stringify(result)).not.toContain(`"${key}"`);
    state.signed.mockResolvedValueOnce({
      data: null,
      error: { message: "denied" },
    });
    expect(
      (await getConnections()).incoming.items[1].person.avatar_url,
    ).toBeNull();
  });
  it("loads all four states in Networks while preserving filters and pagination", async () => {
    await relation("pending", 0, 1);
    await relation("pending", 2, 0);
    await relation("accepted", 0, 3);
    const result = await searchNetworks(uid(0), {});
    expect(
      result.students.find((p) => p.id === profile(1))?.connection.kind,
    ).toBe("outgoing");
    expect(
      result.students.find((p) => p.id === profile(2))?.connection.kind,
    ).toBe("incoming");
    expect(
      result.students.find((p) => p.id === profile(3))?.connection.kind,
    ).toBe("accepted");
    expect(
      result.students.find((p) => p.id === profile(4))?.connection.kind,
    ).toBe("none");
    expect(
      (await searchNetworks(uid(0), { q: "person_2" })).students.every((p) =>
        p.username.includes("person_2"),
      ),
    ).toBe(true);
    expect((await searchNetworks(uid(0), { page: "2" })).students).toHaveLength(
      24,
    );
    const queries: string[] = [];
    const fakeSql = Object.assign((parts: TemplateStringsArray) => {
      queries.push(parts.join("?"));
      return Promise.resolve([]);
    }, {});
    await connectionStatesFor(
      fakeSql as unknown as Parameters<typeof connectionStatesFor>[0],
      Array.from({ length: 24 }, (_, i) => profile(i)),
    );
    expect(
      queries.filter((q) => q.includes("from public.connections")),
    ).toHaveLength(1);
  });
  it("omits subsequently blocked peers from all social reads and refuses stale writes", async () => {
    const id = await relation();
    await state.sql`update private.institution_students set status='blocked' where auth_user_id=${uid(1)}`;
    expect((await getConnections()).outgoing.total).toBe(0);
    expect(await getConnectionState(profile(1))).toEqual({
      kind: "unavailable",
    });
    await expect(cancelConnectionRequest(id)).rejects.toThrow(
      "não está mais disponível",
    );
    await expect(sendConnectionRequest(profile(1))).rejects.toThrow(
      "não está disponível",
    );
  });
});
