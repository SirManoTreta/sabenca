import { describe, expect, it } from "vitest";
import { validateDeploymentEnvironment } from "@/lib/deployment";

const preview = {
  VERCEL: "1",
  VERCEL_ENV: "preview",
  NEXT_PUBLIC_SUPABASE_URL: "https://devref.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "public-test-value",
  DATABASE_URL:
    "postgresql://postgres.devref:test-password@aws-0-us-east-1.pooler.supabase.com:6543/postgres",
  SUPABASE_SECRET_KEY: "private-test-value",
  CPF_HMAC_SECRET: "a".repeat(32),
  AUTH_HMAC_SECRET: "b".repeat(32),
};

describe("hosted build configuration", () => {
  it("allows local/CI checks without real credentials", () => {
    expect(() => validateDeploymentEnvironment({})).not.toThrow();
  });
  it("accepts matching preview credentials without a canonical production URL", () => {
    expect(() => validateDeploymentEnvironment(preview)).not.toThrow();
  });
  it("rejects mixed databases without leaking credentials", () => {
    expect(() =>
      validateDeploymentEnvironment({
        ...preview,
        DATABASE_URL: preview.DATABASE_URL.replace(
          "postgres.devref",
          "postgres.prodref",
        ),
      }),
    ).toThrow(
      /^DATABASE_URL and NEXT_PUBLIC_SUPABASE_URL must reference the same Supabase project$/,
    );
  });
  it("rejects missing server keys and short/shared HMAC secrets", () => {
    expect(() =>
      validateDeploymentEnvironment({ ...preview, SUPABASE_SECRET_KEY: "" }),
    ).toThrow("Missing deployment environment variables: SUPABASE_SECRET_KEY");
    expect(() =>
      validateDeploymentEnvironment({ ...preview, CPF_HMAC_SECRET: "short" }),
    ).toThrow("CPF_HMAC_SECRET must contain at least 32 bytes");
    expect(() =>
      validateDeploymentEnvironment({
        ...preview,
        AUTH_HMAC_SECRET: preview.CPF_HMAC_SECRET,
      }),
    ).toThrow("must be independent");
  });
  it("requires a production HTTPS URL", () => {
    const production = { ...preview, VERCEL_ENV: "production" };
    expect(() => validateDeploymentEnvironment(production)).toThrow(
      "NEXT_PUBLIC_APP_URL",
    );
    expect(() =>
      validateDeploymentEnvironment({
        ...production,
        NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      }),
    ).toThrow("production HTTPS URL");
    expect(() =>
      validateDeploymentEnvironment({
        ...production,
        NEXT_PUBLIC_APP_URL: "https://sabenca.example.test",
      }),
    ).not.toThrow();
  });
});
