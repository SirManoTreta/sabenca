import { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const user = (n: number) =>
  `81000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const profile = (n: number) =>
  `91000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
let db: PGlite, service: string, product: string;

async function authenticated<T>(action: () => Promise<T>, actor = user(1)) {
  await db.exec("begin");
  try {
    await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
      actor,
    ]);
    await db.exec("set local role authenticated");
    const result = await action();
    await db.exec("commit");
    return result;
  } catch (error) {
    await db.exec("rollback");
    throw error;
  }
}

async function legacySave(id: string, certificate: string | null) {
  // The previous application's full save always includes the legacy column,
  // even if the owner changed only an unrelated field in the browser.
  return authenticated(() =>
    db.query(
      `update public.listings set title=title,description=description,price=price,
       category_id=category_id,condition=condition,certificate_id=$2
       where id=$1 and seller_id=$3 returning id`,
      [id, certificate, profile(1)],
    ),
  );
}

async function certificate(
  owner = user(1),
  status = "verified",
  kind = "eligible",
) {
  const id = randomUUID();
  const file =
    kind === "missing evidence" ? `${owner}/${id}/${randomUUID()}.pdf` : null;
  if (file)
    await db.query(
      "insert into storage.objects(bucket_id,name) values ('certificates',$1)",
      [file],
    );
  await db.query(
    `insert into public.profile_certificates
     (id,user_id,title,issuer,issue_date,expiration_date,verification_url,file_path,status)
     values ($1,$2,$3,'Instituição fictícia',case when $5='future' then current_date+2 else current_date-10 end,
       case when $5='expired' then current_date-2 else null end,
       case when $5='missing evidence' then null else 'https://example.test/evidence' end,$6,$4)`,
    [id, owner, `Credencial ${id}`, status, kind, file],
  );
  // Losing the physical evidence must not leave a verified document selectable.
  if (file)
    await db.query(
      "delete from storage.objects where bucket_id='certificates' and name=$1",
      [file],
    );
  return id;
}

async function listing(legacy: string | null = null) {
  const id = randomUUID();
  await authenticated(() =>
    db.query(
      `insert into public.listings(id,seller_id,title,description,price,category_id,condition,certificate_id,status)
       values ($1,$2,'Serviço fictício','Descrição original',10,$3,'not_applicable',$4,'active')`,
      [id, profile(1), service, legacy],
    ),
  );
  return id;
}

async function selection(id: string, certificates: string[]) {
  await authenticated(async () => {
    // Same transaction and parent lock as the new application's service.
    await db.query("select id from public.listings where id=$1 for update", [
      id,
    ]);
    await db.query(
      "delete from public.listing_certificates where listing_id=$1",
      [id],
    );
    for (const [position, certificateId] of certificates.entries())
      await db.query(
        "insert into public.listing_certificates(listing_id,certificate_id,position) values ($1,$2,$3)",
        [id, certificateId, position],
      );
  });
}

async function snapshot(id: string) {
  const parent = (
    await db.query("select * from public.listings where id=$1", [id])
  ).rows;
  const links = (
    await db.query(
      "select * from public.listing_certificates where listing_id=$1 order by position",
      [id],
    )
  ).rows;
  return { parent, links };
}

async function presented(id: string, actor = user(1)) {
  return authenticated(
    async () =>
      (
        await db.query<{
          credentials: { id: string; [key: string]: unknown }[];
          credential: { id: string; [key: string]: unknown } | null;
        }>(
          "select public.listing_credentials($1) as credentials,public.listing_credential($1) as credential",
          [id],
        )
      ).rows[0],
    actor,
  );
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
  for (let n = 1; n <= 3; n++) {
    await db.query(
      "insert into auth.users(id,email,email_confirmed_at) values ($1,$2,now())",
      [user(n), `compatibility${n}@example.test`],
    );
    if (n === 3) continue;
    await db.query(
      `insert into private.institution_students(institution_id,auth_user_id,ra,name,email,phone,birth_date,cpf_fingerprint,status,activated_at)
       values ('fatece',$1,$2,$3,$4,'5511999999999','2000-01-01',$5,'active',now())`,
      [
        user(n),
        `COMPAT${n}`,
        `Estudante fictício ${n}`,
        `compatibility${n}@example.test`,
        String(n).repeat(64),
      ],
    );
    await db.query(
      "insert into public.profiles(id,user_id,username,name,institution,institution_id) values ($1,$2,$3,$4,'FATECE','fatece')",
      [profile(n), user(n), `compatibility_${n}`, `Estudante fictício ${n}`],
    );
  }
  await db.query(
    "insert into private.admin_users(user_id,institution_id) values ($1,'fatece')",
    [user(3)],
  );
  service = (
    await db.query<{ id: string }>(
      "select id from public.categories where is_service limit 1",
    )
  ).rows[0].id;
  product = (
    await db.query<{ id: string }>(
      "select id from public.categories where not is_service limit 1",
    )
  ).rows[0].id;
}, 30000);

