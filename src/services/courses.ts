import "server-only";
import { database } from "@/lib/institution/database";
import { INSTITUTION_ID } from "@/lib/institution/config";
import { courseSchema, type CourseInput } from "@/lib/validations/course";
import { idSchema } from "@/lib/validations/project";
import { requireAdmin } from "@/services/session";
import type { Course } from "@/types/course";

export async function listAdminCourses() {
  await requireAdmin();
  return database()<
    Course[]
  >`select id,name,normalized_name,status from public.courses
    where institution_id=${INSTITUTION_ID} order by name,id`;
}

// actor comes from requireAdmin(), never from form data. Recheck inside the transaction.
export async function saveCourse(actor: string, input: CourseInput) {
  idSchema.parse(actor);
  const value = courseSchema.parse(input);
  return database().begin(async (sql) => {
    await sql`select set_config('request.jwt.claim.sub', ${actor}, true)`;
    await sql`select user_id from private.admin_users where user_id=${actor}
      and institution_id=${INSTITUTION_ID} for share`;
    const [access] = await sql`select private.is_admin() as allowed`;
    if (!access?.allowed) throw new Error("Acesso administrativo revogado.");
    if (value.id) {
      const rows =
        await sql`update public.courses set name=${value.name},status=${value.status}
        where id=${value.id} and institution_id=${INSTITUTION_ID} returning id`;
      if (!rows.length) throw new Error("Curso não encontrado.");
      return rows[0].id as string;
    }
    const [row] =
      await sql`insert into public.courses (institution_id,name,status)
      values (${INSTITUTION_ID},${value.name},${value.status}) returning id`;
    return row.id as string;
  });
}
