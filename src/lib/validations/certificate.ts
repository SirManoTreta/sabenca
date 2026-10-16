import { z } from "zod";
import { MAX_IMAGE_BYTES, validateImage } from "./image";
const optionalText = (max: number) => z.string().trim().max(max).default("");
const date = z.iso.date().refine((v) => v >= "1900-01-01", "Data inválida.");
export const certificateSchema = z
  .object({
    title: z.string().trim().min(3).max(160),
    issuer: z.string().trim().min(2).max(160),
    issue_date: date.refine(
      (v) => v <= new Date().toISOString().slice(0, 10),
      "Emissão não pode estar no futuro.",
    ),
    expiration_date: z.union([date, z.literal("")]).default(""),
    credential_id: optionalText(160),
    verification_url: z
      .string()
      .trim()
      .max(2048)
      .refine((value) => {
        if (!value) return true;
        try {
          const u = new URL(value);
          return (
            u.protocol === "https:" &&
            !!u.hostname &&
            !u.username &&
            !u.password &&
            !/\s/.test(value)
          );
        } catch {
          return false;
        }
      }, "Informe uma URL HTTPS válida, sem credenciais.")
      .default(""),
  })
  .refine((v) => !v.expiration_date || v.expiration_date >= v.issue_date, {
    message: "Validade anterior à emissão.",
    path: ["expiration_date"],
  });
export async function validateCertificateFile(
  value: FormDataEntryValue | null,
) {
  if (!(value instanceof File) || !value.size || value.size > MAX_IMAGE_BYTES)
    return { error: "Envie PDF, JPG ou PNG de até 4 MiB." };
  const extension = value.name.split(".").pop()?.toLowerCase();
  if (value.type === "application/pdf" && extension === "pdf") {
    const bytes = new Uint8Array(await value.arrayBuffer());
    if (
      new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-" &&
      new TextDecoder().decode(bytes.slice(-1024)).includes("%%EOF")
    )
      return { bytes, mime: "application/pdf", extension: "pdf" };
  } else if (
    (value.type === "image/jpeg" &&
      ["jpg", "jpeg"].includes(extension ?? "")) ||
    (value.type === "image/png" && extension === "png")
  ) {
    return validateImage(value);
  }
  return {
    error:
      "O conteúdo, o formato e a extensão do documento precisam corresponder (PDF, JPG ou PNG).",
  };
}
