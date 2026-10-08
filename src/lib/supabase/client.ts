"use client";
import { createBrowserClient } from "@supabase/ssr";
import { supabaseConfig } from "./config";
export function createClient() {
  const { url, key } = supabaseConfig();
  return createBrowserClient(url, key, {
    cookieOptions: { secure: process.env.NODE_ENV === "production" },
  });
}
