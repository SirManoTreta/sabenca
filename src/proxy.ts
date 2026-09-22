import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseConfig, supabaseConfigured } from "@/lib/supabase/config";
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  response.headers.set("Cache-Control", "private, no-store");
  if (!supabaseConfigured()) return response;
  const { url, key } = supabaseConfig();
  const client = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values, headers) {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        Object.entries(headers ?? {}).forEach(([name, value]) =>
          response.headers.set(name, value),
        );
        response.headers.set("Cache-Control", "private, no-store");
      },
    },
  });
  await client.auth.getClaims();
  return response;
}
export const config = {
  matcher: [
    "/auth/:path*",
    "/admin/:path*",
    "/marketplace/:path*",
    "/networks/:path*",
    "/profile/:path*",
    "/users/:path*",
    "/connections/:path*",
  ],
};
