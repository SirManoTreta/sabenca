import "server-only";
import { z } from "zod";
import { database } from "@/lib/institution/database";
import { INSTITUTION_ID } from "@/lib/institution/config";
import { idSchema } from "@/lib/validations/project";
export const studentAcademicsSchema = z.object({
  id: idSchema,
  course_id: z.preprocess((v) => (v === "" ? null : v), z.uuid().nullable()),
  semester: z.preprocess(
    (v) => (v === "" ? null : v),
    z.coerce.number().int().min(1).max(30).nullable(),
  ),
});
export async function updateStudentAcademics(actor: string, input: unknown) {
  idSchema.parse(actor);
  const value = studentAcademicsSchema.parse(input);
  await database().begin(async (sql) => {
    await sql`select set_config('request.jwt.claim.sub',${actor},true)`;
    await sql`select user_id from private.admin_users where user_id=${actor} and institution_id=${INSTITUTION_ID} for share`;
    const [access] = await sql`select private.is_admin() as allowed`;
    if (!access?.allowed) throw new Error("Acesso administrativo revogado.");
    const [student] =
      await sql`select id,course_id from private.institution_students where id=${value.id} and institution_id=${INSTITUTION_ID} for update`;
    if (!student) throw new Error("Aluno indisponível.");
    // Preserve resolved references, including students migrated from legacy course text.
    if (student.course_id && !value.course_id)
      throw new Error("Selecione um curso para manter o vínculo acadêmico.");
    if (value.course_id && value.course_id !== student.course_id) {
      const [course] =
        await sql`select id from public.courses where id=${value.course_id} and institution_id=${INSTITUTION_ID} and status='active' for share`;
      if (!course) throw new Error("Curso indisponível.");
    }
    // Existing students_sync_profile trigger propagates only institutional academic data.
    await sql`update private.institution_students set course_id=${value.course_id},semester=${value.semester} where id=${student.id}`;
  });
}
