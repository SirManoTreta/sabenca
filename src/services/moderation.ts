import "server-only";
import { z } from "zod";
import { database } from "@/lib/institution/database";
import { idSchema } from "@/lib/validations/project";
import { withCertificateActor } from "./certificates";
import { requireAdmin, requireUser } from "./session";
export const reportSchema = z.object({
  target_type: z.enum(["profile", "listing"]),
  target_id: idSchema,
  reason: z.enum(["harassment", "fraud", "inappropriate", "privacy", "other"]),
  details: z.string().trim().max(2000).default(""),
});
export async function reportContent(actor: string, input: unknown) {
  const v = reportSchema.parse(input);
  await withCertificateActor(actor, async (sql) => {
    // Bounded submission rate; unique constraint also prevents duplicate targets.
    const [rate] =
      await sql`select count(*)::integer as n from public.reports where reporter_id=${actor} and created_at>now()-interval '1 hour'`;
    if (rate.n >= 10)
      throw new Error("Limite de denúncias atingido. Tente mais tarde.");
    await sql`insert into public.reports(reporter_id,target_type,target_id,reason,details) values (${actor},${v.target_type},${v.target_id},${v.reason},${v.details || null})`;
  });
}
export async function reviewReport(actor: string, id: string, status: string) {
  idSchema.parse(id);
  const value = z.enum(["reviewed", "dismissed", "actioned"]).parse(status);
  await withCertificateActor(actor, async (sql) => {
    const rows =
      await sql`update public.reports set status=${value},reviewed_by=${actor},reviewed_at=now() where id=${id} returning id`;
    if (!rows.length) throw new Error("Denúncia indisponível.");
  });
}
export async function listReports() {
  const { user } = await requireAdmin();
  return withCertificateActor(user.id, async (sql) => [
    ...(await sql<
      {
        id: string;
        target_type: string;
        target_id: string;
        reason: string;
        details: string | null;
        status: string;
      }[]
    >`select id,target_type,target_id,reason,details,status from public.reports order by (status='pending') desc,created_at limit 100`),
  ]);
}
export async function reportTarget(id: string) {
  const { user } = await requireAdmin();
  idSchema.parse(id);
  return database().begin(async (sql) => {
    await sql`select set_config('request.jwt.claim.sub',${user.id},true)`;
    const [access] = await sql`select private.is_admin() as allowed`;
    if (!access?.allowed) throw new Error("Acesso revogado.");
    const [report] =
      await sql`select target_type,target_id from public.reports where id=${id}`;
    if (!report) return null;
    if (report.target_type === "profile") {
      const [p] =
        await sql`select name as title,bio as description,'Perfil da comunidade' as kind from public.profiles where id=${report.target_id}`;
      return p ?? null;
    }
    const [l] =
      await sql`select title,description,'Anúncio do Marketplace' as kind,status from public.listings where id=${report.target_id}`;
    return l ?? null;
  });
}
export async function blockProfile(
  actor: string,
  profileId: string,
  blocked: boolean,
) {
  idSchema.parse(actor);
  idSchema.parse(profileId);
  await database().begin(async (sql) => {
    await sql`select set_config('request.jwt.claim.sub',${actor},true)`;
    const [access] = await sql`select private.is_member() as allowed`;
    if (!access?.allowed) throw new Error("Acesso revogado.");
    const [target] =
      await sql`select user_id from public.profiles where id=${profileId}`;
    if (!target || target.user_id === actor)
      throw new Error("Usuário indisponível.");
    await sql`set local role authenticated`;
    if (blocked)
      await sql`insert into public.user_blocks(blocker_id,blocked_id) values (${actor},${target.user_id}) on conflict do nothing`;
    else
      await sql`delete from public.user_blocks where blocker_id=${actor} and blocked_id=${target.user_id}`;
  });
}
export const privacyKeys = [
  "show_semester",
  "show_bio",
  "show_skills",
  "show_interests",
  "show_projects",
  "show_listings",
] as const;
export type Privacy = Record<(typeof privacyKeys)[number], boolean>;
export async function privacySettings() {
  const { user } = await requireUser();
  return database().begin(async (sql) => {
    await sql`select set_config('request.jwt.claim.sub',${user.id},true)`;
    const [access] = await sql`select private.is_member() as allowed`;
    if (!access?.allowed) throw new Error("Acesso revogado.");
    const [settings] = await sql<
      Privacy[]
    >`select show_semester,show_bio,show_skills,show_interests,show_projects,show_listings from public.profile_privacy where user_id=${user.id}`;
    const blocks = await sql<
      { id: string; name: string }[]
    >`select p.id,p.name from public.user_blocks b join public.profiles p on p.user_id=b.blocked_id where b.blocker_id=${user.id} order by p.name`;
    return {
      settings:
        settings ??
        (Object.fromEntries(privacyKeys.map((k) => [k, true])) as Privacy),
      blocks: [...blocks],
    };
  });
}
export async function savePrivacy(actor: string, input: unknown) {
  const v = z
    .object({
      show_semester: z.boolean(),
      show_bio: z.boolean(),
      show_skills: z.boolean(),
      show_interests: z.boolean(),
      show_projects: z.boolean(),
      show_listings: z.boolean(),
    })
    .parse(input);
  await withCertificateActor(actor, async (sql) => {
    await sql`insert into public.profile_privacy ${sql({ user_id: actor, ...v })} on conflict(user_id) do update set ${sql(v)}`;
  });
}
