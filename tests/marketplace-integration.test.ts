import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import postgres from "postgres";
import { readFileSync, readdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { beforeAll, beforeEach, afterAll, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
const state = vi.hoisted(() => ({
  sql: null as unknown as ReturnType<typeof postgres>,
}));
vi.mock("@/lib/institution/database", () => ({ database: () => state.sql }));
import {
  saveListingData,
  changeListingStatus,
  searchListings,
  addListingImage,
  removeListingImage,
  deleteListingData,
} from "@/services/marketplace";
const uid = (n: number) =>
  `60000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
let db: PGlite, server: PGLiteSocketServer, product: string, service: string;
const input = (price = "45,00") => ({
  title: "Livro de cálculo",
  description: "Aprenda matemática e programação.",
  price,
  category_id: product,
  condition: "used",
});
const path = (id: string, user = uid(1)) => `${user}/${id}/${randomUUID()}.png`;
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
    await db.exec(readFileSync("supabase/migrations/" + file, "utf8"));
  for (let n = 1; n <= 3; n++) {
    await db.query(
      "insert into auth.users(id,email,email_confirmed_at) values ($1,$2,now())",
      [uid(n), `market${n}@example.test`],
    );
    await db.query(
      `insert into private.institution_students(institution_id,auth_user_id,ra,name,email,phone,birth_date,cpf_fingerprint,status,activated_at) values ('fatece',$1,$2,$3,$4,'5511999999999','2000-01-01',$5,$6,now())`,
      [
        uid(n),
        `market${n}`,
        `Aluno Mercado ${n}`,
        `market${n}@example.test`,
        String(n).repeat(64),
        n === 3 ? "blocked" : "active",
      ],
    );
    await db.query(
      `insert into public.profiles(id,user_id,name,username,institution_id) values ($1,$1,$2,$3,'fatece')`,
      [uid(n), `Aluno Mercado ${n}`, `mercado_${n}`],
    );
  }
  product = (
    await db.query<{ id: string }>(
      "select id from public.categories where name='Livros'",
    )
  ).rows[0].id;
  service = (
    await db.query<{ id: string }>(
      "select id from public.categories where name='Serviços'",
    )
  ).rows[0].id;
  server = new PGLiteSocketServer({ db, port: 0, host: "127.0.0.1" });
  await server.start();
  const connection = server.getServerConn();
  state.sql = postgres(
    connection.startsWith("postgres")
      ? connection
      : "postgres://postgres@" + connection + "/postgres",
    { max: 3, prepare: false, onnotice: () => {} },
  );
});
beforeEach(async () => {
  await state.sql`delete from public.listings`;
  await state.sql`delete from storage.objects`;
});
afterAll(async () => {
  await state.sql?.end({ timeout: 1 });
  await server?.stop();
  await db?.close();
});
it("creates private draft, publishes, edits and preserves exact numeric price", async () => {
  const id = await saveListingData(uid(1), input());
  expect((await searchListings(uid(2), {})).total).toBe(0);
  expect((await searchListings(uid(1), {}, true)).listings[0].status).toBe(
    "inactive",
  );
  await changeListingStatus(uid(1), id, "active");
  expect(
    (await searchListings(uid(2), { q: "programação" })).listings[0].price,
  ).toBe("45.00");
  await saveListingData(
    uid(1),
    { ...input("1.234,56"), title: "Livro atualizado" },
    id,
  );
  expect(
    (
      await searchListings(uid(2), {
        q: "atualizado",
        min: "1000",
        max: "1300",
        category: product,
        condition: "used",
      })
    ).listings[0].price,
  ).toBe("1234.56");
  await expect(
    saveListingData(uid(1), { ...input(), category_id: randomUUID() }),
  ).rejects.toThrow("categoria");
});
it("enforces owner identity in services, RLS and immutable seller grants", async () => {
  const id = await saveListingData(uid(1), input());
  await changeListingStatus(uid(1), id, "active");
  await expect(saveListingData(uid(2), input(), id)).rejects.toThrow(
    "permissão",
  );
  await expect(changeListingStatus(uid(2), id, "sold")).rejects.toThrow(
    "permissão",
  );
  const remove = vi.fn();
  await expect(deleteListingData(uid(2), id, remove)).rejects.toThrow(
    "permissão",
  );
  expect(remove).not.toHaveBeenCalled();
  expect(
    await asUser(
      uid(2),
      `update public.listings set title='Ataque' where id='${id}' returning id`,
    ),
  ).toHaveLength(0);
  expect(
    await asUser(
      uid(2),
      `delete from public.listings where id='${id}' returning id`,
    ),
  ).toHaveLength(0);
  await expect(
    asUser(
      uid(1),
      `update public.listings set seller_id='${uid(2)}' where id='${id}'`,
    ),
  ).rejects.toMatchObject({ code: "42501" });
});
it("normalizes services and enforces product/service consistency through direct SQL", async () => {
  const id = await saveListingData(uid(1), {
    ...input(),
    category_id: service,
  });
  await changeListingStatus(uid(1), id, "active");
  expect(
    (await searchListings(uid(2), { category: service, condition: "used" }))
      .listings[0].condition,
  ).toBe("not_applicable");
  await expect(
    asUser(
      uid(1),
      `update public.listings set condition='used' where id='${id}'`,
    ),
  ).rejects.toMatchObject({ code: "23514" });
  await expect(
    saveListingData(uid(1), { ...input(), condition: "not_applicable" }),
  ).rejects.toThrow("condição");
});
it("sorts prices numerically, paginates and treats LIKE wildcards literally", async () => {
  for (let i = 0; i < 14; i++) {
    const id = await saveListingData(uid(1), {
      ...input(String(i + 10)),
      title: i === 0 ? "Livro 100% seguro" : `Livro página ${i}`,
    });
    await changeListingStatus(uid(1), id, "active");
  }
  const first = await searchListings(uid(2), { sort: "price_asc" });
  expect(first.total).toBe(14);
  expect(first.listings).toHaveLength(12);
  expect(first.listings[0].price).toBe("10.00");
  expect(
    (await searchListings(uid(2), { page: "2", sort: "price_asc" })).listings,
  ).toHaveLength(2);
  expect(
    (await searchListings(uid(2), { sort: "price_desc" })).listings[0].price,
  ).toBe("23.00");
  expect((await searchListings(uid(2), { q: "%" })).total).toBe(1);
  expect(
    (await searchListings(uid(2), { min: "30", max: "20" })).error,
  ).toContain("Filtros");
});
it("hides sold/inactive ads from peers and exposes all owner statuses", async () => {
  const id = await saveListingData(uid(1), input());
  await changeListingStatus(uid(1), id, "sold");
  expect((await searchListings(uid(2), {})).total).toBe(0);
  expect((await searchListings(uid(1), { status: "sold" }, true)).total).toBe(
    1,
  );
  await changeListingStatus(uid(1), id, "active");
  expect((await searchListings(uid(2), {})).total).toBe(1);
});
it("enforces five images, canonical paths, storage ownership and image positions", async () => {
  const id = await saveListingData(uid(1), input());
  const upload = vi.fn(async () => {});
  await expect(
    addListingImage(uid(2), id, path(id, uid(2)), upload),
  ).rejects.toThrow("permissão");
  expect(upload).not.toHaveBeenCalled();
  await expect(
    addListingImage(uid(1), id, path(id, uid(2)), upload),
  ).rejects.toMatchObject({ code: "23514" });
  await expect(
    asUser(
      uid(2),
      `insert into storage.objects(bucket_id,name) values ('listing-images','${path(id, uid(2))}')`,
    ),
  ).rejects.toMatchObject({ code: "42501" });
  for (let i = 0; i < 5; i++)
    await addListingImage(uid(1), id, path(id), upload);
  await expect(addListingImage(uid(1), id, path(id), upload)).rejects.toThrow(
    "5 imagens",
  );
  const images =
    await state.sql`select id from public.listing_images where listing_id=${id} order by position`;
  const remove = vi.fn(async () => {});
  await removeListingImage(uid(1), id, images[1].id as string, remove);
  expect(
    (
      await state.sql`select position from public.listing_images where listing_id=${id} order by position`
    ).map((i) => i.position),
  ).toEqual([0, 1, 2, 3]);
});
it("rolls back failed uploads and keeps records when Storage deletion fails", async () => {
  const id = await saveListingData(uid(1), input());
  await expect(
    addListingImage(uid(1), id, path(id), async () => {
      throw new Error("Storage unavailable");
    }),
  ).rejects.toThrow();
  expect(
    await state.sql`select id from public.listing_images where listing_id=${id}`,
  ).toHaveLength(0);
  await addListingImage(uid(1), id, path(id), async () => {});
  await expect(
    deleteListingData(uid(1), id, async () => {
      throw new Error("Storage unavailable");
    }),
  ).rejects.toThrow();
  expect(
    await state.sql`select id from public.listings where id=${id}`,
  ).toHaveLength(1);
  await deleteListingData(uid(1), id, async () => {});
  expect(
    await state.sql`select id from public.listing_images where listing_id=${id}`,
  ).toHaveLength(0);
});
it("denies blocked and anonymous access", async () => {
  await expect(searchListings(uid(3), {})).rejects.toThrow("indisponível");
  await expect(
    state.sql.begin(async (sql) => {
      await sql`set local role anon`;
      return sql`select * from public.listings`;
    }),
  ).rejects.toMatchObject({ code: "42501" });
});
