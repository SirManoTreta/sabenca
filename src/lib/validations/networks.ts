import { z } from "zod";
import type { NetworkFilters } from "@/types/networks";
export const NETWORK_PAGE_SIZE = 24;
const optionalId = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.uuid().optional(),
);
const integerParam = (max: number) =>
  z
    .string()
    .regex(/^\d{1,5}$/)
    .transform(Number)
    .pipe(z.number().int().min(1).max(max));
export const networkFiltersSchema = z.object({
  q: z.string().trim().max(100).default(""),
  course: optionalId,
  skill: optionalId,
  interest: optionalId,
  semester: z.preprocess(
    (value) => (value === "" ? undefined : value),
    integerParam(30).optional(),
  ),
  page: integerParam(10000).default(1),
});
export function networksHref(filters: NetworkFilters, page: number) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...filters, page })) {
    if (value !== undefined && value !== "") query.set(key, String(value));
  }
  return `/networks?${query.toString()}`;
}
