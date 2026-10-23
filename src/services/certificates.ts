import "server-only";
import type { TransactionSql } from "postgres";
import { database } from "@/lib/institution/database";
import { certificateSchema } from "@/lib/validations/certificate";
import { idSchema } from "@/lib/validations/project";
import { requireUser, requireAdmin } from "./session";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ListingCredential } from "@/types/marketplace";
export async function eligibleCertificates(actor: string) {
  return withCertificateActor(actor, async (sql) => [
    ...(await sql<
      ListingCredential[]
    >`select id,title,issuer,issue_date::text,expiration_date::text
      from public.profile_certificates c where user_id=${actor} and status='verified'
      and issue_date<=(now() at time zone 'America/Sao_Paulo')::date
      and (expiration_date is null or expiration_date>=(now() at time zone 'America/Sao_Paulo')::date)
      and (private.valid_https_url(verification_url) or exists(select 1 from storage.objects where bucket_id='certificates' and name=c.file_path))
      order by title,id`),
  ]);
}
export type Certificate = {
  id: string;
  title: string;
  issuer: string;
  issue_date: string;
  expiration_date: string | null;
  credential_id: string | null;
  verification_url: string | null;
  status: "pending" | "verified" | "rejected";
  rejection_reason: string | null;
  has_file: boolean;
  updated_at: string;
};
const columns =
  "id,title,issuer,issue_date::text,expiration_date::text,credential_id,verification_url,status,rejection_reason,exists(select 1 from storage.objects s where s.bucket_id='certificates' and s.name=file_path) as has_file,updated_at::text";
