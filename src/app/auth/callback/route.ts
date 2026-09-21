import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/config";
import { safeNext } from "@/lib/auth/redirect";
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeNext(request.nextUrl.searchParams.get("next"));
  if (code && supabaseConfigured()) {
    try {
      const client = await createClient();
      const { error } = await client.auth.exchangeCodeForSession(code);
      if (!error) {
        const response = NextResponse.redirect(new URL(next, request.url));
        response.headers.set("Cache-Control", "private, no-store");
        return response;
      }
    } catch {
      /* Fail closed and offer a fresh email link. */
    }
  }
  const response = NextResponse.redirect(
    new URL("/auth/login?message=invalid-link", request.url),
  );
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
