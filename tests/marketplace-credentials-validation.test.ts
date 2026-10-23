import { describe, expect, it } from "vitest";
import { certificateExpired } from "@/lib/certificates";
import { marketplaceContactSchema } from "@/lib/validations/marketplace-contact";
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