beforeEach(async () => {
  await db.exec(
    "truncate public.profile_certificates,public.listings cascade;update private.institution_students set status='active'",
  );
});

afterAll(async () => {
  await db?.close();
});

describe("previous application over the corrected credential schema", () => {
  it("creates legacy services with zero or one credential and projects the authoritative association", async () => {
    const document = await certificate();
    const empty = await listing();
    const single = await listing(document);
    expect((await presented(empty)).credentials).toEqual([]);
    expect((await presented(single)).credentials.map((c) => c.id)).toEqual([
      document,
    ]);
    expect((await snapshot(single)).parent[0]).toMatchObject({
      certificate_id: document,
    });
    expect((await snapshot(single)).links).toHaveLength(1);
  });

  it("adds, replaces and actually removes a single credential through the old full save", async () => {
    const first = await certificate(),
      second = await certificate();
    const id = await listing();
    await legacySave(id, first);
    expect((await presented(id)).credential?.id).toBe(first);
    await legacySave(id, second);
    expect((await presented(id)).credentials.map((c) => c.id)).toEqual([
      second,
    ]);
    await legacySave(id, null);
    expect((await snapshot(id)).links).toEqual([]);
    expect((await snapshot(id)).parent[0]).toMatchObject({
      certificate_id: null,
    });
    expect(await presented(id)).toEqual({ credential: null, credentials: [] });
  });

  it("keeps credential selection unchanged when an old save repeats its current value", async () => {
    const document = await certificate(),
      id = await listing(document);
    const before = await snapshot(id);
    await authenticated(() =>
      db.query(
        "update public.listings set title='Título revisado',certificate_id=$2 where id=$1",
        [id, document],
      ),
    );
    expect((await snapshot(id)).links).toEqual(before.links);
    expect((await snapshot(id)).parent[0]).toMatchObject({
      title: "Título revisado",
      certificate_id: document,
    });
  });

  it("rejects a stale old form changing common fields instead of reverting a newer selection as a side effect", async () => {
    const original = await certificate(),
      replacement = await certificate(),
      id = await listing(original);
    await selection(id, [replacement]);
    const before = await snapshot(id);
    await expect(
      authenticated(() =>
        db.query(
          "update public.listings set title='Stale common edit',certificate_id=$2 where id=$1",
          [id, original],
        ),
      ),
    ).rejects.toMatchObject({ code: "23514" });
    expect(await snapshot(id)).toEqual(before);
  });

  for (const count of [2, 3]) {
    it.each(["clear", "repeat", "replace"])(
      `rejects ambiguous legacy %s of ${count} credentials without changing any field or relation`,
      async (operation) => {
        const documents = await Promise.all(
          Array.from({ length: count }, () => certificate()),
        );
        const extra = await certificate(),
          id = await listing();
        await selection(id, documents);
        const before = await snapshot(id);
        const target =
          operation === "clear"
            ? null
            : operation === "repeat"
              ? documents[0]
              : extra;
        await expect(
          authenticated(() =>
            db.query(
              "update public.listings set title='Must roll back',certificate_id=$2 where id=$1",
              [id, target],
            ),
          ),
        ).rejects.toMatchObject({ code: "23514" });
        expect(await snapshot(id)).toEqual(before);
        expect((await presented(id)).credentials.map((c) => c.id)).toEqual(
          documents,
        );
      },
    );
  }

  it("does not silently remove a historical invalid credential when the old form submits its empty option", async () => {
    const document = await certificate(),
      id = await listing(document);
    await authenticated(
      () =>
        db.query(
          "update public.profile_certificates set status='rejected',rejection_reason='Revisão fictícia' where id=$1",
          [document],
        ),
      user(3),
    );
    const before = await snapshot(id);
    expect((await presented(id)).credentials).toEqual([]);
    await expect(
      authenticated(() =>
        db.query(
          "update public.listings set title='Must roll back',certificate_id=null where id=$1",
          [id],
        ),
      ),
    ).rejects.toMatchObject({ code: "23514" });
    expect(await snapshot(id)).toEqual(before);
    await authenticated(() =>
      db.query("update public.listings set title='Common update' where id=$1", [
        id,
      ]),
    );
    expect((await snapshot(id)).links).toEqual(before.links);
  });

  it("supports rollback reads and single-credential edits while explicitly refusing edits of a larger collection", async () => {
    const documents = await Promise.all([
      certificate(),
      certificate(),
      certificate(),
    ]);
    const id = await listing();
    await selection(id, documents);
    const shown = await presented(id);
    expect(shown.credential?.id).toBe(documents[0]);
    expect(shown.credentials.map((c) => c.id)).toEqual(documents);
    await expect(legacySave(id, null)).rejects.toMatchObject({ code: "23514" });
    expect((await presented(id)).credentials.map((c) => c.id)).toEqual(
      documents,
    );
    await selection(id, [documents[2]]);
    expect((await presented(id)).credential?.id).toBe(documents[2]);
    await legacySave(id, null);
    expect((await presented(id)).credentials).toEqual([]);
  });
});

