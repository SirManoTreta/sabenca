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
  eligibleCertificates,
} from "@/services/certificates";
import {
  blockProfile,
  reportContent,
  reviewReport,
  savePrivacy,
  privacyKeys,
  deactivateReportedListing,
} from "@/services/moderation";
import { searchNetworks } from "@/services/networks";
import {
  saveListingData,
  searchListings,
  changeListingStatus,
} from "@/services/marketplace";
import { saveMarketplaceContact } from "@/services/marketplace-contact";
import { updateStudentAcademics } from "@/services/student-academics";
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
async function serviceInput(certificates: string | string[] = []) {
  const [category] =
    await state.sql`select id from public.categories where is_service limit 1`;
  return {
    title: "Manutenção de computadores",
    description: "Serviço universitário",
    price: "50,00",
    category_id: category.id,
    condition: "not_applicable",
    certificate_ids:
      typeof certificates === "string" ? [certificates] : certificates,
  };
}
async function approvedCertificate(owner = uid(1), values = cert) {
  const id = randomUUID();
  await saveCertificate(owner, id, values, null);
  await reviewCertificate(uid(4), id, "verified", "");
  return id;
}
async function visibleCredential(id: string, viewer = uid(2)) {
  return (
    await asUser(
      viewer,
      `select public.listing_credential('${id}') as credential`,
    )
  )[0].credential;
}
async function visibleCredentials(id: string, viewer = uid(2)) {
  return (
    await asUser(
      viewer,
      `select public.listing_credentials('${id}') as credentials`,
    )
  )[0].credentials as {
    id: string;
    title: string;
    issuer: string;
    issue_date: string;
    expiration_date: string | null;
  }[];
}
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
  await state.sql`truncate private.certificate_file_cleanup,public.profile_certificates,public.reports,public.user_blocks,public.profile_privacy,public.marketplace_contacts,public.connections,public.listings,public.projects,public.profile_skills,public.profile_interests,storage.objects cascade`;
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
  it("does not reveal third-party block state through BEFORE trigger errors", async () => {
    const request = `insert into public.connections(requester_id,receiver_id) values ('${pid(1)}','${pid(2)}')`;
    await expect(asUser(uid(3), request)).rejects.toMatchObject({
      code: "42501",
      message: "Connection authorization required",
    });
    await blockProfile(uid(1), pid(2), true);
    await expect(asUser(uid(3), request)).rejects.toMatchObject({
      code: "42501",
      message: "Connection authorization required",
    });
  });
  it("does not grant API access to internal reviewer identifiers", async () => {
    await expect(
      asUser(uid(1), "select verified_by from public.profile_certificates"),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      asUser(uid(1), "select reviewed_by from public.reports"),
    ).rejects.toMatchObject({ code: "42501" });
  });
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

