import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import postgres from "postgres";

const emailIndex = process.argv.indexOf("--email");
const email = (process.argv[emailIndex + 1] || "").trim().toLowerCase();
if (emailIndex < 0 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  throw new Error(
    "Uso: node --env-file=.env.local scripts/bootstrap-admin.mjs --email email-do-administrador",
  );
}
const {
  DATABASE_URL,
  DATABASE_SSL_CA_FILE,
  NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SECRET_KEY,
  ADMIN_BOOTSTRAP_PASSWORD,
} = process.env;
if (!DATABASE_URL || !NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SECRET_KEY)
  throw new Error("Configure as credenciais de servidor no .env.local.");
const sql = postgres(DATABASE_URL, {
  ssl: {
    rejectUnauthorized: true,
    ca: DATABASE_SSL_CA_FILE
      ? readFileSync(DATABASE_SSL_CA_FILE, "utf8")
      : undefined,
  },
  prepare: false,
  max: 1,
  onnotice: () => {},
});
try {
  const [existing] =
    await sql`select id,email_confirmed_at from auth.users where lower(email)=${email}`;
  let userId = existing?.id;
  if (!userId) {
    if (!ADMIN_BOOTSTRAP_PASSWORD || ADMIN_BOOTSTRAP_PASSWORD.length < 12)
      throw new Error(
        "Defina ADMIN_BOOTSTRAP_PASSWORD com pelo menos 12 caracteres no ambiente local. A senha nunca é impressa.",
      );
    const client = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    // Authorization exists before Auth inserts the user. This never grants
    // administrator rights by itself; private.admin_users remains authoritative.
    await sql`delete from private.admin_invitations where expires_at < now()`;
    await sql`insert into private.admin_invitations (email,institution_id,expires_at) values (${email},'fatece',now()+interval '15 minutes') on conflict (email) do update set expires_at=excluded.expires_at`;
    try {
      const { data, error } = await client.auth.admin.createUser({
        email,
        password: ADMIN_BOOTSTRAP_PASSWORD,
        email_confirm: true,
      });
      if (error || !data.user) {
        console.error("SABENCA_ADMIN_CREATE_FAILED", {
          code: error?.code,
          status: error?.status,
        });
        throw new Error("Não foi possível criar a conta administrativa.");
      }
      userId = data.user.id;
    } finally {
      await sql`delete from private.admin_invitations where email=${email}`;
    }
  } else if (!existing.email_confirmed_at) {
    throw new Error(
      "A conta existente deve confirmar seu e-mail antes de receber acesso administrativo.",
    );
  }
  await sql`insert into private.admin_users (user_id,institution_id) values (${userId},'fatece') on conflict (user_id) do nothing`;
  console.log(
    "Administrador autorizado. Acesse /auth/admin. Remova ADMIN_BOOTSTRAP_PASSWORD do ambiente após o uso.",
  );
} finally {
  await sql.end();
}
