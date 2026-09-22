"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/services/session";
import { ownProfileContext } from "@/services/profile";
import { saveProfile } from "@/services/profile-write";
import {
  labelKindSchema,
  normalizeLabel,
  profileSchema,
} from "@/lib/validations/profile";
import { idSchema, projectSchema } from "@/lib/validations/project";
import { validateImage } from "@/lib/validations/image";
import type { ProfileActionState, ProfileLabel } from "@/types/profile";
import type { SupabaseClient } from "@supabase/supabase-js";

function refreshProfiles() {
  revalidatePath("/profile", "layout");
  revalidatePath("/users/[username]", "page");
}

export async function updateProfile(
  _state: ProfileActionState,
  form: FormData,
): Promise<ProfileActionState> {
  const { user } = await requireUser();
  const parsed = profileSchema.safeParse({
    username: form.get("username"),
    bio: form.get("bio"),
    skills: form.getAll("skills"),
    interests: form.getAll("interests"),
  });
  if (!parsed.success)
    return {
      error: "Revise os campos indicados.",
      fields: z.flattenError(parsed.error).fieldErrors,
    };
  try {
    await saveProfile(user.id, parsed.data);
  } catch (error) {
    if (
      typeof error === "object" &&
      error &&
      "code" in error &&
      error.code === "23505" &&
      "constraint_name" in error &&
      error.constraint_name === "profiles_username_key"
    ) {
      return {
        error: "Esse username já está em uso. Escolha outro.",
        fields: { username: ["Username em uso."] },
      };
    }
    return { error: "Não foi possível salvar o perfil. Tente novamente." };
  }
  refreshProfiles();
  return { success: "Perfil atualizado." };
}

export async function searchProfileLabels(
  kind: unknown,
  query: unknown,
): Promise<{ labels: ProfileLabel[]; error?: string }> {
  const { client } = await requireUser();
  const parsedKind = labelKindSchema.safeParse(kind);
  const parsedQuery = z.string().max(80).safeParse(query);
  if (!parsedKind.success || !parsedQuery.success)
    return { labels: [], error: "Busca inválida." };
  const term = normalizeLabel(parsedQuery.data)
    .toLowerCase()
    .replace(/[\\%_]/g, "\\$&");
  const { data, error } = await client
    .from(parsedKind.data)
    .select("id,name")
    .ilike("normalized_name", `%${term}%`)
    .order("name")
    .limit(20);
  return error
    ? { labels: [], error: "Não foi possível pesquisar. Tente novamente." }
    : { labels: data ?? [] };
}

// Object deletion is best effort only AFTER persistence, or when rolling back a
// newly uploaded file. No client-supplied path ever reaches Storage mutations.
async function removeImage(
  client: SupabaseClient,
  bucket: string,
  path: string | null,
  userId: string,
) {
  if (!path?.startsWith(`${userId}/`)) return;
  try {
    await client.storage.from(bucket).remove([path]);
  } catch {
    /* A later maintenance sweep may remove an orphan. */
  }
}

export async function uploadAvatar(
  _state: ProfileActionState,
  form: FormData,
): Promise<ProfileActionState> {
  const { client, user, profile } = await ownProfileContext();
  const image = await validateImage(form.get("avatar"));
  if (!("bytes" in image)) return { error: image.error };
  const path = `${user.id}/${crypto.randomUUID()}.${image.extension}`;
  const { error: uploadError } = await client.storage
    .from("avatars")
    .upload(path, image.bytes, { contentType: image.mime, upsert: false });
  if (uploadError)
    return { error: "Não foi possível enviar a foto. Tente novamente." };
  let query = client
    .from("profiles")
    .update({ avatar_url: path })
    .eq("id", profile.id)
    .eq("user_id", user.id);
  query = profile.avatar_url
    ? query.eq("avatar_url", profile.avatar_url)
    : query.is("avatar_url", null);
  const { data, error } = await query.select("id").maybeSingle();
  if (error || !data) {
    await removeImage(client, "avatars", path, user.id);
    return {
      error:
        "Não foi possível salvar a foto. Atualize a página e tente novamente.",
    };
  }
  await removeImage(client, "avatars", profile.avatar_url, user.id);
  refreshProfiles();
  return { success: "Foto de perfil atualizada." };
}

