"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/services/session";
import {
  saveCertificate,
  deleteCertificate,
  queueCertificateCleanup,
  retryCertificateCleanup,
} from "@/services/certificates";
import {
  certificateSchema,
  validateCertificateFile,
} from "@/lib/validations/certificate";
import { idSchema } from "@/lib/validations/project";
import type { ProfileActionState } from "@/types/profile";

export async function changeCertificate(
  _: ProfileActionState,
  form: FormData,
): Promise<ProfileActionState> {
  const { client, user } = await requireUser();
  const id = form.get("id") ? String(form.get("id")) : crypto.randomUUID();
  if (!idSchema.safeParse(id).success)
    return { error: "Certificado inválido." };
  const remove = async (path: string) => {
    if (!path.startsWith(`${user.id}/${id}/`))
      throw new Error("Documento inválido.");
    const { error } = await client.storage.from("certificates").remove([path]);
    if (error)
      throw new Error("Não foi possível remover o documento. Tente novamente.");
  };
  let uploaded: string | undefined;
  try {
    if (form.get("operation") === "cleanup") {
      const remaining = await retryCertificateCleanup(user.id, client);
      return remaining
        ? {
            error:
              "Storage ainda indisponível. A limpeza está registrada para nova tentativa.",
          }
        : { success: "Limpeza de documentos concluída." };
    }
    if (form.get("operation") === "delete") {
      if (form.get("confirm") !== "yes")
        return { error: "Confirme a exclusão." };
      await deleteCertificate(user.id, id, remove);
    } else {
      const input = Object.fromEntries(
        [
          "title",
          "issuer",
          "issue_date",
          "expiration_date",
          "credential_id",
          "verification_url",
        ].map((k) => [k, form.get(k) ?? ""]),
      );
      const parsed = certificateSchema.safeParse(input);
      if (!parsed.success) return { error: parsed.error.issues[0].message };
      const file = form.get("document");
      if (file instanceof File && file.size > 0) {
        const checked = await validateCertificateFile(file);
        if (!("bytes" in checked)) return { error: checked.error };
        uploaded = `${user.id}/${id}/${crypto.randomUUID()}.${checked.extension}`;
        await queueCertificateCleanup(user.id, uploaded, true);
        const { error } = await client.storage
          .from("certificates")
          .upload(uploaded, checked.bytes, {
            contentType: checked.mime,
            upsert: false,
          });
        if (error) {
          await queueCertificateCleanup(user.id, uploaded);
          await retryCertificateCleanup(user.id, client);
          return {
            error:
              "Não foi possível enviar o documento. Eventual limpeza foi registrada.",
          };
        }
      } else if (file && !(file instanceof File))
        return { error: "Documento inválido." };
      let previous: string | null | undefined;
      try {
        previous = await saveCertificate(
          user.id,
          id,
          parsed.data,
          uploaded ?? (form.get("remove_file") === "yes" ? null : undefined),
        );
      } catch (error) {
        if (uploaded) {
          await queueCertificateCleanup(user.id, uploaded);
          await retryCertificateCleanup(user.id, client);
        }
        throw error;
      }
      if (
        previous &&
        ((uploaded && previous !== uploaded) ||
          form.get("remove_file") === "yes")
      ) {
        const remaining = await retryCertificateCleanup(user.id, client);
        if (remaining)
          return {
            error:
              "Certificado salvo. A limpeza do documento anterior está registrada; use Tentar limpeza de documentos.",
          };
      }
    }
    revalidatePath("/profile", "layout");
    revalidatePath("/admin/certificados");
    return {
      success:
        form.get("operation") === "delete"
          ? "Certificado removido."
          : "Certificado salvo. Alterações serão analisadas pela administração.",
    };
  } catch (error) {
    console.warn("SABENCA_CERTIFICATE_ACTION_FAILED",{code:error&&typeof error==="object"&&"code" in error?String(error.code):"UNKNOWN"});
    return {
      error:
        "Não foi possível concluir. Recarregue a página e tente novamente.",
    };
  }
}
