import { describe, it, expect } from "vitest";
import {
  decimalPrice,
  formatPrice,
  listingSchema,
  marketplaceFiltersSchema,
  conditionForCategory,
  statusSchema,
  marketplaceHref,
} from "@/lib/validations/listing";
const valid = {
  title: "Livro de cálculo",
  description: "Livro em bom estado.",
  price: "45,00",
  category_id: "40000000-0000-4000-8000-000000000001",
  condition: "used",
};
describe("Marketplace domain", () => {
  it.each([
    ["45,00", "45.00"],
    ["45.50", "45.50"],
    ["1.234,56", "1234.56"],
    ["1.234", "1234.00"],
    ["0", "0.00"],
    ["9.999.999.999,99", "9999999999.99"],
  ])("parses exact BRL price %s", (input, output) =>
    expect(decimalPrice(input)).toBe(output),
  );
  it.each([
    "-1",
    "NaN",
    "Infinity",
    "1e3",
    "45,001",
    "45.0010",
    "10000000000",
    "1,234",
    "1.23.45",
    "R$ 20",
    20,
    null,
  ])("rejects malformed/out-of-range price %s", (input) =>
    expect(decimalPrice(input)).toBeNull(),
  );
  it("formats BRL and checks title/description boundaries", () => {
    expect(formatPrice("45.00").replace(/\s/g, " ")).toBe("R$ 45,00");
    expect(listingSchema.parse(valid).price).toBe("45.00");
    for (const title of ["ab", "a".repeat(121)])
      expect(listingSchema.safeParse({ ...valid, title }).success).toBe(false);
    for (const description of [" ", "a".repeat(5001)])
      expect(listingSchema.safeParse({ ...valid, description }).success).toBe(
        false,
      );
    expect(
      listingSchema.safeParse({
        ...valid,
        title: "abc",
        description: "a".repeat(5000),
      }).success,
    ).toBe(true);
  });
  it("validates category/condition/status and normalizes services on server", () => {
    expect(
      listingSchema.safeParse({ ...valid, category_id: "forged" }).success,
    ).toBe(false);
    expect(
      listingSchema.safeParse({ ...valid, condition: "broken" }).success,
    ).toBe(false);
    const input = listingSchema.parse(valid);
    expect(conditionForCategory(input, true).condition).toBe("not_applicable");
    expect(() =>
      conditionForCategory({ ...input, condition: "not_applicable" }, false),
    ).toThrow();
    for (const status of ["active", "sold", "inactive"])
      expect(statusSchema.safeParse(status).success).toBe(true);
    expect(statusSchema.safeParse("deleted").success).toBe(false);
  });
  it("rejects array parameters, inverted range and invalid pagination; preserves filters", () => {
    expect(marketplaceFiltersSchema.safeParse({ q: ["forged"] }).success).toBe(
      false,
    );
    expect(
      marketplaceFiltersSchema.safeParse({ min: "100", max: "10" }).success,
    ).toBe(false);
    expect(marketplaceFiltersSchema.safeParse({ page: "0" }).success).toBe(
      false,
    );
    expect(marketplaceFiltersSchema.parse({}).page).toBe(1);
    expect(marketplaceHref({ q: "livro", status: "sold" }, 2, true)).toBe(
      "/marketplace/meus-anuncios?q=livro&status=sold&page=2",
    );
  });
});
