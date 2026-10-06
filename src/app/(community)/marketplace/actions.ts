"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/services/session";
import {
  saveListingData,
  changeListingStatus,
  addListingImage,
  removeListingImage,
  deleteListingData,
  MarketplaceError,
} from "@/services/marketplace";
import { listingSchema, statusSchema } from "@/lib/validations/listing";
import { idSchema } from "@/lib/validations/project";
import { validateImage } from "@/lib/validations/image";
import type { MarketplaceState } from "@/types/marketplace";
function refresh() {
  revalidatePath("/marketplace", "layout");
  revalidatePath("/profile");
  revalidatePath("/users/[username]", "page");
}
function failure(error: unknown, fallback: string): MarketplaceState {
  return {
    error: error instanceof MarketplaceError ? error.message : fallback,
  };
}
export async function saveListing(
  _state: MarketplaceState,
  form: FormData,
): Promise<MarketplaceState> {
  const { user } = await requireUser();
  const input = listingSchema.safeParse(
    Object.fromEntries(
      ["title", "description", "price", "category_id", "condition"].map((k) => [
        k,
        form.get(k),
      ]),
    ),
  );
  if (!input.success)
    return {
      error: "Revise os campos indicados.",
      fields: z.flattenError(input.error).fieldErrors,
    };
  const id = form.get("id");
  if (id && !idSchema.safeParse(id).success)
    return { error: "Anúncio inválido." };
  try {
    const saved = await saveListingData(
      user.id,
      input.data,
      id ? String(id) : undefined,
    );
    refresh();
    return { id: saved, success: "Anúncio salvo." };
  } catch (error) {
    return failure(
      error,
      "Não foi possível salvar o anúncio. Tente novamente.",
    );
  }
}
export async function setListingStatus(
  _state: MarketplaceState,
  form: FormData,
): Promise<MarketplaceState> {
  const { user } = await requireUser();
  const id = idSchema.safeParse(form.get("id"));
  const status = statusSchema.safeParse(form.get("status"));
  if (!id.success || !status.success)
    return { error: "Anúncio ou status inválido." };
  try {
    await changeListingStatus(user.id, id.data, status.data);
    refresh();
    return { id: id.data, success: "Status atualizado." };
  } catch (error) {
    return failure(
      error,
      "Não foi possível alterar o status. Tente novamente.",
    );
  }
}
export async function uploadListingImage(
  _state: MarketplaceState,
  form: FormData,
): Promise<MarketplaceState> {
  const { user, client } = await requireUser();
  const id = idSchema.safeParse(form.get("id"));
  if (!id.success) return { error: "Anúncio inválido." };
  const image = await validateImage(form.get("image"));
  if (!("bytes" in image)) return { error: image.error };
  const path = `${user.id}/${id.data}/${crypto.randomUUID()}.${image.extension}`;
  let attempted = false;
  try {
    await addListingImage(user.id, id.data, path, async () => {
      attempted = true;
      const { error } = await client.storage
        .from("listing-images")
        .upload(path, image.bytes, { contentType: image.mime, upsert: false });
      if (error)
        throw new MarketplaceError(
          "Não foi possível enviar a imagem. Tente novamente.",
        );
    });
    refresh();
    return { id: id.data, success: "Imagem adicionada." };
  } catch (error) {
    if (attempted) {
      try {
        await client.storage.from("listing-images").remove([path]);
      } catch {
        /* Same rollback pattern as profile uploads; no client-supplied path. */
      }
    }
    return failure(
      error,
      "Não foi possível salvar a imagem. Atualize a página e tente novamente.",
    );
  }
}
export async function deleteListingImage(
  _state: MarketplaceState,
  form: FormData,
): Promise<MarketplaceState> {
  const { user, client } = await requireUser();
  const id = idSchema.safeParse(form.get("id"));
  const image = idSchema.safeParse(form.get("image_id"));
  if (!id.success || !image.success) return { error: "Imagem inválida." };
  try {
    await removeListingImage(user.id, id.data, image.data, async (paths) => {
      if (paths.some((p) => !p.startsWith(`${user.id}/${id.data}/`)))
        throw new MarketplaceError("Imagem inválida.");
      const { error } = await client.storage
        .from("listing-images")
        .remove(paths);
      if (error)
        throw new MarketplaceError(
          "Não foi possível remover a imagem. Tente novamente.",
        );
    });
    refresh();
    return { success: "Imagem removida." };
  } catch (error) {
    return failure(
      error,
      "Não foi possível remover a imagem. Atualize a página.",
    );
  }
}
export async function deleteListing(
  _state: MarketplaceState,
  form: FormData,
): Promise<MarketplaceState> {
  const { user, client } = await requireUser();
  const id = idSchema.safeParse(form.get("id"));
  if (!id.success || form.get("confirm") !== "on")
    return { error: "Confirme a exclusão do anúncio." };
  try {
    await deleteListingData(user.id, id.data, async (paths) => {
      if (paths.some((p) => !p.startsWith(`${user.id}/${id.data}/`)))
        throw new MarketplaceError("Imagem inválida.");
      // Include leftovers from any interrupted upload under this listing only.
      const folder = `${user.id}/${id.data}`;
      const { data, error: readError } = await client.storage
        .from("listing-images")
        .list(folder, { limit: 1000 });
      if (readError || data?.some((o) => !o.id))
        throw new MarketplaceError(
          "Não foi possível verificar as imagens. Tente novamente.",
        );
      const objects = [
        ...new Set([
          ...paths,
          ...(data ?? []).map((o) => `${folder}/${o.name}`),
        ]),
      ];
      if (objects.length) {
        const { error } = await client.storage
          .from("listing-images")
          .remove(objects);
        if (error)
          throw new MarketplaceError(
            "Não foi possível remover as imagens. O anúncio foi preservado.",
          );
      }
    });
    refresh();
    return { success: "Anúncio excluído." };
  } catch (error) {
    return failure(
      error,
      "Não foi possível excluir o anúncio. Tente novamente.",
    );
  }
}