describe("service credentials, consent and effective moderation", () => {
  it("supports services with and without an optional current credential and keeps the DTO private", async () => {
    const certificate = await approvedCertificate();
    const input = await serviceInput(certificate);
    const id = await saveListingData(uid(1), input);
    await changeListingStatus(uid(1), id, "active");
    const plain = await saveListingData(uid(1), await serviceInput());
    await changeListingStatus(uid(1), plain, "active");
    expect(await eligibleCertificates(uid(1))).toEqual([
      expect.objectContaining({ id: certificate }),
    ]);
    expect(await eligibleCertificates(uid(2))).toEqual([]);
    const credential = await visibleCredential(id);
    expect(credential).toEqual({
      id: certificate,
      title: cert.title,
      issuer: cert.issuer,
      issue_date: cert.issue_date,
      expiration_date: null,
    });
    expect(await visibleCredential(plain)).toBeNull();
    const listings = (await searchListings(uid(2), {})).listings;
    expect(listings).toHaveLength(2);
    expect(listings.find((l) => l.id === id)?.credentials).toEqual([
      credential,
    ]);
    for (const key of [
      "file_path",
      "verified_by",
      "rejection_reason",
      "contact_url",
      "email",
      "phone",
      "birth_date",
      "cpf_fingerprint",
    ])
      expect(JSON.stringify(listings)).not.toContain(`"${key}"`);
    await saveListingData(
      uid(1),
      { ...input, title: "Serviço atualizado" },
      id,
    );
    expect(await visibleCredential(id)).toEqual(credential);
    await saveListingData(uid(1), await serviceInput(), id);
    expect(await visibleCredential(id)).toBeNull();
  });
  it("rejects forged owner IDs, products and pending/rejected/expired credentials in services and direct SQL", async () => {
    const foreign = await approvedCertificate(uid(2));
    const pending = randomUUID(),
      rejected = randomUUID();
    await saveCertificate(uid(1), pending, cert, null);
    await saveCertificate(uid(1), rejected, cert, null);
    await reviewCertificate(
      uid(4),
      rejected,
      "rejected",
      "Documento incompleto",
    );
    const expired = await approvedCertificate(uid(1), {
      ...cert,
      expiration_date: "2026-01-02",
    });
    const service = await serviceInput();
    const own = await approvedCertificate();
    const id = await saveListingData(uid(1), service);
    const product = await saveListingData(uid(1), {
      ...service,
      category_id: category,
      condition: "used",
    });
    for (const certificate of [
      foreign,
      pending,
      rejected,
      expired,
      randomUUID(),
    ]) {
      await expect(
        saveListingData(uid(1), { ...service, certificate_ids: [certificate] }),
      ).rejects.toThrow("Credencial indisponível");
      await expect(
        asUser(
          uid(1),
          `insert into public.listing_certificates(listing_id,certificate_id,position) values ('${id}','${certificate}',0)`,
        ),
      ).rejects.toThrow("credential unavailable");
      await expect(
        asUser(
          uid(1),
          `insert into public.listing_certificates(listing_id,certificate_id,position) values ('${id}','${certificate}',1)`,
        ),
      ).rejects.toThrow("credential unavailable");
    }
    await expect(
      saveListingData(uid(1), {
        ...service,
        category_id: category,
        condition: "used",
        certificate_ids: [own],
      }),
    ).rejects.toThrow("Somente serviços");
    await expect(
      asUser(
        uid(1),
        `insert into public.listing_certificates(listing_id,certificate_id,position) values ('${product}','${own}',0)`,
      ),
    ).rejects.toThrow("Only services");
    await expect(
      asUser(
        uid(2),
        `insert into public.listing_certificates(listing_id,certificate_id,position) values ('${id}','${own}',0)`,
      ),
    ).rejects.toThrow("credential unavailable");
    expect((await eligibleCertificates(uid(1))).map((c) => c.id)).toEqual([
      own,
    ]);
  });
  it("derives validity on every read after editing, re-review, rejection, expiration and deletion", async () => {
    const certificate = await approvedCertificate();
    const id = await saveListingData(uid(1), await serviceInput(certificate));
    await changeListingStatus(uid(1), id, "active");
    await saveCertificate(
      uid(1),
      certificate,
      { ...cert, title: "Documento alterado" },
      undefined,
    );
    expect(
      (
        await state.sql`select status from public.profile_certificates where id=${certificate}`
      )[0].status,
    ).toBe("pending");
    expect(await visibleCredential(id)).toBeNull();
    await reviewCertificate(uid(4), certificate, "verified", "");
    expect(await visibleCredential(id)).toMatchObject({
      title: "Documento alterado",
    });
    await reviewCertificate(
      uid(4),
      certificate,
      "rejected",
      "Revisão documental",
    );
    expect(await visibleCredential(id)).toBeNull();
    await saveCertificate(
      uid(1),
      certificate,
      { ...cert, expiration_date: "2026-01-02" },
      undefined,
    );
    await reviewCertificate(uid(4), certificate, "verified", "");
    expect(await visibleCredential(id)).toBeNull();
    expect(await eligibleCertificates(uid(1))).toHaveLength(0);
    // History remains in the profile even though it cannot be used in services.
    expect(
      await asUser(
        uid(2),
        `select * from public.visible_certificates('${pid(1)}')`,
      ),
    ).toHaveLength(1);
    await deleteCertificate(uid(1), certificate, async () => {});
    expect(
      await state.sql`select certificate_id from public.listing_certificates where listing_id=${id}`,
    ).toHaveLength(0);
    expect((await searchListings(uid(2), {})).total).toBe(1);
    expect(await visibleCredential(id)).toBeNull();
  });
  it("requires a real stored file or a valid verification URL even for direct administrative approval", async () => {
    const id = randomUUID(),
      path = `${uid(1)}/${id}/${randomUUID()}.pdf`;
    await saveCertificate(uid(1), id, { ...cert, verification_url: "" }, path);
    await expect(reviewCertificate(uid(4), id, "verified", "")).rejects.toThrow(
      "evidence required",
    );
    await expect(
      asUser(
        uid(4),
        `update public.profile_certificates set status='verified' where id='${id}'`,
      ),
    ).rejects.toThrow("evidence required");
    await expect(
      reviewCertificate(uid(4), id, "rejected", " "),
    ).rejects.toThrow("motivo");
    await expect(
      asUser(
        uid(4),
        `update public.profile_certificates set status='rejected',rejection_reason=null where id='${id}'`,
      ),
    ).rejects.toThrow();
    await state.sql`insert into storage.objects(bucket_id,name) values ('certificates',${path})`;
    await reviewCertificate(uid(4), id, "verified", "");
    const listing = await saveListingData(uid(1), await serviceInput(id));
    await changeListingStatus(uid(1), listing, "active");
    expect(await visibleCredential(listing)).not.toBeNull();
    await state.sql`delete from storage.objects where name=${path}`;
    expect(await visibleCredential(listing)).toBeNull();
    expect(await eligibleCertificates(uid(1))).toHaveLength(0);
    await expect(
      asUser(
        uid(1),
        `insert into storage.objects(bucket_id,name) values ('certificates','${path}')`,
      ),
    ).rejects.toThrow("row-level security");
    // Raw Data API writes cannot make a malformed source into valid evidence.
    await asUser(
      uid(1),
      `update public.profile_certificates set verification_url='https:///' where id='${id}'`,
    );
    // Editing makes a new upload eligible again, but never reinstates approval.
    await asUser(
      uid(1),
      `insert into storage.objects(bucket_id,name) values ('certificates','${path}')`,
    );
    expect(
      (
        await state.sql`select status from public.profile_certificates where id=${id}`
      )[0].status,
    ).toBe("pending");
    await state.sql`delete from storage.objects where name=${path}`;
    await expect(reviewCertificate(uid(4), id, "verified", "")).rejects.toThrow(
      "evidence required",
    );
  });
  it("hides credentials from blocked, inactive and nonmember viewers and inactive sellers", async () => {
    const certificate = await approvedCertificate();
    const id = await saveListingData(uid(1), await serviceInput(certificate));
    await changeListingStatus(uid(1), id, "active");
    expect(await visibleCredential(id, uid(4))).toBeNull();
    await blockProfile(uid(2), pid(1), true);
    expect(await visibleCredential(id)).toBeNull();
    await blockProfile(uid(2), pid(1), false);
    await state.sql`update private.institution_students set status='inactive' where auth_user_id=${uid(1)}`;
    expect(await visibleCredential(id)).toBeNull();
    expect((await searchListings(uid(2), {})).total).toBe(0);
  });
  it("publishes only a voluntarily entered, enabled contact; respects privacy and bilateral blocks", async () => {
    const lookup = async (viewer = uid(2)) =>
      (
        await asUser(
          viewer,
          `select public.marketplace_contact('${pid(1)}') as url`,
        )
      )[0].url;
    expect(await lookup()).toBeNull();
    await saveMarketplaceContact(uid(1), {
      url: "https://wa.me/5511999999999",
      enabled: false,
    });
    expect(await lookup()).toBeNull();
    expect(
      await asUser(uid(2), "select * from public.marketplace_contacts"),
    ).toHaveLength(0);
    await expect(
      asUser(
        uid(2),
        `insert into public.marketplace_contacts(user_id,url,enabled) values ('${uid(1)}','https://attacker.test',true)`,
      ),
    ).rejects.toThrow();
    await saveMarketplaceContact(uid(1), {
      url: "https://wa.me/5511999999999",
      enabled: true,
    });
    expect(await lookup()).toBe("https://wa.me/5511999999999");
    expect(await lookup(uid(4))).toBeNull();
    await savePrivacy(
      uid(1),
      Object.fromEntries(privacyKeys.map((k) => [k, k !== "show_listings"])),
    );
    expect(await lookup()).toBeNull();
    await savePrivacy(
      uid(1),
      Object.fromEntries(privacyKeys.map((k) => [k, true])),
    );
    await blockProfile(uid(1), pid(2), true);
    expect(await lookup()).toBeNull();
    await blockProfile(uid(1), pid(2), false);
    await saveMarketplaceContact(uid(1), {
      url: "https://wa.me/5511999999999",
      enabled: false,
    });
    expect(await lookup()).toBeNull();
    await expect(
      asUser(
        uid(1),
        `update public.marketplace_contacts set url='javascript:alert(1)',enabled=true where user_id='${uid(1)}'`,
      ),
    ).rejects.toThrow();
    await state.sql`update private.institution_students set status='blocked' where auth_user_id=${uid(1)}`;
    await expect(
      saveMarketplaceContact(uid(1), {
        url: "https://example.test",
        enabled: true,
      }),
    ).rejects.toThrow();
  });
  it("deactivates a reported listing atomically, records the actor and prevents seller republication", async () => {
    const id = await saveListingData(uid(1), await serviceInput());
    await changeListingStatus(uid(1), id, "active");
    await reportContent(uid(2), {
      target_type: "listing",
      target_id: id,
      reason: "fraud",
    });
    const [report] =
      await state.sql`select id from public.reports where target_id=${id}`;
    await expect(deactivateReportedListing(uid(2), report.id)).rejects.toThrow(
      "Administrator required",
    );
    expect((await searchListings(uid(2), {})).total).toBe(1);
    await deactivateReportedListing(uid(4), report.id);
    expect((await searchListings(uid(2), {})).total).toBe(0);
    expect((await searchListings(uid(1), {}, true)).total).toBe(1);
    expect(
      (
        await state.sql`select status,reviewed_by from public.reports where id=${report.id}`
      )[0],
    ).toMatchObject({ status: "actioned", reviewed_by: uid(4) });
    expect(
      (
        await state.sql`select moderated_by from private.listing_moderation where listing_id=${id}`
      )[0].moderated_by,
    ).toBe(uid(4));
    await expect(changeListingStatus(uid(1), id, "active")).rejects.toThrow(
      "disabled by moderation",
    );
    await expect(
      asUser(
        uid(1),
        `update public.listings set status='active' where id='${id}'`,
      ),
    ).rejects.toThrow("disabled by moderation");
    await expect(
      asUser(uid(1), "delete from private.listing_moderation"),
    ).rejects.toThrow("permission denied");
    await expect(
      deactivateReportedListing(uid(4), randomUUID()),
    ).rejects.toThrow("unavailable");
  });
});

