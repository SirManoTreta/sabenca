"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

// Supabase's verified invitation redirects with a short-lived token pair in the
// URL fragment. Remove it immediately; never forward it or render it in the DOM.
export function InvitationSession() {
  const [failed, setFailed] = useState(false);
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    window.history.replaceState(null, "", "/auth/convite");
    const access_token = fragment.get("access_token");
    const refresh_token = fragment.get("refresh_token");
    void (async () => {
      const client = createClient();
      if (access_token && refresh_token) {
        const { error } = await client.auth.setSession({
          access_token,
          refresh_token,
        });
        if (error) {
          setFailed(true);
          return;
        }
      }
      const { data } = await client.auth.getUser();
      if (!data.user) {
        setFailed(true);
        return;
      }
      window.location.replace("/auth/update-password");
    })().catch(() => setFailed(true));
  }, []);
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">Convite administrativo</h1>
      <p role="status">
        {failed
          ? "Convite inválido ou expirado. Peça ao administrador para verificar seu acesso."
          : "Validando convite…"}
      </p>
      {failed && (
        <Link href="/auth/admin">Ir para o acesso administrativo</Link>
      )}
    </section>
  );
}
