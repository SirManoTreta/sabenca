"use server";
import { requireAdmin } from "@/services/session";
import { reviewCertificate } from "@/services/certificates";
import { revalidatePath } from "next/cache";
import type { ProfileActionState } from "@/types/profile";
export async function reviewDocument(
  _: ProfileActionState,
  form: FormData,
): Promise<ProfileActionState> {
  const { user } = await requireAdmin();
  try {
    await reviewCertificate(
      user.id,
      String(form.get("id")),
      String(form.get("status")) as "verified" | "rejected",
      String(form.get("reason") ?? ""),
      String(form.get("version") ?? ""),
    );
  } catch {
    return {
      error:
        "Não foi possível analisar. Recarregue para conferir a versão atual. Para rejeitar, informe um motivo de até 1.000 caracteres.",
    };
  }
  revalidatePath("/admin/certificados");
  revalidatePath("/profile", "layout");
  return { success: "Análise registrada." };
}
