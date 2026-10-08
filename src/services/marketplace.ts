import "server-only";
import type { TransactionSql } from "postgres";
import { database } from "@/lib/institution/database";
import { requireUser } from "@/services/session";
import { idSchema } from "@/lib/validations/project";
import {
  conditionForCategory,
  listingSchema,
  marketplaceFiltersSchema,
  LISTING_PAGE_SIZE,
  MAX_LISTING_IMAGES,
  statusSchema,
} from "@/lib/validations/listing";
import type {
  Category,
  Listing,
  ListingCondition,
  ListingStatus,
  MarketplaceParams,
} from "@/types/marketplace";
type RawListing = Omit<Listing, "images"> & {
  images: { id: string; position: number; image_url: string }[];
};
export class MarketplaceError extends Error {}
const unavailable = "Anúncio não encontrado ou sem permissão.";
async function withMember<T>(
  actor: string,
  task: (sql: TransactionSql, profileId: string) => Promise<T>,
): Promise<T> {
  idSchema.parse(actor);
  return (await database().begin(async (sql) => {
    await sql`select set_config('request.jwt.claim.sub',${actor},true)`;
    await sql`set local role authenticated`;
    const [p] =
      await sql`select id from public.profiles where user_id=(select auth.uid()) and institution_id='fatece' and (select private.is_member())`;
    if (!p)
      throw new MarketplaceError(
        "Seu acesso ao Marketplace está indisponível.",
      );
    return task(sql, p.id as string);
  })) as T;
}
export async function listingCategories(actor: string) {
  return withMember(actor, async (sql) => [
    ...(await sql<
      Category[]
    >`select id,name,is_service from public.categories order by name,id`),
  ]);
}
// Explicit public DTO. One joined query, including the whole image set for each page.
const listingColumns = (
  sql: TransactionSql,
) => sql`l.id,l.title,l.description,l.price::text,l.condition,l.status,l.created_at,
 jsonb_build_object('id',c.id,'name',c.name,'is_service',c.is_service) as category,
 jsonb_build_object('id',p.id,'username',p.username,'name',p.name,'course',course.name,'semester',p.semester,'institution',p.institution,'avatar_url',p.avatar_url) as seller,
 coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'position',i.position,'image_url',i.image_url) order by i.position,i.id) from public.listing_images i where i.listing_id=l.id),'[]'::jsonb) as images`;
