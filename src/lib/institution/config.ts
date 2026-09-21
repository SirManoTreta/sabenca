import "server-only";
export const INSTITUTION_ID = "fatece";
export const ACTIVATION_COOKIE = "sabenca-activation";
export function institutionConfigured() {
  return Boolean(
    process.env.DATABASE_URL &&
    process.env.SUPABASE_SECRET_KEY &&
    process.env.CPF_HMAC_SECRET &&
    process.env.AUTH_HMAC_SECRET &&
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
export function appOrigin() {
  const value = process.env.NEXT_PUBLIC_APP_URL;
  if (!value) throw new Error("Application URL is not configured");
  return new URL(value).origin;
}
