// Fixtures mutate only the explicitly authorized development project.
export function assertDevEnvironment(env = process.env) {
  const ref = "fidndjlresfxvmerkbhs";
  const db = new URL(env.DATABASE_URL ?? "https://unconfigured.invalid");
  const direct =
    db.hostname === `db.${ref}.supabase.co` &&
    decodeURIComponent(db.username) === "postgres";
  const pooler =
    db.hostname.endsWith(".pooler.supabase.com") &&
    decodeURIComponent(db.username) === `postgres.${ref}`;
  if (
    env.SABENCA_E2E_INTEGRATION !== "1" ||
    env.NEXT_PUBLIC_SUPABASE_URL !== `https://${ref}.supabase.co` ||
    !["postgres:", "postgresql:"].includes(db.protocol) ||
    !(direct || pooler)
  )
    throw new Error(
      "Integration fixtures require explicit Supabase DEV environment.",
    );
}
