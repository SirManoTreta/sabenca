import { z } from "zod";
export const LISTING_PAGE_SIZE = 12;
export const MAX_LISTING_IMAGES = 5;
export const conditionLabels = {
  new: "Novo",
  like_new: "Como novo",
  used: "Usado",
  not_applicable: "Não se aplica",
} as const;
export const statusLabels = {
  active: "Ativo",
  sold: "Vendido",
  inactive: "Inativo",
} as const;
export const conditionSchema = z.enum([
  "new",
  "like_new",
  "used",
  "not_applicable",
]);
export const statusSchema = z.enum(["active", "sold", "inactive"]);
// Parse to integer cents, then a decimal string; floating point never writes price.
export function decimalPrice(value: unknown): string | null {
  if (typeof value !== "string") return null;
  let text = value.trim();
  if (/^\d{1,2}\d?(?:\.\d{3})+(?:,\d{1,2})?$/.test(text))
    text = text.replaceAll(".", "");
  if (!/^\d{1,10}(?:[.,]\d{1,2})?$/.test(text)) return null;
  const [whole, fraction = ""] = text.replace(",", ".").split(".");
  const cents = BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0"));
  if (cents > BigInt("999999999999")) return null;
  return `${cents / BigInt(100)}.${String(cents % BigInt(100)).padStart(2, "0")}`;
}
export function formatPrice(value: string) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value));
}
export const priceSchema = z
  .unknown()
  .transform(decimalPrice)
  .refine(
    (v) => v !== null,
    "Informe um preço válido entre 0 e 9.999.999.999,99.",
  )
  .transform((v) => v!);
export const listingSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Use pelo menos 3 caracteres.")
    .max(120, "Use até 120 caracteres."),
  description: z
    .string()
    .trim()
    .min(1, "Descreva o anúncio.")
    .max(5000, "Use até 5000 caracteres."),
  price: priceSchema,
  category_id: z.uuid("Escolha uma categoria válida."),
  condition: conditionSchema,
});
const optionalId = z.preprocess(
  (v) => (v === "" ? undefined : v),
  z.uuid().optional(),
);
const optionalPrice = z.preprocess(
  (v) => (v === "" ? undefined : v),
  priceSchema.optional(),
);
export const marketplaceFiltersSchema = z
  .object({
    q: z.string().trim().max(100).default(""),
    category: optionalId,
    seller: optionalId,
    condition: z.preprocess(
      (v) => (v === "" ? undefined : v),
      conditionSchema.optional(),
    ),
    min: optionalPrice,
    max: optionalPrice,
    status: z.preprocess(
      (v) => (v === "" ? undefined : v),
      statusSchema.optional(),
    ),
    sort: z.enum(["recent", "price_asc", "price_desc"]).default("recent"),
    page: z
      .string()
      .regex(/^\d{1,5}$/)
      .transform(Number)
      .pipe(z.number().int().min(1).max(10000))
      .default(1),
  })
  .refine((v) => !v.min || !v.max || Number(v.min) <= Number(v.max), {
    message: "Preço mínimo deve ser menor ou igual ao máximo.",
    path: ["min"],
  });
export type ListingInput = z.infer<typeof listingSchema>;
export type MarketplaceFilters = z.infer<typeof marketplaceFiltersSchema>;
export function conditionForCategory(
  input: ListingInput,
  service: boolean,
): ListingInput {
  if (service) return { ...input, condition: "not_applicable" };
  if (input.condition === "not_applicable")
    throw new Error("Escolha a condição do produto.");
  return input;
}
export function marketplaceHref(
  params: Record<string, unknown>,
  page?: number,
  mine = false,
) {
  const query = new URLSearchParams();
  const values: Record<string, unknown> = {
    ...params,
    ...(page === undefined ? {} : { page }),
  };
  for (const [key, value] of Object.entries(values))
    if (value !== undefined && value !== "" && !Array.isArray(value))
      query.set(key, String(value));
  return `${mine ? "/marketplace/meus-anuncios" : "/marketplace"}?${query.toString()}`;
}
