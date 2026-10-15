import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import postgres from "postgres";
import { randomUUID } from "node:crypto";
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
}));
vi.mock("@/lib/institution/database", () => ({ database: () => state.sql }));
vi.mock("@/services/session", () => ({
  requireUser: vi.fn(),
  requireAdmin: vi.fn(),
}));
import {
  saveCertificate,
  deleteCertificate,
  reviewCertificate,
  certificateFile,
  queueCertificateCleanup,
  retryCertificateCleanup,
} from "@/services/certificates";
import {
  blockProfile,
  reportContent,
  reviewReport,
  savePrivacy,
  privacyKeys,
} from "@/services/moderation";
import { searchNetworks } from "@/services/networks";
import {
  saveListingData,
  searchListings,
  changeListingStatus,
} from "@/services/marketplace";
const uid = (i: number) =>
  `80000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
const pid = (i: number) =>
  `90000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
let db: PGlite, server: PGLiteSocketServer, category: string;
const cert = {
  title: "Curso de programação",
  issuer: "Universidade de teste",
  issue_date: "2026-01-01",
  expiration_date: "",
  credential_id: "ABC123",
  verification_url: "https://example.test/validar",
};
async function asUser(actor: string, query: string) {
  return state.sql.begin(async (sql) => {
    await sql`select set_config('request.jwt.claim.sub',${actor},true)`;
    await sql`set local role authenticated`;
    return sql.unsafe(query);
  });
}
beforeAll(async () => {
  db = await PGlite.create();
  await db.exec(`create role anon;create role authenticated;create role supabase_auth_admin;create schema auth;create schema storage;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,is_anonymous boolean default false,banned_until timestamptz,raw_app_meta_data jsonb default '{}',raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth,storage to authenticated,anon;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;
    grant select,insert,update,delete on storage.objects to authenticated;
    create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;`);
  for (const file of readdirSync("supabase/migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await db.exec(readFileSync(`supabase/migrations/${file}`, "utf8"));
  for (let i = 1; i <= 4; i++) {
    await db.query(
      "insert into auth.users(id,email,email_confirmed_at) values ($1,$2,now())",
      [uid(i), `mvp${i}@example.test`],
    );
    if (i < 4) {
      await db.query(
        "insert into private.institution_students(institution_id,auth_user_id,ra,name,email,phone,birth_date,cpf_fingerprint,status,activated_at,semester) values ('fatece',$1,$2,$3,$4,'5511999999999','2000-01-01',$5,'active',now(),8)",
        [
          uid(i),
          `MVP${i}`,
          `Pessoa ${i}`,
          `mvp${i}@example.test`,
          String(i).repeat(64),
        ],
      );
      await db.query(
        "insert into public.profiles(id,user_id,username,name,bio,institution,institution_id,semester) values ($1,$2,$3,$4,'Bio reservada','FATECE','fatece',8)",
        [pid(i), uid(i), `mvp_${i}`, `Pessoa ${i}`],
      );
    }
  }
  await db.query(
    "insert into private.admin_users(user_id,institution_id) values ($1,'fatece')",
    [uid(4)],
  );
  server = new PGLiteSocketServer({ db, port: 0, host: "127.0.0.1" });
  await server.start();
  const uri = server.getServerConn();
  state.sql = postgres(
    uri.startsWith("postgres") ? uri : `postgres://postgres@${uri}/postgres`,
    { max: 1, prepare: false, onnotice() {} },
  );
  category = (
    await state.sql`select id from public.categories where not is_service limit 1`
  )[0].id;
});
beforeEach(async () => {
  await state.sql`truncate private.certificate_file_cleanup,public.profile_certificates,public.reports,public.user_blocks,public.profile_privacy,public.connections,public.listings,public.projects,public.profile_skills,public.profile_interests,storage.objects cascade`;
  await state.sql`update private.institution_students set status='active'`;
});
afterAll(async () => {
  await state.sql?.end();
  await server?.stop();
  await db?.close();
});

describe("private certificates", () => {
  it("keeps interrupted uploads retryable without deleting active files or another owner's paths", async () => {
    const id = randomUUID(),
      path = `${uid(1)}/${id}/${randomUUID()}.pdf`;
    const remove = vi.fn().mockResolvedValue({ error: null });
    const client = {
      storage: { from: () => ({ remove }) },
    } as unknown as Parameters<typeof retryCertificateCleanup>[1];
    await expect(queueCertificateCleanup(uid(2), path)).rejects.toThrow(
      "inválido",
    );
    await queueCertificateCleanup(uid(1), path, true);
    expect(await retryCertificateCleanup(uid(1), client)).toBe(1);
    expect(remove).not.toHaveBeenCalled();
    await saveCertificate(uid(1), id, cert, path);
    expect(
      await state.sql`select path from private.certificate_file_cleanup`,
    ).toHaveLength(0);
    await saveCertificate(uid(1), id, cert, null);
    remove.mockResolvedValueOnce({ error: { message: "Storage offline" } });
    expect(await retryCertificateCleanup(uid(1), client)).toBe(1);
    expect(await retryCertificateCleanup(uid(1), client)).toBe(0);
    expect(remove).toHaveBeenCalledWith([path]);
  });
  it("refuses a review submitted for an outdated document version", async () => {
    const id = randomUUID();
    await saveCertificate(uid(1), id, cert, null);
    await state.sql`update public.profile_certificates set updated_at=now()-interval '1 day' where id=${id}`;
    const [old] =
      await state.sql`select updated_at::text as version from public.profile_certificates where id=${id}`;
    await saveCertificate(
      uid(1),
      id,
      { ...cert, title: "Documento atualizado" },
      undefined,
    );
    await expect(
      reviewCertificate(uid(4), id, "verified", "", old.version),
    ).rejects.toThrow("indisponível");
    expect(
      (
        await state.sql`select status from public.profile_certificates where id=${id}`
      )[0].status,
    ).toBe("pending");
  });
  it("creates pending, hides originals from peers, permits admin review and exposes only verified metadata", async () => {
    const id = randomUUID(),
      path = `${uid(1)}/${id}/${randomUUID()}.pdf`;
    await saveCertificate(uid(1), id, cert, path);
    expect(
      (
        await asUser(
          uid(1),
          `select status from public.profile_certificates where id='${id}'`,
        )
      )[0].status,
    ).toBe("pending");
    expect(
      await asUser(
        uid(2),
        "select id,file_path from public.profile_certificates",
      ),
    ).toHaveLength(0);
    await expect(certificateFile(uid(2), id)).rejects.toThrow("indisponível");
    expect(await certificateFile(uid(4), id)).toBe(path);
    expect(
      await asUser(
        uid(2),
        `select * from public.visible_certificates('${pid(1)}')`,
      ),
    ).toHaveLength(0);
    await reviewCertificate(uid(4), id, "verified", "");
    const [visible] = await asUser(
      uid(2),
      `select * from public.visible_certificates('${pid(1)}')`,
    );
    expect(visible.title).toBe(cert.title);
    for (const field of [
      "file_path",
      "user_id",
      "verified_by",
      "rejection_reason",
    ])
      expect(visible).not.toHaveProperty(field);
  });
  it("cannot forge verification or edit another owner's record", async () => {
    const id = randomUUID();
    await saveCertificate(uid(1), id, cert, null);
    await expect(reviewCertificate(uid(1), id, "verified", "")).rejects.toThrow(
      "revogado",
    );
    await expect(
      asUser(
        uid(1),
        `update public.profile_certificates set status='verified' where id='${id}'`,
      ),
    ).rejects.toMatchObject({ code: "42501" });
    expect(
      await asUser(
        uid(2),
        `update public.profile_certificates set title='Fraude' where id='${id}' returning id`,
      ),
    ).toHaveLength(0);
    await expect(saveCertificate(uid(2), id, cert, null)).rejects.toMatchObject(
      { code: "23505" },
    );
  });
  it("resets prior verification when owner edits metadata or document", async () => {
    const id = randomUUID();
    await saveCertificate(uid(1), id, cert, null);
    await reviewCertificate(uid(4), id, "verified", "");
    await saveCertificate(
      uid(1),
      id,
      { ...cert, title: "Novo título do curso" },
      undefined,
    );
    const [row] =
      await state.sql`select status,verified_at,verified_by from public.profile_certificates where id=${id}`;
    expect(row).toEqual({
      status: "pending",
      verified_at: null,
      verified_by: null,
    });
    expect(
      await asUser(
        uid(2),
        `select * from public.visible_certificates('${pid(1)}')`,
      ),
    ).toHaveLength(0);
  });
  it("requires rejection reason and hides rejected metadata", async () => {
    const id = randomUUID();
    await saveCertificate(uid(1), id, cert, null);
    await expect(reviewCertificate(uid(4), id, "rejected", "")).rejects.toThrow(
      "motivo",
    );
    await reviewCertificate(uid(4), id, "rejected", "Código não localizado.");
    expect(
      (
        await asUser(
          uid(1),
          "select rejection_reason from public.profile_certificates",
        )
      )[0].rejection_reason,
    ).toContain("Código");
    expect(
      await asUser(
        uid(2),
        `select * from public.visible_certificates('${pid(1)}')`,
      ),
    ).toHaveLength(0);
  });
  it("does not remove metadata when Storage removal fails, retries safely, and denies peer deletion", async () => {
    const id = randomUUID(),
      path = `${uid(1)}/${id}/${randomUUID()}.pdf`;
    await saveCertificate(uid(1), id, cert, path);
    const remove = vi
      .fn()
      .mockRejectedValueOnce(new Error("Storage failed"))
      .mockResolvedValue(undefined);
    await expect(deleteCertificate(uid(2), id, remove)).rejects.toThrow(
      "indisponível",
    );
    expect(remove).not.toHaveBeenCalled();
    await expect(deleteCertificate(uid(1), id, remove)).rejects.toThrow(
      "Storage failed",
    );
    expect(
      await state.sql`select id from public.profile_certificates`,
    ).toHaveLength(1);
    await deleteCertificate(uid(1), id, remove);
    expect(
      await state.sql`select id from public.profile_certificates`,
    ).toHaveLength(0);
  });
  it("enforces private bucket, owner uploads and owner/admin-only downloads", async () => {
    const id = randomUUID(),
      path = `${uid(1)}/${id}/${randomUUID()}.pdf`;
    await saveCertificate(uid(1), id, cert, path);
    expect(
      (
        await state.sql`select public,file_size_limit from storage.buckets where id='certificates'`
      )[0],
    ).toMatchObject({ public: false, file_size_limit: "4194304" });
    await asUser(
      uid(1),
      `insert into storage.objects(bucket_id,name) values ('certificates','${path}')`,
    );
    expect(
      await asUser(
        uid(2),
        "select name from storage.objects where bucket_id='certificates'",
      ),
    ).toHaveLength(0);
    expect(
      await asUser(
        uid(4),
        "select name from storage.objects where bucket_id='certificates'",
      ),
    ).toHaveLength(1);
    await expect(
      asUser(
        uid(2),
        `insert into storage.objects(bucket_id,name) values ('certificates','${path}')`,
      ),
    ).rejects.toMatchObject({ code: "42501" });
  });
});

describe("reports and blocks", () => {
  it("enforces the report rate limit even through direct SQL as an API caller", async () => {
    for (let i = 0; i < 11; i++) {
      const id = randomUUID();
      await state.sql`insert into public.listings(id,seller_id,title,description,price,category_id,condition) values (${id},${pid(2)},'Oferta de teste','Descrição',10,${category},'used')`;
      const request = asUser(
        uid(1),
        `insert into public.reports(reporter_id,target_type,target_id,reason) values ('${uid(1)}','listing','${id}','fraud')`,
      );
      if (i === 10)
        await expect(request).rejects.toMatchObject({ code: "23514" });
      else await request;
    }
    expect(await state.sql`select id from public.reports`).toHaveLength(10);
  });
  it("validates target and ownership, prevents duplicate reports, and restricts review", async () => {
    const input = {
      target_type: "profile",
      target_id: pid(2),
      reason: "harassment",
      details: "Relato de teste",
    };
    await expect(reportContent(uid(2), input)).rejects.toMatchObject({
      code: "42501",
    });
    await reportContent(uid(1), input);
    await expect(reportContent(uid(1), input)).rejects.toMatchObject({
      code: "23505",
    });
    expect(await asUser(uid(3), "select id from public.reports")).toHaveLength(
      0,
    );
    const [r] = await state.sql`select id from public.reports`;
    await expect(reviewReport(uid(1), r.id, "actioned")).rejects.toThrow(
      "indisponível",
    );
    await reviewReport(uid(4), r.id, "reviewed");
    await reviewReport(uid(4), r.id, "dismissed");
    await reviewReport(uid(4), r.id, "actioned");
    expect((await state.sql`select status from public.reports`)[0].status).toBe(
      "actioned",
    );
  });
  it("accepts a Marketplace report and refuses own or nonexistent listing", async () => {
    const id = await saveListingData(uid(1), {
      title: "Livro de teste",
      description: "Descrição",
      category_id: category,
      condition: "used",
      price: "10,00",
    });
    await changeListingStatus(uid(1), id, "active");
    await reportContent(uid(2), {
      target_type: "listing",
      target_id: id,
      reason: "fraud",
    });
    await expect(
      reportContent(uid(1), {
        target_type: "listing",
        target_id: id,
        reason: "fraud",
      }),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      reportContent(uid(2), {
        target_type: "listing",
        target_id: randomUUID(),
        reason: "fraud",
      }),
    ).rejects.toMatchObject({ code: "42501" });
  });
  it.each(["pending", "accepted"])(
    "blocking removes %s connections, hides both ways and prevents direct requests",
    async (status) => {
      await state.sql`insert into public.connections(requester_id,receiver_id,status) values (${pid(1)},${pid(2)},${status})`;
      await blockProfile(uid(1), pid(2), true);
      expect(await state.sql`select id from public.connections`).toHaveLength(
        0,
      );
      expect(
        await asUser(
          uid(1),
          `select id from public.profiles where id='${pid(2)}'`,
        ),
      ).toHaveLength(0);
      expect(
        await asUser(
          uid(2),
          `select id from public.profiles where id='${pid(1)}'`,
        ),
      ).toHaveLength(0);
      expect(
        (await searchNetworks(uid(1), {})).students.map((s) => s.id),
      ).not.toContain(pid(2));
      expect(
        (await searchNetworks(uid(2), {})).students.map((s) => s.id),
      ).not.toContain(pid(1));
      await expect(
        asUser(
          uid(2),
          `insert into public.connections(requester_id,receiver_id) values ('${pid(2)}','${pid(1)}')`,
        ),
      ).rejects.toMatchObject({ code: "42501" });
      await blockProfile(uid(1), pid(2), false);
      expect(await state.sql`select id from public.connections`).toHaveLength(
        0,
      );
      expect(
        (await searchNetworks(uid(1), {})).students.map((s) => s.id),
      ).toContain(pid(2));
    },
  );
  it("prevents self-block and hides blocked seller offers", async () => {
    await expect(blockProfile(uid(1), pid(1), true)).rejects.toThrow(
      "indisponível",
    );
    const listingId = await saveListingData(uid(2), {
      title: "Livro de teste",
      description: "Descrição",
      category_id: category,
      condition: "used",
      price: "10,00",
    });
    await changeListingStatus(uid(2), listingId, "active");
    expect((await searchListings(uid(1), {})).total).toBe(1);
    await blockProfile(uid(1), pid(2), true);
    expect((await searchListings(uid(1), {})).total).toBe(0);
  });
});

describe("profile privacy beyond the UI", () => {
  it("masks raw optional fields and preserves owner reads through the safe RPC", async () => {
    await savePrivacy(
      uid(1),
      Object.fromEntries(privacyKeys.map((k) => [k, false])),
    );
    await expect(
      asUser(uid(2), "select bio,semester from public.profiles"),
    ).rejects.toMatchObject({ code: "42501" });
    const [peer] = await asUser(
      uid(2),
      `select public.social_profile(null,'${pid(1)}') as profile`,
    );
    expect(peer.profile.bio).toBeNull();
    expect(peer.profile.semester).toBeNull();
    const [owner] = await asUser(
      uid(1),
      "select public.social_profile() as profile",
    );
    expect(owner.profile.bio).toBe("Bio reservada");
    expect(owner.profile.semester).toBe(8);
    for (const key of [
      "ra",
      "cpf",
      "cpf_fingerprint",
      "email",
      "phone",
      "birth_date",
      "user_id",
    ])
      expect(owner.profile).not.toHaveProperty(key);
    expect(
      (await searchNetworks(uid(2), { semester: "8" })).students.map(
        (s) => s.id,
      ),
    ).not.toContain(pid(1));
  });
  it("hides interests, skills, projects, storage and listings from peers while preserving ownership", async () => {
    await state.sql`insert into public.profile_skills(profile_id,skill_id) select ${pid(1)},id from public.skills limit 1`;
    await state.sql`insert into public.profile_interests(profile_id,interest_id) select ${pid(1)},id from public.interests limit 1`;
    await state.sql`insert into public.projects(profile_id,title,description) values (${pid(1)},'Projeto reservado','Descrição')`;
    await saveListingData(uid(1), {
      title: "Livro reservado",
      description: "Descrição",
      category_id: category,
      condition: "used",
      price: "10,00",
    });
    await state.sql`insert into storage.objects(bucket_id,name) values ('project-images',${`${uid(1)}/image.png`})`;
    await savePrivacy(
      uid(1),
      Object.fromEntries(privacyKeys.map((k) => [k, false])),
    );
    for (const table of [
      "profile_skills",
      "profile_interests",
      "projects",
      "listings",
    ]) {
      expect(
        await asUser(uid(2), `select id from public.${table}`),
      ).toHaveLength(0);
      expect(
        await asUser(uid(1), `select id from public.${table}`),
      ).toHaveLength(1);
    }
    expect(
      await asUser(uid(2), "select name from storage.objects"),
    ).toHaveLength(0);
    expect((await searchListings(uid(2), {})).total).toBe(0);
    const student = (await searchNetworks(uid(2), {})).students.find(
      (s) => s.id === pid(1),
    );
    expect(student?.skills).toEqual([]);
    expect(student?.interests).toEqual([]);
    await expect(savePrivacy(uid(3), { show_bio: "false" })).rejects.toThrow();
  });
  it("denies inactive actors and blocks verified metadata too", async () => {
    const id = randomUUID();
    await saveCertificate(uid(1), id, cert, null);
    await reviewCertificate(uid(4), id, "verified", "");
    await blockProfile(uid(1), pid(2), true);
    expect(
      await asUser(
        uid(2),
        `select * from public.visible_certificates('${pid(1)}')`,
      ),
    ).toHaveLength(0);
    await state.sql`update private.institution_students set status='inactive' where auth_user_id=${uid(1)}`;
    await expect(
      saveCertificate(uid(1), randomUUID(), cert, null),
    ).rejects.toThrow("indisponível");
    expect(
      await asUser(uid(1), "select id from public.profile_certificates"),
    ).toHaveLength(0);
  });
});
