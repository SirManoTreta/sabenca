import { describe, expect, it } from "vitest";
import { certificateExpired } from "@/lib/certificates";
import { marketplaceContactSchema } from "@/lib/validations/marketplace-contact";
import { conditionForCategory, listingSchema } from "@/lib/validations/listing";
const listing = {
  title: "Manutenção Linux",
  description: "Serviço de configuração de servidores.",
  price: "50,00",
  category_id: "40000000-0000-4000-8000-000000000001",
  condition: "not_applicable",
};
const certificate = (n: number) =>
  `70000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
describe("multiple credential selection", () => {
  it.each([0, 1, 2, 3])(
    "accepts %i unique IDs and preserves submitted ordering",
    (count) => {
      const ids = [certificate(3), certificate(1), certificate(2)].slice(
        0,
        count,
      );
      expect(
        listingSchema.parse({ ...listing, certificate_ids: ids })
          .certificate_ids,
      ).toEqual(ids);
    },
  );
  it("defaults absent selection to zero and rejects malformed, duplicated or fourth IDs", () => {
    expect(listingSchema.parse(listing).certificate_ids).toEqual([]);
    expect(listingSchema.parse(listing).preserve_credentials).toBe(false);
    for (const certificate_ids of [
      [certificate(1), certificate(2), certificate(3), certificate(4)],
      [certificate(1), certificate(1)],
      ["invalid"],
      [null],
      certificate(1),
    ])
      expect(
        listingSchema.safeParse({ ...listing, certificate_ids }).success,
      ).toBe(false);
  });
  it("accepts a typed preservation decision and refuses string or coerced flags", () => {
    expect(
      listingSchema.parse({ ...listing, preserve_credentials: true })
        .preserve_credentials,
    ).toBe(true);
    for (const preserve_credentials of ["true", "false", 0, 1, null, []])
      expect(
        listingSchema.safeParse({ ...listing, preserve_credentials }).success,
      ).toBe(false);
  });
  it("rejects credentials submitted with a product and keeps its existing condition rule", () => {
    const input = listingSchema.parse({
      ...listing,
      condition: "used",
      certificate_ids: [certificate(1)],
    });
    expect(() => conditionForCategory(input, false)).toThrow(
      "Somente serviços",
    );
    expect(conditionForCategory(input, true).condition).toBe("not_applicable");
    expect(
      conditionForCategory(
        listingSchema.parse({ ...listing, condition: "used" }),
        false,
      ).certificate_ids,
    ).toEqual([]);
  });
});
describe("current credentials and voluntary contact", () => {
  it("uses the Sao Paulo calendar day and keeps expiration day inclusive", () => {
    expect(certificateExpired(null)).toBe(false);
    expect(
      certificateExpired("2026-10-21", new Date("2026-10-22T01:00:00Z")),
    ).toBe(false);
    expect(
      certificateExpired("2026-10-21", new Date("2026-10-22T03:00:00Z")),
    ).toBe(true);
    expect(
      certificateExpired("2026-10-22", new Date("2026-10-22T23:59:59Z")),
    ).toBe(false);
  });
  it.each([
    "javascript:alert(1)",
    "http://example.test",
    "//example.test",
    "mailto:private@example.test",
    "https://user:password@example.test",
    "https:///",
    "https://example.test/with space",
  ])("rejects unsafe or malformed contacts: %s", (url) => {
    expect(
      marketplaceContactSchema.safeParse({ url, enabled: true }).success,
    ).toBe(false);
  });
  it("requires both a voluntary link and consent", () => {
    expect(
      marketplaceContactSchema.safeParse({ url: "", enabled: true }).success,
    ).toBe(false);
    expect(marketplaceContactSchema.parse({ url: "", enabled: false })).toEqual(
      { url: "", enabled: false },
    );
    expect(
      marketplaceContactSchema.parse({
        url: " https://wa.me/5511999999999 ",
        enabled: true,
      }).url,
    ).toBe("https://wa.me/5511999999999");
  });
});
