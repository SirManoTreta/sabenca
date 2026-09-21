"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/services/session";
import { previewImport, confirmImport } from "@/services/institution-import";
import { MAX_FILE_BYTES } from "@/lib/institution/importer";
import { database } from "@/lib/institution/database";
import { INSTITUTION_ID } from "@/lib/institution/config";
import type { ImportState } from "@/types/institution";
export async function importStudents(
  _: ImportState,
  form: FormData,
): Promise<ImportState> {
  const { user } = await requireAdmin();
  const file = form.get("file");
  if (
    !(file instanceof File) ||
    file.size === 0 ||
    file.size > MAX_FILE_BYTES ||
    !file.name.toLowerCase().endsWith(".xlsx")
  )
    return { error: "Selecione uma planilha .xlsx de até 2 MiB." };
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const name = file.name.split(/[\\/]/).pop()!.slice(0, 180);
    if (form.get("intent") === "confirm") {
      if (form.get("confirm") !== "yes")
        return { error: "Confirme a importação das linhas válidas." };
      const count = await confirmImport(
        user.id,
        buffer,
        name,
        String(form.get("receipt") ?? ""),
      );
      revalidatePath("/admin/alunos");
      revalidatePath("/admin/alunos/importacoes");
      return {
        success: `${count} aluno(s) registrado(s) como pendente(s). Nenhum convite foi enviado automaticamente.`,
      };
    }
    return { preview: await previewImport(user.id, buffer, name) };
  } catch (error) {
    // Never forward Postgres errors: detail fields can contain CPF hashes and private data.
    const safe =
      error instanceof Error && !("code" in error) && !("query" in error);
    return {
      error: safe
        ? error.message
        : "Não foi possível importar. Analise novamente ou tente mais tarde.",
    };
  }
}
const statusSchema = z.object({
  id: z.uuid(),
  operation: z.enum(["block", "inactive", "restore"]),
});
export async function changeStudentStatus(
  _: { error?: string; success?: string },
  form: FormData,
) {
  const { user } = await requireAdmin();
  const parsed = statusSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Operação inválida." };
  try {
    const sql = database();
    await sql.begin(async (tx) => {
      if (
        !(
          await tx`select user_id from private.admin_users where user_id=${user.id} and institution_id=${INSTITUTION_ID} for share`
        ).length
      )
        throw new Error("unauthorized");
      const [student] =
        await tx`select id,status,activated_at,auth_user_id from private.institution_students where id=${parsed.data.id} and institution_id=${INSTITUTION_ID} for update`;
      if (!student) throw new Error("missing");
      const next =
        parsed.data.operation === "restore"
          ? student.activated_at && student.auth_user_id
            ? "active"
            : "pending"
          : parsed.data.operation === "block"
            ? "blocked"
            : "inactive";
      await tx`update private.institution_students set status=${next} where id=${student.id}`;
      await tx`delete from private.activation_challenges where student_id=${student.id}`;
      await tx`insert into private.access_events (student_id,changed_by,old_status,new_status) values (${student.id},${user.id},${student.status},${next})`;
    });
    revalidatePath("/admin/alunos");
    return { success: "Situação do acesso atualizada." };
  } catch {
    return {
      error: "Não foi possível alterar o acesso. Recarregue e tente novamente.",
    };
  }
}