describe("multiple service credentials", () => {
  it.each([0, 1, 2, 3])(
    "stores %i selected credentials in their chosen order",
    async (count) => {
      const available = await Promise.all(
        ["Linux", "Redes", "Docker", "Python"].map((title) =>
          approvedCertificate(uid(1), { ...cert, title }),
        ),
      );
      const selected = [available[2], available[0], available[1]].slice(
        0,
        count,
      );
      const id = await saveListingData(uid(1), await serviceInput(selected));
      await changeListingStatus(uid(1), id, "active");
      expect((await visibleCredentials(id)).map((c) => c.id)).toEqual(selected);
      expect(
        await state.sql`select certificate_id,position from public.listing_certificates where listing_id=${id} order by position`,
      ).toEqual(
        selected.map((certificate_id, position) => ({
          certificate_id,
          position,
        })),
      );
      expect(
        (await searchListings(uid(2), {})).listings[0].credentials.map(
          (c) => c.id,
        ),
      ).toEqual(selected);
      expect(
        (
          await state.sql`select certificate_id from public.listings where id=${id}`
        )[0].certificate_id,
      ).toBe(selected[0] ?? null);
      // The profile remains an unrestricted catalog, not an announcement-specific selection.
      expect(
        await asUser(
          uid(2),
          `select * from public.visible_certificates('${pid(1)}')`,
        ),
      ).toHaveLength(4);
    },
  );

  it("rejects a fourth credential and duplicates in backend and raw SQL", async () => {
    const certificates = [];
    for (let i = 0; i < 4; i++)
      certificates.push(
        await approvedCertificate(uid(1), {
          ...cert,
          title: `Credencial ${i}`,
        }),
      );
    const id = await saveListingData(
      uid(1),
      await serviceInput(certificates.slice(0, 3)),
    );
    await expect(
      saveListingData(uid(1), await serviceInput(certificates)),
    ).rejects.toThrow();
    await expect(
      saveListingData(
        uid(1),
        await serviceInput([certificates[0], certificates[0]]),
      ),
    ).rejects.toThrow();
    await expect(
      asUser(
        uid(1),
        `insert into public.listing_certificates(listing_id,certificate_id,position) values ('${id}','${certificates[3]}',3)`,
      ),
    ).rejects.toMatchObject({ code: "23514" });
    // A racing request cannot use an existing slot to bypass the three-position limit.
    await expect(
      asUser(
        uid(1),
        `insert into public.listing_certificates(listing_id,certificate_id,position) values ('${id}','${certificates[3]}',2)`,
      ),
    ).rejects.toMatchObject({ code: "23505" });
    await expect(
      asUser(
        uid(1),
        `insert into public.listing_certificates(listing_id,certificate_id,position) values ('${id}','${certificates[0]}',1)`,
      ),
    ).rejects.toMatchObject({ code: "23505" });
    expect(
      await state.sql`select certificate_id from public.listing_certificates where listing_id=${id}`,
    ).toHaveLength(3);
  });

  it("keeps listing fields and all previous associations atomic when a submitted credential is invalid", async () => {
    const valid = await approvedCertificate();
    const foreign = await approvedCertificate(uid(2));
    const input = await serviceInput(valid);
    const id = await saveListingData(uid(1), input);
    await changeListingStatus(uid(1), id, "active");
    const before =
      await state.sql`select title,description,price,category_id,condition from public.listings where id=${id}`;
    await expect(
      saveListingData(
        uid(1),
        {
          ...input,
          title: "Título que não deve persistir",
          certificate_ids: [valid, foreign],
        },
        id,
      ),
    ).rejects.toThrow();
    expect(
      await state.sql`select title,description,price,category_id,condition from public.listings where id=${id}`,
    ).toEqual(before);
    expect(
      await state.sql`select certificate_id,position from public.listing_certificates where listing_id=${id}`,
    ).toEqual([{ certificate_id: valid, position: 0 }]);
    // Neither the service nor the Data API caller can modify a peer's listing.
    await expect(
      saveListingData(
        uid(2),
        { ...input, title: "Título forjado", certificate_ids: [foreign] },
        id,
      ),
    ).rejects.toThrow("permissão");
    await expect(
      asUser(
        uid(2),
        `insert into public.listing_certificates(listing_id,certificate_id,position) values ('${id}','${foreign}',1)`,
      ),
    ).rejects.toMatchObject({ code: "42501" });
    expect(
      await asUser(
        uid(2),
        `delete from public.listing_certificates where listing_id='${id}' returning certificate_id`,
      ),
    ).toHaveLength(0);
    expect(
      await asUser(
        uid(2),
        `update public.listing_certificates set position=1 where listing_id='${id}' returning certificate_id`,
      ),
    ).toHaveLength(0);
  });

  it("rejects future dates and lost file evidence for every selected credential", async () => {
    // Legacy/imported administrative data can contain future metadata even
    // though the current certificate form rejects it before reaching SQL.
    const future = randomUUID();
    await state.sql`insert into public.profile_certificates(id,user_id,title,issuer,issue_date,verification_url,status) values (${future},${uid(1)},'Documento futuro','Instituição de teste','2099-01-01','https://example.test/future','verified')`;
    const withoutEvidence = randomUUID(),
      file = `${uid(1)}/${withoutEvidence}/${randomUUID()}.pdf`;
    await saveCertificate(
      uid(1),
      withoutEvidence,
      { ...cert, verification_url: "" },
      file,
    );
    await state.sql`insert into storage.objects(bucket_id,name) values ('certificates',${file})`;
    await reviewCertificate(uid(4), withoutEvidence, "verified", "");
    await state.sql`delete from storage.objects where name=${file}`;
    const id = await saveListingData(uid(1), await serviceInput());
    for (const certificate of [future, withoutEvidence]) {
      await expect(
        saveListingData(uid(1), await serviceInput(certificate), id),
      ).rejects.toThrow("Credencial indisponível");
      await expect(
        asUser(
          uid(1),
          `insert into public.listing_certificates(listing_id,certificate_id,position) values ('${id}','${certificate}',0)`,
        ),
      ).rejects.toMatchObject({ code: "23514" });
    }
    expect(
      await state.sql`select * from public.listing_certificates where listing_id=${id}`,
    ).toHaveLength(0);
  });

  it("accepts a certificate through its inclusive expiration day", async () => {
    const [clock] =
      await state.sql`select (now() at time zone 'America/Sao_Paulo')::date::text as today`;
    const certificate = await approvedCertificate(uid(1), {
      ...cert,
      expiration_date: clock.today,
    });
    const id = await saveListingData(uid(1), await serviceInput(certificate));
    await changeListingStatus(uid(1), id, "active");
    expect((await visibleCredentials(id)).map((c) => c.id)).toEqual([
      certificate,
    ]);
  });

  it("removes associations on service-to-product changes and can select again after switching back", async () => {
    const certificates = [
      await approvedCertificate(),
      await approvedCertificate(),
    ];
    const service = await serviceInput(certificates);
    const id = await saveListingData(uid(1), service);
    await changeListingStatus(uid(1), id, "active");
    await saveListingData(
      uid(1),
      {
        ...service,
        category_id: category,
        condition: "used",
        certificate_ids: [],
      },
      id,
    );
    expect(
      await state.sql`select * from public.listing_certificates where listing_id=${id}`,
    ).toHaveLength(0);
    expect(await visibleCredentials(id)).toEqual([]);
    await expect(
      asUser(
        uid(1),
        `insert into public.listing_certificates(listing_id,certificate_id,position) values ('${id}','${certificates[0]}',0)`,
      ),
    ).rejects.toThrow("Only services");
    await saveListingData(uid(1), service, id);
    await asUser(
      uid(1),
      `update public.listings set category_id='${category}',condition='used' where id='${id}'`,
    );
    expect(
      await state.sql`select * from public.listing_certificates where listing_id=${id}`,
    ).toHaveLength(0);
    await saveListingData(uid(1), service, id);
    expect((await visibleCredentials(id)).map((c) => c.id)).toEqual(
      certificates,
    );
  });

  it("filters one invalidated or expired credential without changing the other two or deleting history", async () => {
    const certificates = [];
    for (const title of ["Linux", "Redes", "Docker"])
      certificates.push(await approvedCertificate(uid(1), { ...cert, title }));
    const id = await saveListingData(uid(1), await serviceInput(certificates));
    await changeListingStatus(uid(1), id, "active");
    const [a, b, c] = certificates;
    await saveCertificate(
      uid(1),
      b,
      { ...cert, title: "Redes revisado" },
      undefined,
    );
    expect((await visibleCredentials(id)).map((v) => v.id)).toEqual([a, c]);
    expect(
      await state.sql`select * from public.listing_certificates where listing_id=${id}`,
    ).toHaveLength(3);
    await reviewCertificate(uid(4), b, "verified", "");
    expect((await visibleCredentials(id)).map((v) => v.id)).toEqual(
      certificates,
    );
    await saveCertificate(
      uid(1),
      b,
      { ...cert, title: "Redes", expiration_date: "2026-01-02" },
      undefined,
    );
    await reviewCertificate(uid(4), b, "verified", "");
    expect((await visibleCredentials(id)).map((v) => v.id)).toEqual([a, c]);
    expect(
      await state.sql`select * from public.listing_certificates where listing_id=${id}`,
    ).toHaveLength(3);
    for (const value of await visibleCredentials(id))
      expect(Object.keys(value).sort()).toEqual(
        ["id", "title", "issuer", "issue_date", "expiration_date"].sort(),
      );
    expect(await visibleCredential(id)).toMatchObject({ id: a });
    expect(
      (await searchListings(uid(2), {})).listings[0].credentials.map(
        (v) => v.id,
      ),
    ).toEqual([a, c]);
  });

  it("applies listing privacy and ownership to the ordered RPC and direct relation reads", async () => {
    const certificates = [
      await approvedCertificate(),
      await approvedCertificate(),
    ];
    const id = await saveListingData(uid(1), await serviceInput(certificates));
    expect(await visibleCredentials(id)).toEqual([]);
    expect(
      await asUser(
        uid(2),
        `select * from public.listing_certificates where listing_id='${id}'`,
      ),
    ).toHaveLength(0);
    await changeListingStatus(uid(1), id, "active");
    expect(await visibleCredentials(id)).toHaveLength(2);
    expect(
      await asUser(
        uid(2),
        `select * from public.listing_certificates where listing_id='${id}'`,
      ),
    ).toHaveLength(2);
    expect(await visibleCredentials(id, uid(4))).toEqual([]);
    await savePrivacy(
      uid(1),
      Object.fromEntries(privacyKeys.map((k) => [k, k !== "show_listings"])),
    );
    expect(await visibleCredentials(id)).toEqual([]);
    expect(
      await asUser(
        uid(2),
        `select * from public.listing_certificates where listing_id='${id}'`,
      ),
    ).toHaveLength(0);
    await savePrivacy(
      uid(1),
      Object.fromEntries(privacyKeys.map((k) => [k, true])),
    );
    await blockProfile(uid(2), pid(1), true);
    expect(await visibleCredentials(id)).toEqual([]);
    expect(
      await asUser(
        uid(2),
        `select * from public.listing_certificates where listing_id='${id}'`,
      ),
    ).toHaveLength(0);
    await expect(
      asUser(
        uid(1),
        `update public.listings set certificate_id='${certificates[0]}' where id='${id}'`,
      ),
    ).rejects.toThrow("Multiple credentials require the current application");
  });
});

