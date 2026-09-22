export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp";

// Inspect the bytes as well as the declared MIME type; never trust the filename.
export async function validateImage(value: FormDataEntryValue | null) {
  if (!(value instanceof File) || !value.size)
    return { error: "Escolha uma imagem." };
  if (value.size > MAX_IMAGE_BYTES)
    return { error: "A imagem deve ter até 5 MiB." };
  const bytes = new Uint8Array(await value.arrayBuffer());
  const matches = (signature: number[], offset = 0) =>
    signature.every((byte, i) => bytes[offset + i] === byte);
  const format = matches([0xff, 0xd8, 0xff])
    ? { mime: "image/jpeg", extension: "jpg" }
    : matches([137, 80, 78, 71, 13, 10, 26, 10])
      ? { mime: "image/png", extension: "png" }
      : matches([82, 73, 70, 70]) && matches([87, 69, 66, 80], 8)
        ? { mime: "image/webp", extension: "webp" }
        : null;
  if (!format || value.type !== format.mime)
    return { error: "Envie uma imagem JPEG, PNG ou WEBP válida." };
  return { bytes, ...format };
}