describe("new application and database protections", () => {
  it("updates common fields independently and keeps the projection in selection order", async () => {
    const documents = await Promise.all([
      certificate(),
      certificate(),
      certificate(),
    ]);
    const id = await listing();
    await selection(id, documents);
    const before = await snapshot(id);
    await authenticated(() =>
      db.query(
        "update public.listings set title='Only title',price=12 where id=$1",
        [id],
      ),
    );
    expect((await snapshot(id)).links).toEqual(before.links);
    await selection(id, [documents[2], documents[0]]);
    expect((await presented(id)).credentials.map((c) => c.id)).toEqual([
      documents[2],
      documents[0],
    ]);
    expect((await snapshot(id)).parent[0]).toMatchObject({
      certificate_id: documents[2],
    });
    await selection(id, []);
    expect((await snapshot(id)).parent[0]).toMatchObject({
      certificate_id: null,
    });
  });

  it("converts a service into a product atomically and leaves neither projection nor associations", async () => {
    const documents = await Promise.all([
      certificate(),
      certificate(),
      certificate(),
    ]);
    const id = await listing();
    await selection(id, documents);
    await authenticated(() =>
      db.query(
        "update public.listings set category_id=$2,condition='used' where id=$1",
        [id, product],
      ),
    );
    expect((await snapshot(id)).links).toEqual([]);
    expect((await snapshot(id)).parent[0]).toMatchObject({
      category_id: product,
      certificate_id: null,
    });
    await expect(
      authenticated(() =>
        db.query(
          "insert into public.listing_certificates(listing_id,certificate_id,position) values ($1,$2,0)",
          [id, documents[0]],
        ),
      ),
    ).rejects.toMatchObject({ code: "23514" });
  });

  it("preserves a new selection and the parent when a subsequent replacement contains an invalid document", async () => {
    const good = await certificate(),
      pending = await certificate(user(1), "pending"),
      id = await listing(good);
    const before = await snapshot(id);
    await expect(
      authenticated(async () => {
        await db.query(
          "select id from public.listings where id=$1 for update",
          [id],
        );
        await db.query(
          "update public.listings set title='Must roll back' where id=$1",
          [id],
        );
        await db.query(
          "delete from public.listing_certificates where listing_id=$1",
          [id],
        );
        await db.query(
          "insert into public.listing_certificates(listing_id,certificate_id,position) values ($1,$2,0)",
          [id, pending],
        );
      }),
    ).rejects.toMatchObject({ code: "23514" });
    expect(await snapshot(id)).toEqual(before);
  });

  it("rejects fourth positions and duplicate credentials without desynchronizing the projection", async () => {
    const documents = await Promise.all([
      certificate(),
      certificate(),
      certificate(),
      certificate(),
    ]);
    const id = await listing();
    await selection(id, documents.slice(0, 3));
    const before = await snapshot(id);
    await expect(
      authenticated(() =>
        db.query(
          "insert into public.listing_certificates(listing_id,certificate_id,position) values ($1,$2,3)",
          [id, documents[3]],
        ),
      ),
    ).rejects.toMatchObject({ code: "23514" });
    await expect(
      authenticated(() =>
        db.query(
          "insert into public.listing_certificates(listing_id,certificate_id,position) values ($1,$2,2)",
          [id, documents[0]],
        ),
      ),
    ).rejects.toMatchObject({ code: "23505" });
    expect(await snapshot(id)).toEqual(before);
  });

  it.each(["other owner", "pending", "future", "expired", "missing evidence"])(
    "rejects an old writer selecting %s without changing the original association",
    async (kind) => {
      const good = await certificate(),
        id = await listing(good);
      const invalid = await certificate(
        kind === "other owner" ? user(2) : user(1),
        kind === "pending" ? "pending" : "verified",
        kind,
      );
      const before = await snapshot(id);
      await expect(legacySave(id, invalid)).rejects.toMatchObject({
        code: "23514",
      });
      expect(await snapshot(id)).toEqual(before);
    },
  );

  it("enforces ownership and active institutional membership for old and new writes", async () => {
    const document = await certificate(),
      id = await listing(document);
    const before = await snapshot(id);
    expect(
      (
        await authenticated(
          () =>
            db.query(
              "update public.listings set certificate_id=null where id=$1 returning id",
              [id],
            ),
          user(2),
        )
      ).rows,
    ).toEqual([]);
    await db.query(
      "update private.institution_students set status='inactive' where auth_user_id=$1",
      [user(1)],
    );
    expect(
      (
        await authenticated(() =>
          db.query(
            "update public.listings set certificate_id=null where id=$1 returning id",
            [id],
          ),
        )
      ).rows,
    ).toEqual([]);
    await expect(
      authenticated(() =>
        db.query(
          "insert into public.listing_certificates(listing_id,certificate_id,position) values ($1,$2,1)",
          [id, document],
        ),
      ),
    ).rejects.toMatchObject({ code: "42501" });
    expect(await snapshot(id)).toEqual(before);
  });

  it("hides one invalidated document from peers, preserves other credentials and exposes only safe metadata", async () => {
    const documents = await Promise.all([
      certificate(),
      certificate(),
      certificate(),
    ]);
    const id = await listing();
    await selection(id, documents);
    await authenticated(
      () =>
        db.query(
          "update public.profile_certificates set status='rejected',rejection_reason='Revisão fictícia' where id=$1",
          [documents[0]],
        ),
      user(3),
    );
    const shown = await presented(id, user(2));
    expect(shown.credentials.map((c) => c.id)).toEqual(documents.slice(1));
    expect(shown.credential?.id).toBe(documents[1]);
    for (const credential of shown.credentials)
      expect(Object.keys(credential).sort()).toEqual([
        "expiration_date",
        "id",
        "issue_date",
        "issuer",
        "title",
      ]);
    expect((await snapshot(id)).links).toHaveLength(3);
    await expect(legacySave(id, documents[1])).rejects.toMatchObject({
      code: "23514",
    });
  });

  it("handles certificate deletion by preserving all remaining associations and a consistent projection", async () => {
    const documents = await Promise.all([
      certificate(),
      certificate(),
      certificate(),
    ]);
    const id = await listing();
    await selection(id, documents);
    await db.query("delete from public.profile_certificates where id=$1", [
      documents[0],
    ]);
    expect((await presented(id)).credentials.map((c) => c.id)).toEqual(
      documents.slice(1),
    );
    expect((await snapshot(id)).parent[0]).toMatchObject({
      certificate_id: documents[1],
    });
    expect((await snapshot(id)).links).toHaveLength(2);
  });

  it("clears the projection when its only certificate is deleted and permits deleting the parent listing", async () => {
    const document = await certificate(),
      id = await listing(document);
    await db.query("delete from public.profile_certificates where id=$1", [
      document,
    ]);
    expect((await snapshot(id)).parent[0]).toMatchObject({
      certificate_id: null,
    });
    expect((await snapshot(id)).links).toEqual([]);
    const documents = await Promise.all([
      certificate(),
      certificate(),
      certificate(),
    ]);
    await selection(id, documents);
    await authenticated(() =>
      db.query("delete from public.listings where id=$1", [id]),
    );
    expect(await snapshot(id)).toEqual({ parent: [], links: [] });
  });

  it("projects the first ordered document after direct reordering without replacing any association", async () => {
    const documents = await Promise.all([
      certificate(),
      certificate(),
      certificate(),
    ]);
    const id = await listing();
    await selection(id, documents);
    await authenticated(async () => {
      await db.exec(
        "set constraints listing_certificates_listing_id_position_key deferred",
      );
      await db.query(
        "update public.listing_certificates set position=2-position where listing_id=$1",
        [id],
      );
    });
    expect((await presented(id)).credentials.map((c) => c.id)).toEqual(
      [...documents].reverse(),
    );
    expect((await snapshot(id)).parent[0]).toMatchObject({
      certificate_id: documents[2],
    });
    expect((await snapshot(id)).links).toHaveLength(3);
  });
});