export async function saveProject(
  _state: ProfileActionState,
  form: FormData,
): Promise<ProfileActionState> {
  const { client, user, profile } = await ownProfileContext();
  const parsed = projectSchema.safeParse(
    Object.fromEntries(
      ["title", "description", "project_url", "repository_url"].map((name) => [
        name,
        form.get(name),
      ]),
    ),
  );
  if (!parsed.success)
    return {
      error: "Revise os campos indicados.",
      fields: z.flattenError(parsed.error).fieldErrors,
    };
  const inputId = form.get("id");
  if (inputId && !idSchema.safeParse(inputId).success)
    return { error: "Projeto inválido." };
  const id = inputId ? String(inputId) : crypto.randomUUID();
  let previousImage: string | null = null;
  if (inputId) {
    const { data, error } = await client
      .from("projects")
      .select("id,image_url")
      .eq("id", id)
      .eq("profile_id", profile.id)
      .maybeSingle();
    if (error || !data)
      return { error: "Projeto não encontrado ou sem permissão de edição." };
    previousImage = data.image_url;
  }
  const file = form.get("image");
  let uploaded: string | null = null;
  // React may serialize an unselected file input with a nonempty placeholder
  // filename. Its zero-byte payload means "keep the current optional image".
  if (file instanceof File && file.size > 0) {
    const image = await validateImage(file);
    if (!("bytes" in image)) return { error: image.error };
    uploaded = `${user.id}/${id}/${crypto.randomUUID()}.${image.extension}`;
    const { error } = await client.storage
      .from("project-images")
      .upload(uploaded, image.bytes, {
        contentType: image.mime,
        upsert: false,
      });
    if (error) return { error: "Não foi possível enviar a imagem do projeto." };
  } else if (file && !(file instanceof File)) {
    return { error: "Envie uma imagem JPEG, PNG ou WEBP válida." };
  }
  const imagePath =
    uploaded ?? (form.get("remove_image") === "on" ? null : previousImage);
  const values = {
    ...parsed.data,
    project_url: parsed.data.project_url || null,
    repository_url: parsed.data.repository_url || null,
    image_url: imagePath,
  };
  let mutation;
  if (inputId) {
    let query = client
      .from("projects")
      .update(values)
      .eq("id", id)
      .eq("profile_id", profile.id);
    query = previousImage
      ? query.eq("image_url", previousImage)
      : query.is("image_url", null);
    mutation = query.select("id").maybeSingle();
  } else {
    mutation = client
      .from("projects")
      .insert({ ...values, id, profile_id: profile.id })
      .select("id")
      .single();
  }
  const { data, error } = await mutation;
  if (error || !data) {
    await removeImage(client, "project-images", uploaded, user.id);
    return {
      error:
        "Não foi possível salvar o projeto. Atualize a página e tente novamente.",
    };
  }
  if (imagePath !== previousImage)
    await removeImage(client, "project-images", previousImage, user.id);
  refreshProfiles();
  redirect("/profile");
}

export async function deleteProject(
  _state: ProfileActionState,
  form: FormData,
): Promise<ProfileActionState> {
  const { client, user, profile } = await ownProfileContext();
  const parsed = idSchema.safeParse(form.get("id"));
  if (!parsed.success) return { error: "Projeto inválido." };
  const { data, error } = await client
    .from("projects")
    .delete()
    .eq("id", parsed.data)
    .eq("profile_id", profile.id)
    .select("image_url")
    .maybeSingle();
  if (error || !data)
    return {
      error:
        "Não foi possível excluir o projeto. Atualize a página e tente novamente.",
    };
  await removeImage(client, "project-images", data.image_url, user.id);
  refreshProfiles();
  redirect("/profile");
}
