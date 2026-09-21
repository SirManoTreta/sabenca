import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/config";
import type { SupabaseClient } from "@supabase/supabase-js";
export async function accessContext(client: SupabaseClient) {
  const { data, error } = await client.rpc("access_context");
  return {
    member: !error && data?.member === true,
    admin: !error && data?.admin === true,
  };
}
export const requireIdentity = cache(async () => {
  if (!supabaseConfigured()) redirect("/auth/login");
  const client = await createClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user || !user.email_confirmed_at || user.is_anonymous)
    redirect("/auth/login");
  return { client, user };
});
export const requireUser = cache(async () => {
  const session = await requireIdentity();
  const access = await accessContext(session.client);
  if (!access.member) redirect("/auth/acesso-negado");
  return { ...session, access };
});
export const requireAdmin = cache(async () => {
  if (!supabaseConfigured()) redirect("/auth/admin");
  const client = await createClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user || !user.email_confirmed_at || user.is_anonymous)
    redirect("/auth/admin");
  if (!(await accessContext(client)).admin) redirect("/auth/acesso-negado");
  return { client, user };
});