export async function withCertificateActor<T>(
  actor: string,
  task: (sql: TransactionSql) => Promise<T>,
) {
  idSchema.parse(actor);
  return (await database().begin(async (sql) => {
    await sql`select set_config('request.jwt.claim.sub',${actor},true)`;
    await sql`set local role authenticated`;
    return task(sql);
  })) as T;
}
export async function ownCertificates() {
  const { user } = await requireUser();
  return withCertificateActor(user.id, async (sql) => [
    ...(await sql.unsafe<Certificate[]>(
      `select ${columns} from public.profile_certificates where user_id=$1 order by created_at desc`,
      [user.id],
    )),
  ]);
}
export async function adminCertificates() {
  const { user } = await requireAdmin();
  return database().begin(async (sql) => {
    await sql`select set_config('request.jwt.claim.sub',${user.id},true)`;
    const [access] = await sql`select private.is_admin() as allowed`;
    if (!access?.allowed) throw new Error("Acesso administrativo revogado.");
    return [
      ...(await sql.unsafe<(Certificate & { owner_name: string })[]>(
        `select ${columns},(select name from public.profiles p where p.user_id=c.user_id) as owner_name from public.profile_certificates c order by (status='pending') desc,created_at limit 100`,
      )),
    ];
  });
}
export async function saveCertificate(
  actor: string,
  id: string,
  input: unknown,
  path: string | null | undefined,
) {
  idSchema.parse(id);
  const v = certificateSchema.parse(input);
  return withCertificateActor(actor, async (sql) => {
    const [existing] =
      await sql`select id,file_path from public.profile_certificates where id=${id} and user_id=${actor} for update`;
    const [access] = await sql`select private.is_member() as allowed`;
    if (!access?.allowed) throw new Error("Acesso indisponível.");
    const values = {
      title: v.title,
      issuer: v.issuer,
      issue_date: v.issue_date,
      expiration_date: v.expiration_date || null,
      credential_id: v.credential_id || null,
      verification_url: v.verification_url || null,
      file_path: path === undefined ? (existing?.file_path ?? null) : path,
    };
    if (existing)
      await sql`update public.profile_certificates set ${sql(values)} where id=${id} and user_id=${actor}`;
    else
      await sql`insert into public.profile_certificates ${sql({ ...values, id, user_id: actor })}`;
    await sql`reset role`;
    if (values.file_path)
      await sql`delete from private.certificate_file_cleanup where owner_id=${actor} and path=${values.file_path}`;
    if (existing?.file_path && existing.file_path !== values.file_path) {
      await sql`insert into private.certificate_file_cleanup(owner_id,path) values (${actor},${existing.file_path}) on conflict do nothing`;
    }
    return existing?.file_path as string | null | undefined;
  });
}
export async function queueCertificateCleanup(
  actor: string,
  path: string,
  uploading = false,
) {
  idSchema.parse(actor);
  if (!path.startsWith(`${actor}/`)) throw new Error("Documento inválido.");
  await database().begin(async (sql) => {
    await sql`select set_config('request.jwt.claim.sub',${actor},true)`;
    const [access] = await sql`select private.is_member() as allowed`;
    if (!access?.allowed) throw new Error("Acesso indisponível.");
    await sql`insert into private.certificate_file_cleanup(owner_id,path,not_before) values (${actor},${path},now()+${uploading ? 900 : 0}::integer*interval '1 second') on conflict(path) do update set not_before=excluded.not_before`;
  });
}
export async function retryCertificateCleanup(
  actor: string,
  client: SupabaseClient,
) {
  idSchema.parse(actor);
  return database().begin(async (sql) => {
    await sql`select set_config('request.jwt.claim.sub',${actor},true)`;
    const [access] = await sql`select private.is_member() as allowed`;
    if (!access?.allowed) throw new Error("Acesso indisponível.");
    const paths = await sql<
      { path: string }[]
    >`select q.path from private.certificate_file_cleanup q where q.owner_id=${actor} and q.not_before<=now()
      and not exists(select 1 from public.profile_certificates c where c.file_path=q.path) order by q.created_at limit 20 for update of q skip locked`;
    for (const { path } of paths) {
      const { error } = await client.storage
        .from("certificates")
        .remove([path]);
      if (error) continue;
      await sql`delete from private.certificate_file_cleanup where owner_id=${actor} and path=${path}`;
    }
    const [remaining] =
      await sql`select count(*)::integer as n from private.certificate_file_cleanup where owner_id=${actor}`;
    return remaining.n as number;
  });
}
export async function certificateFile(actor: string, id: string) {
  idSchema.parse(id);
  return withCertificateActor(actor, async (sql) => {
    const [row] =
      await sql`select file_path from public.profile_certificates where id=${id}`;
    if (!row) throw new Error("Documento indisponível.");
    return row.file_path as string | null;
  });
}
export async function deleteCertificate(
  actor: string,
  id: string,
  remove: (path: string) => Promise<void>,
) {
  idSchema.parse(id);
  await withCertificateActor(actor, async (sql) => {
    const [row] =
      await sql`select file_path from public.profile_certificates where id=${id} and user_id=${actor} for update`;
    if (!row) throw new Error("Documento indisponível.");
    if (row.file_path) await remove(row.file_path as string);
    await sql`delete from public.profile_certificates where id=${id} and user_id=${actor}`;
  });
}
export async function reviewCertificate(
  actor: string,
  id: string,
  status: "verified" | "rejected",
  reason: string,
  expectedVersion?: string,
) {
  idSchema.parse(id);
  if (
    !["verified", "rejected"].includes(status) ||
    reason.length > 1000 ||
    (status === "rejected" && !reason.trim())
  )
    throw new Error("Informe o motivo da rejeição.");
  await withCertificateActor(actor, async (sql) => {
    const [access] = await sql`select private.is_admin() as allowed`;
    if (!access?.allowed) throw new Error("Acesso administrativo revogado.");
    const rows =
      await sql`update public.profile_certificates set status=${status},rejection_reason=${status === "rejected" ? reason.trim() : null},verified_at=now(),verified_by=${actor} where id=${id} ${expectedVersion === undefined ? sql`` : sql`and updated_at::text=${expectedVersion}`} returning id`;
    if (!rows.length) throw new Error("Certificado indisponível.");
  });
}
