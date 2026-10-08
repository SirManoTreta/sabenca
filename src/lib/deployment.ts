// Validate hosted builds before publishing an application with incomplete access.
// Only variable names are reported; credential values never enter build logs.
export function validateDeploymentEnvironment(
  env: Record<string, string | undefined>,
) {
  if (env.VERCEL !== "1") return;
  const required = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "DATABASE_URL",
    "SUPABASE_SECRET_KEY",
    "CPF_HMAC_SECRET",
    "AUTH_HMAC_SECRET",
  ];
  if (env.VERCEL_ENV === "production") required.push("NEXT_PUBLIC_APP_URL");
  const missing = required.filter((name) => !env[name]?.trim());
  if (missing.length)
    throw new Error(
      `Missing deployment environment variables: ${missing.join(", ")}`,
    );
  for (const name of ["CPF_HMAC_SECRET", "AUTH_HMAC_SECRET"]) {
    if (Buffer.byteLength(env[name]!, "utf8") < 32)
      throw new Error(`${name} must contain at least 32 bytes`);
  }
  if (env.CPF_HMAC_SECRET === env.AUTH_HMAC_SECRET)
    throw new Error("CPF_HMAC_SECRET and AUTH_HMAC_SECRET must be independent");
  try {
    const supabase = new URL(env.NEXT_PUBLIC_SUPABASE_URL!);
    const database = new URL(env.DATABASE_URL!);
    const ref = supabase.hostname.match(/^([a-z0-9]+)\.supabase\.co$/)?.[1];
    if (!ref || supabase.protocol !== "https:") throw new Error();
    if (!["postgres:", "postgresql:"].includes(database.protocol))
      throw new Error();
    const direct = database.hostname === `db.${ref}.supabase.co`;
    const pooler =
      database.hostname.endsWith(".pooler.supabase.com") &&
      decodeURIComponent(database.username) === `postgres.${ref}`;
    if (!direct && !pooler) throw new Error();
  } catch {
    throw new Error(
      "DATABASE_URL and NEXT_PUBLIC_SUPABASE_URL must reference the same Supabase project",
    );
  }
  if (env.VERCEL_ENV === "production") {
    try {
      const app = new URL(env.NEXT_PUBLIC_APP_URL!);
      if (
        app.protocol !== "https:" ||
        app.username ||
        app.password ||
        ["localhost", "127.0.0.1", "[::1]"].includes(app.hostname)
      )
        throw new Error();
    } catch {
      throw new Error("NEXT_PUBLIC_APP_URL must be the production HTTPS URL");
    }
  }
}
