import "server-only";
import { headers } from "next/headers";
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
export async function appOrigin() {
  // PKCE and activation cookies belong to the host where the flow started.
  // Accept only Vercel-provided preview hosts, never an arbitrary Host header.
  if (process.env.VERCEL_ENV === "preview") {
    const origins = [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL]
      .filter((host): host is string => Boolean(host))
      .map((host) => `https://${host}`);
    const origin = (await headers()).get("origin");
    if (!origin || !origins.includes(origin))
      throw new Error("Preview origin is not configured or allowed");
    return origin;
  }
  const value = process.env.NEXT_PUBLIC_APP_URL;
  if (!value) throw new Error("Application URL is not configured");
  const url = new URL(value);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    url.username ||
    url.password ||
    (url.protocol !== "https:" && !(local && url.protocol === "http:")) ||
    (process.env.VERCEL_ENV === "production" && local)
  )
    throw new Error("Application URL must be a valid HTTPS origin");
  return url.origin;
}
