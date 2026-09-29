import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const request = vi.hoisted(() => ({ origin: "" }));
vi.mock("next/headers", () => ({
  headers: async () =>
    new Headers(request.origin ? { origin: request.origin } : {}),
}));
import { appOrigin } from "@/lib/institution/config";

afterEach(() => {
  vi.unstubAllEnvs();
  request.origin = "";
});

describe("environment-specific email callbacks", () => {
  it("uses the explicit local origin", async () => {
    vi.stubEnv("VERCEL_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000/");
    expect(await appOrigin()).toBe("http://localhost:3000");
  });
  it.each(["https://deployment.vercel.app", "https://branch.vercel.app"])(
    "preserves the preview host and its PKCE cookies: %s",
    async (origin) => {
      vi.stubEnv("VERCEL_ENV", "preview");
      vi.stubEnv("VERCEL_URL", "deployment.vercel.app");
      vi.stubEnv("VERCEL_BRANCH_URL", "branch.vercel.app");
      vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://production.example.test");
      request.origin = origin;
      expect(await appOrigin()).toBe(origin);
    },
  );
  it.each(["https://evil.test", "https://deployment.vercel.app.evil.test", ""])(
    "rejects missing or untrusted preview origin: %s",
    async (origin) => {
      vi.stubEnv("VERCEL_ENV", "preview");
      vi.stubEnv("VERCEL_URL", "deployment.vercel.app");
      vi.stubEnv("VERCEL_BRANCH_URL", "branch.vercel.app");
      request.origin = origin;
      await expect(appOrigin()).rejects.toThrow("Preview origin");
    },
  );
  it("keeps production callbacks on the canonical URL", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://production.example.test/");
    request.origin = "https://evil.test";
    expect(await appOrigin()).toBe("https://production.example.test");
  });
  it.each([
    "http://localhost:3000",
    "http://example.test",
    "https://u:p@example.test",
    "",
  ])("rejects invalid production configuration: %s", async (url) => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", url);
    await expect(appOrigin()).rejects.toThrow();
  });
});