export async function searchListings(
  actor: string,
  params: MarketplaceParams,
  mine = false,
) {
  const parsed = marketplaceFiltersSchema.safeParse(params);
  return withMember(actor, async (sql, profileId) => {
    const categories = [
      ...(await sql<
        Category[]
      >`select id,name,is_service from public.categories order by name,id`),
    ];
    const filters = parsed.success
      ? parsed.data
      : { q: "", sort: "recent" as const, page: 1 };
    if (!parsed.success)
      return {
        categories,
        filters,
        total: 0,
        listings: [] as RawListing[],
        error: "Filtros inválidos. Revise pesquisa, preços e página.",
      };
    const f = parsed.data;
    const service = categories.find((c) => c.id === f.category)?.is_service;
    const pattern = `%${f.q.replace(/[\\%_]/g, "\\$&")}%`;
    const order =
      f.sort === "price_asc"
        ? sql`price::numeric asc,created_at desc,id`
        : f.sort === "price_desc"
          ? sql`price::numeric desc,created_at desc,id`
          : sql`created_at desc,id`;
    const [result] = await sql<
      { total: number; listings: RawListing[] }[]
    >`with matches as materialized (
   select ${listingColumns(sql)} from public.listings l join public.profiles p on p.id=l.seller_id
   join public.categories c on c.id=l.category_id left join public.courses course on course.id=p.course_id
   where ${mine ? sql`l.seller_id=${profileId}` : sql`l.status='active'`}
    ${f.seller ? sql`and l.seller_id=${f.seller}` : sql``}
    ${f.category ? sql`and l.category_id=${f.category}` : sql``}
    ${f.condition && !service ? sql`and l.condition=${f.condition}` : sql``}
    ${mine && f.status ? sql`and l.status=${f.status}` : sql``}
    ${f.min ? sql`and l.price>=${f.min}::numeric` : sql``}
    ${f.max ? sql`and l.price<=${f.max}::numeric` : sql``}
    ${f.q ? sql`and (l.title ilike ${pattern} or l.description ilike ${pattern} or p.name ilike ${pattern})` : sql``}
  ), paged as (select * from matches order by ${order} limit ${LISTING_PAGE_SIZE} offset ${(f.page - 1) * LISTING_PAGE_SIZE})
  select (select count(*)::integer from matches) as total,coalesce((select jsonb_agg(to_jsonb(paged) order by ${order}) from paged),'[]'::jsonb) as listings`;
    return {
      categories,
      filters,
      total: result.total,
      listings: result.listings,
    };
  });
}
async function signedListings(rows: RawListing[]) {
  const { client } = await requireUser();
  const imagePaths = [
    ...new Set(rows.flatMap((l) => l.images.map((i) => i.image_url))),
  ];
  const avatarPaths = [
    ...new Set(
      rows.flatMap((l) => (l.seller.avatar_url ? [l.seller.avatar_url] : [])),
    ),
  ];
  async function urls(bucket: string, paths: string[]) {
    const result = new Map<string, string>();
    if (paths.length) {
      const { data, error } = await client.storage
        .from(bucket)
        .createSignedUrls(paths, 300);
      if (!error)
        for (const i of data ?? [])
          if (i.path && i.signedUrl && !i.error)
            result.set(i.path, i.signedUrl);
    }
    return result;
  }
  const [images, avatars] = await Promise.all([
    urls("listing-images", imagePaths),
    urls("avatars", avatarPaths),
  ]);
  return rows.map((l) => ({
    ...l,
    created_at: new Date(l.created_at).toISOString(),
    seller: {
      ...l.seller,
      avatar_url: avatars.get(l.seller.avatar_url ?? "") ?? null,
    },
    images: l.images.map((i) => ({
      id: i.id,
      position: i.position,
      url: images.get(i.image_url) ?? null,
    })),
  })) satisfies Listing[];
}
export async function getMarketplace(params: MarketplaceParams, mine = false) {
  const { user } = await requireUser();
  const r = await searchListings(user.id, params, mine);
  return { ...r, listings: await signedListings(r.listings) };
}
export async function getListing(id: string, own = false) {
  if (!idSchema.safeParse(id).success) return null;
  const { user } = await requireUser();
  const row = await withMember(user.id, async (sql, profileId) => {
    const [r] = await sql<
      RawListing[]
    >`select ${listingColumns(sql)} from public.listings l join public.profiles p on p.id=l.seller_id join public.categories c on c.id=l.category_id left join public.courses course on course.id=p.course_id where l.id=${id} ${own ? sql`and l.seller_id=${profileId}` : sql``}`;
    return r ?? null;
  });
  return row ? (await signedListings([row]))[0] : null;
}
async function ownListing(sql: TransactionSql, id: string, profileId: string) {
  idSchema.parse(id);
  const [row] =
    await sql`select id from public.listings where id=${id} and seller_id=${profileId} for update`;
  if (!row) throw new MarketplaceError(unavailable);
}
export async function saveListingData(
  actor: string,
  input: unknown,
  id?: string,
) {
  const parsed = listingSchema.parse(input);
  return withMember(actor, async (sql, profileId) => {
    if (id) await ownListing(sql, id, profileId);
    const [category] = await sql<
      Category[]
    >`select id,name,is_service from public.categories where id=${parsed.category_id}`;
    if (!category)
      throw new MarketplaceError("Escolha uma categoria disponível.");
    let values;
    try {
      values = conditionForCategory(parsed, category.is_service);
    } catch {
      throw new MarketplaceError("Escolha a condição do produto.");
    }
    const listingId = id ?? crypto.randomUUID();
    if (id)
      await sql`update public.listings set title=${values.title},description=${values.description},price=${values.price}::numeric,category_id=${values.category_id},condition=${values.condition} where id=${id} and seller_id=${profileId}`;
    else
      await sql`insert into public.listings(id,seller_id,title,description,price,category_id,condition,status) values (${listingId},${profileId},${values.title},${values.description},${values.price}::numeric,${values.category_id},${values.condition},'inactive')`;
    return listingId;
  });
}
export async function changeListingStatus(
  actor: string,
  id: string,
  status: unknown,
) {
  const value = statusSchema.parse(status);
  return withMember(actor, async (sql, profileId) => {
    await ownListing(sql, id, profileId);
    await sql`update public.listings set status=${value} where id=${id} and seller_id=${profileId}`;
  });
}
export async function addListingImage(
  actor: string,
  id: string,
  path: string,
  upload: () => Promise<void>,
) {
  return withMember(actor, async (sql, profileId) => {
    await ownListing(sql, id, profileId);
    const rows =
      await sql`select position from public.listing_images where listing_id=${id}`;
    if (rows.length >= MAX_LISTING_IMAGES)
      throw new MarketplaceError("Use até 5 imagens por anúncio.");
    const position = Array.from(
      { length: MAX_LISTING_IMAGES },
      (_, i) => i,
    ).find((i) => !rows.some((r) => r.position === i))!;
    await sql`insert into public.listing_images(listing_id,image_url,position) values (${id},${path},${position})`;
    await upload();
  });
}
export async function removeListingImage(
  actor: string,
  id: string,
  imageId: string,
  remove: (paths: string[]) => Promise<void>,
) {
  idSchema.parse(imageId);
  return withMember(actor, async (sql, profileId) => {
    await ownListing(sql, id, profileId);
    const [image] =
      await sql`select image_url from public.listing_images where id=${imageId} and listing_id=${id}`;
    if (!image)
      throw new MarketplaceError("Imagem não encontrada. Atualize a página.");
    await remove([image.image_url as string]);
    await sql`delete from public.listing_images where id=${imageId} and listing_id=${id}`;
    await sql`set constraints listing_images_listing_id_position_key deferred`;
    await sql`update public.listing_images i set position=r.position from (select id,(row_number() over(order by position,id)-1)::smallint as position from public.listing_images where listing_id=${id}) r where i.id=r.id`;
  });
}
export async function deleteListingData(
  actor: string,
  id: string,
  remove: (paths: string[]) => Promise<void>,
) {
  return withMember(actor, async (sql, profileId) => {
    await ownListing(sql, id, profileId);
    const images =
      await sql`select image_url from public.listing_images where listing_id=${id}`;
    await remove(images.map((i) => i.image_url as string));
    await sql`delete from public.listings where id=${id} and seller_id=${profileId}`;
  });
}
export type { ListingCondition, ListingStatus };
