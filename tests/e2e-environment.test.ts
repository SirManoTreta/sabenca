import { describe, it, expect } from "vitest";
import { assertDevEnvironment } from "./e2e/dev-environment";
const ref = "fidndjlresfxvmerkbhs";
const valid = {
  SABENCA_E2E_INTEGRATION: "1",
  NEXT_PUBLIC_SUPABASE_URL: `https://${ref}.supabase.co`,
  DATABASE_URL: `postgres://postgres.${ref}:fixture-only@aws-0-us-east-1.pooler.supabase.com:5432/postgres`,
};
describe("hosted fixture isolation", () => {
  it("accepts only explicit DEV and rejects Production, spoofed hosts and missing opt-in", () => {
    expect(() => assertDevEnvironment(valid)).not.toThrow();
    for (const patch of [
      { SABENCA_E2E_INTEGRATION: "0" },
      { NEXT_PUBLIC_SUPABASE_URL: "https://qybcbxrxghykkchnvmhy.supabase.co" },
      {
        DATABASE_URL: `postgres://postgres.${ref}:fixture-only@untrusted.example.test:5432/postgres`,
      },
      {
        DATABASE_URL:
          "postgres://postgres.qybcbxrxghykkchnvmhy:fixture-only@aws-0-us-east-1.pooler.supabase.com:5432/postgres",
      },
    ])
      expect(() => assertDevEnvironment({ ...valid, ...patch })).toThrow();
  });
});
