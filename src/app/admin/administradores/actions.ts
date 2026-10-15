"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/services/session";
import {
  inviteAdministrator,
  revokeAdministrator,
  AdministratorError,
} from "@/services/administrators";
import type { ProfileActionState } from "@/types/profile";

export async function manageAdministrator(
  _: ProfileActionState,
  form: FormData,
): Promise<ProfileActionState> {
  const { user } = await requireAdmin();
  try {
    if (form.get("operation") === "revoke") {
      if (form.get("confirm") !== "yes")
        return { error: "Confirme a revogação." };
      await revokeAdministrator(user.id, String(form.get("id")));
    } else {
      const success = await inviteAdministrator(
        form.get("email"),
        form.get("operation") === "resend",
      );
      revalidatePath("/admin/administradores");
      return { success };
    }
  } catch (error) {
    return {
      error:
        error instanceof AdministratorError
          ? error.message
          : "Não foi possível concluir. Confira o e-mail e tente novamente.",
    };
  }
  revalidatePath("/admin/administradores");
  return {
    success: "Acesso administrativo revogado. A conta Auth foi preservada.",
  };
}
