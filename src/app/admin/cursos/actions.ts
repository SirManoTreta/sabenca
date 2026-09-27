"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/services/session";
import { saveCourse } from "@/services/courses";
import { courseSchema } from "@/lib/validations/course";
import type { CourseState } from "@/types/course";

export async function updateCourse(
  _: CourseState,
  form: FormData,
): Promise<CourseState> {
  const { user } = await requireAdmin();
  const parsed = courseSchema.safeParse({
    id: form.get("id") || undefined,
    name: form.get("name"),
    status: form.get("status"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    await saveCourse(user.id, parsed.data);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "23505"
    )
      return {
        error:
          "Já existe um curso com esse nome na instituição, inclusive entre os inativos.",
      };
    return {
      error: "Não foi possível salvar o curso. Recarregue e tente novamente.",
    };
  }
  for (const path of [
    "/admin/cursos",
    "/admin/alunos",
    "/networks",
    "/profile",
    "/users/[username]",
  ])
    revalidatePath(path, "page");
  return { success: "Curso salvo." };
}
