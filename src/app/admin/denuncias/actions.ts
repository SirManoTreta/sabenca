"use server";
import { requireAdmin } from "@/services/session";
import { reviewReport } from "@/services/moderation";
import { revalidatePath } from "next/cache";
import type { ProfileActionState } from "@/types/profile";
export async function changeReport(
  _: ProfileActionState,
  form: FormData,
): Promise<ProfileActionState> {
  const { user } = await requireAdmin();
  try {
    await reviewReport(
      user.id,
      String(form.get("id")),
      String(form.get("status")),
    );
  } catch {
    return { error: "Não foi possível registrar a análise." };
  }
  revalidatePath("/admin/denuncias");
  return { success: "Denúncia atualizada." };
}
