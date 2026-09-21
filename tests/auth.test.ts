import { describe, expect, it } from "vitest";
import {
  loginSchema,
  firstAccessSchema,
  passwordSchema,
} from "@/lib/validations/auth";
import { safeNext } from "@/lib/auth/redirect";
describe("institutional credentials", () => {
  it("preserves RA leading zeros", () =>
    expect(loginSchema.parse({ ra: " 00123 ", password: " x " })).toEqual({
      ra: "00123",
      password: " x ",
    }));
  it("accepts RA and real calendar birth date", () =>
    expect(
      firstAccessSchema.parse({ ra: "00123", birthDate: "29/02/2004" })
        .birthDate,
    ).toBe("2004-02-29"));
  it("rejects impossible dates and email-only credentials", () => {
    expect(
      firstAccessSchema.safeParse({ ra: "123", birthDate: "31/02/2004" })
        .success,
    ).toBe(false);
    expect(
      loginSchema.safeParse({
        email: "person@example.test",
        password: "password",
      }).success,
    ).toBe(false);
  });
  it("requires matching, sufficiently long passwords", () => {
    expect(
      passwordSchema.safeParse({
        password: "12345678",
        confirmPassword: "12345679",
      }).success,
    ).toBe(false);
    expect(
      passwordSchema.safeParse({ password: "short", confirmPassword: "short" })
        .success,
    ).toBe(false);
  });
});
describe("redirect destinations", () => {
  it.each([
    "https://evil.test",
    "//evil.test",
    "/\\\\evil.test",
    "/networks\n",
    "/auth/login",
    "/marketplace-evil",
    "/marketplace/../../evil",
    null,
  ])("blocks %s", (value) => expect(safeNext(value)).toBe("/marketplace"));
  it.each([
    "/networks?skill=React",
    "/profile/edit",
    "/auth/update-password",
    "/auth/definir-senha",
    "/connections",
  ])("keeps %s", (value) => expect(safeNext(value)).toBe(value));
});
