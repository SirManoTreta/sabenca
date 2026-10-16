import "server-only";
import type { TransactionSql } from "postgres";
import { z } from "zod";
import { database } from "@/lib/institution/database";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/services/session";
import { appOrigin } from "@/lib/institution/config";
import { idSchema } from "@/lib/validations/project";

export const administratorEmail = z
  .string()
  .trim()
  .toLowerCase()
  .email()
  .max(254);
export class AdministratorError extends Error {}

async function authorize(sql: TransactionSql, actor: string) {
  idSchema.parse(actor);
  await sql`select set_config('request.jwt.claim.sub',${actor},true)`;
  await sql`select pg_advisory_xact_lock(72619410)`;
  const [access] = await sql`select private.is_admin() as allowed`;
  if (!access?.allowed)
    throw new AdministratorError("Acesso administrativo revogado.");
}

export async function listAdministrators() {
  const { user } = await requireAdmin();
  return database().begin(async (sql) => {
    await authorize(sql, user.id);
    const administrators = await sql<
      { id: string; email: string; confirmed: boolean; banned: boolean }[]
    >`
      select a.user_id as id,u.email,u.email_confirmed_at is not null as confirmed,
        coalesce(u.banned_until>now(),false) as banned
      from private.admin_users a join auth.users u on u.id=a.user_id
      where a.institution_id='fatece' order by lower(u.email)`;
    const invitations = await sql<
      { email: string; delivery_failed: boolean }[]
    >`
      select email,delivery_failed from private.admin_invitations where institution_id='fatece' order by email`;
    return {
      administrators: [...administrators],
      invitations: [...invitations],
      ownId: user.id,
    };
  });
}

// The identity is supplied by requireAdmin in the Server Action. Recheck at every commit.
export async function addAdministrator(
  actor: string,
  input: unknown,
  origin: string,
  resend = false,
) {
  const email = administratorEmail.parse(input);
  idSchema.parse(actor);
  const sql = database();
  const existing = await sql.begin(async (tx) => {
    await authorize(tx, actor);
    const [existing] =
      await tx`select u.id,u.email_confirmed_at,a.user_id as admin_id from auth.users u
      left join private.admin_users a on a.user_id=u.id where lower(u.email)=${email}`;
    if (existing?.admin_id && (!resend || existing.email_confirmed_at))
      throw new AdministratorError("Este e-mail já é administrador.");
    if (resend && !existing?.admin_id)
      throw new AdministratorError("Convite não encontrado.");
    // Lease is committed before Auth checks the closed-signup invitation.
    const [lease] =
      await tx`insert into private.admin_invitations(email,institution_id)
      values (${email},'fatece') on conflict(email) do update set
      expires_at=now()+interval '15 minutes',delivery_failed=false
      where admin_invitations.expires_at<now() or admin_invitations.delivery_failed
      returning email`;
    if (!lease)
      throw new AdministratorError(
        "Convite em andamento. Aguarde alguns minutos antes de tentar novamente.",
      );
    return existing;
  });
  let userId = existing?.id as string | undefined;
  try {
    if (!userId || !existing?.email_confirmed_at) {
      const result = await createAdminClient().auth.admin.inviteUserByEmail(
        email,
        {
          redirectTo: `${origin}/auth/convite`,
        },
      );
      if (result.error || !result.data.user)
        throw new AdministratorError(
          "Não foi possível enviar o convite. Tente novamente.",
        );
      userId = result.data.user.id;
    }
    await sql.begin(async (tx) => {
      await authorize(tx, actor);
      // An interrupted Auth request may already have created this address. Retrying
      // finds that same account; no user, password or student record is overwritten.
      await tx`update private.admin_invitations set provisioned_user_id=${userId!} where email=${email}`;
      const [created] =
        await tx`insert into private.admin_users(user_id,institution_id)
        values (${userId!},'fatece') on conflict do nothing returning user_id`;
      if (!created && !resend)
        throw new AdministratorError("Este e-mail já é administrador.");
      if (created)
        await tx`insert into private.admin_access_events(actor_id,target_id,operation) values (${actor},${userId!},'grant')`;
      await tx`delete from private.admin_invitations where email=${email}`;
    });
  } catch (error) {
    // Durable queue item remains visible to admins even if Auth succeeded but a
    // later write failed. A retry completes authorization for that same account.
    await sql`update private.admin_invitations set delivery_failed=true,
      provisioned_user_id=coalesce(${userId ?? null}::uuid,provisioned_user_id) where email=${email}`;
    throw error;
  }
  return existing?.email_confirmed_at
    ? "Administrador adicionado. Use a senha já cadastrada."
    : "Convite enviado. O acesso exige confirmação do e-mail e definição de senha.";
}

export async function revokeAdministrator(actor: string, target: string) {
  idSchema.parse(target);
  if (actor === target)
    throw new AdministratorError("Você não pode revogar seu próprio acesso.");
  await database().begin(async (sql) => {
    await authorize(sql, actor);
    const removed =
      await sql`delete from private.admin_users where user_id=${target} and institution_id='fatece' returning user_id`;
    if (!removed.length)
      throw new AdministratorError("Administrador não encontrado.");
    await sql`insert into private.admin_access_events(actor_id,target_id,operation) values (${actor},${target},'revoke')`;
  });
}

export async function inviteAdministrator(input: unknown, resend = false) {
  const { user } = await requireAdmin();
  return addAdministrator(user.id, input, await appOrigin(), resend);
}
