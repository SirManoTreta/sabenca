"use server";
import { saveMarketplaceContact } from "@/services/marketplace-contact";
import { marketplaceContactSchema } from "@/lib/validations/marketplace-contact";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/services/session";
import {
  blockProfile,
  privacyKeys,
  reportContent,
  savePrivacy,
} from "@/services/moderation";
import type { ProfileActionState } from "@/types/profile";
export async function submitReport(
  _: ProfileActionState,
  form: FormData,
): Promise<ProfileActionState> {
  const { user } = await requireUser();
  try {
    await reportContent(user.id, Object.fromEntries(form));
  } catch {
    return {
      error:
        "Não foi possível registrar. Você pode denunciar cada conteúdo uma vez; há limite de 10 denúncias por hora.",
    };
  }
  return { success: "Denúncia enviada à administração." };
}
export async function changeBlock(
  _: ProfileActionState,
  form: FormData,
): Promise<ProfileActionState> {
  const { user } = await requireUser();
  const block = form.get("operation") !== "unblock";
  if (block && form.get("confirm") !== "yes")
    return { error: "Confirme o bloqueio." };
  try {
    await blockProfile(user.id, String(form.get("id")), block);
  } catch {
    return {
      error: "Não foi possível alterar o bloqueio. Atualize e tente novamente.",
    };
  }
  revalidatePath("/", "layout");
  if (block) redirect("/profile/privacidade?blocked=1");
  redirect("/profile/privacidade?unblocked=1");
}
export async function changePrivacy(
  _: ProfileActionState,
  form: FormData,
): Promise<ProfileActionState> {
  const { user } = await requireUser();
  try {
    await savePrivacy(
      user.id,
      Object.fromEntries(privacyKeys.map((k) => [k, form.get(k) === "on"])),
    );
  } catch {
    return { error: "Não foi possível salvar a privacidade." };
  }
  revalidatePath("/", "layout");
  return { success: "Privacidade salva." };
}
export async function changeMarketplaceContact(
  _: ProfileActionState,
  form: FormData,
): Promise<ProfileActionState> {
  const { user } = await requireUser();
  const input = marketplaceContactSchema.safeParse({
    url: form.get("url"),
    enabled: form.get("enabled") === "on",
  });
  if (!input.success) return { error: input.error.issues[0].message };
  try {
    await saveMarketplaceContact(user.id, input.data);
  } catch {
    return { error: "Não foi possível salvar o contato." };
  }
  revalidatePath("/profile/privacidade");
  revalidatePath("/marketplace", "layout");
  return { success: "Contato salvo." };
}
