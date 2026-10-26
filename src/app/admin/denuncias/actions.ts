"use server";
import { requireAdmin } from "@/services/session";
import { reviewReport, deactivateReportedListing } from "@/services/moderation";
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
export async function deactivateListingReport(
  _: ProfileActionState,
  form: FormData,
): Promise<ProfileActionState> {
  const { user } = await requireAdmin();
  if (form.get("confirm") !== "on")
    return { error: "Confirme a desativação administrativa." };
  try {
    await deactivateReportedListing(user.id, String(form.get("id")));
  } catch {
    return { error: "Não foi possível desativar o anúncio denunciado." };
  }
  revalidatePath("/admin/denuncias", "layout");
  revalidatePath("/marketplace", "layout");
  return { success: "Anúncio desativado. Denúncia registrada como actioned." };
}