describe("controlled academic updates", () => {
  it("updates course and semester through the existing sync without changing identity, social data or content", async () => {
    await state.sql`insert into public.courses(institution_id,name,status) values ('fatece','Curso para atualização acadêmica','active') on conflict do nothing`;
    const [student] =
      await state.sql`select id,ra,email,cpf_fingerprint,phone,birth_date::text,status,auth_user_id from private.institution_students where auth_user_id=${uid(1)}`;
    const [course] =
      await state.sql`select id from public.courses where institution_id='fatece' and status='active' limit 1`;
    const [auth] = await state.sql`select * from auth.users where id=${uid(1)}`;
    const certificate = await approvedCertificate();
    const listing = await saveListingData(
      uid(1),
      await serviceInput(certificate),
    );
    await updateStudentAcademics(uid(4), {
      id: student.id,
      course_id: course.id,
      semester: "9",
      name: "Forged",
      status: "blocked",
      email: "forged@example.test",
    });
    expect(
      (
        await state.sql`select course_id,semester from private.institution_students where id=${student.id}`
      )[0],
    ).toEqual({ course_id: course.id, semester: 9 });
    expect(
      (
        await state.sql`select course_id,semester,bio,username from public.profiles where id=${pid(1)}`
      )[0],
    ).toEqual({
      course_id: course.id,
      semester: 9,
      bio: "Bio reservada",
      username: "mvp_1",
    });
    expect(
      (
        await state.sql`select id,ra,email,cpf_fingerprint,phone,birth_date::text,status,auth_user_id from private.institution_students where id=${student.id}`
      )[0],
    ).toEqual(student);
    expect(
      (await state.sql`select * from auth.users where id=${uid(1)}`)[0],
    ).toEqual(auth);
    expect(
      (
        await state.sql`select status from public.profile_certificates where id=${certificate}`
      )[0].status,
    ).toBe("verified");
    expect(
      (
        await state.sql`select certificate_id from public.listing_certificates where listing_id=${listing}`
      )[0].certificate_id,
    ).toBe(certificate);
    await state.sql`update private.institution_students set course='Curso legado preservado' where id=${student.id}`;
    await state.sql`update public.profiles set course='Curso legado preservado' where id=${pid(1)}`;
    await expect(
      updateStudentAcademics(uid(4), {
        id: student.id,
        course_id: "",
        semester: "",
      }),
    ).rejects.toThrow("manter o vínculo");
    await updateStudentAcademics(uid(4), {
      id: student.id,
      course_id: course.id,
      semester: "",
    });
    expect(
      (
        await state.sql`select course_id,semester from public.profiles where id=${pid(1)}`
      )[0],
    ).toEqual({ course_id: course.id, semester: null });
    expect(
      (
        await state.sql`select course from private.institution_students where id=${student.id}`
      )[0].course,
    ).toBe("Curso legado preservado");
    expect(
      (
        await state.sql`select course from public.profiles where id=${pid(1)}`
      )[0].course,
    ).toBe("Curso legado preservado");
  });
  it("rejects students, missing targets, invalid semester and inactive courses", async () => {
    const [student] =
      await state.sql`select id from private.institution_students where auth_user_id=${uid(1)}`;
    const id = randomUUID();
    await state.sql`insert into public.courses(id,institution_id,name,status) values (${id},'fatece','Curso inativo de teste','inactive')`;
    try {
      await expect(
        updateStudentAcademics(uid(1), {
          id: student.id,
          course_id: null,
          semester: 8,
        }),
      ).rejects.toThrow("revogado");
      await expect(
        updateStudentAcademics(uid(4), {
          id: randomUUID(),
          course_id: null,
          semester: 8,
        }),
      ).rejects.toThrow("indisponível");
      await expect(
        updateStudentAcademics(uid(4), {
          id: student.id,
          course_id: id,
          semester: 8,
        }),
      ).rejects.toThrow("indisponível");
      for (const semester of [0, 31, "forged", 1.5])
        await expect(
          updateStudentAcademics(uid(4), {
            id: student.id,
            course_id: null,
            semester,
          }),
        ).rejects.toThrow();
    } finally {
      await state.sql`delete from public.courses where id=${id}`;
    }
  });
});
