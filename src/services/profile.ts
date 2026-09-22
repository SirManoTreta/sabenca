import "server-only";
import { requireUser } from "@/services/session";
import { idSchema } from "@/lib/validations/project";
import { usernameSchema } from "@/lib/validations/profile";
import type {
  SocialProfile,
  SocialProject,
  ProfileLabel,
} from "@/types/profile";
import type { SupabaseClient } from "@supabase/supabase-js";

// Explicit selections keep Auth and private institutional fields out of the DTO.
export const PROFILE_COLUMNS =
  "id,username,name,bio,course,semester,institution,avatar_url";
export const PROJECT_COLUMNS =
  "id,title,description,image_url,project_url,repository_url";
export async function signedImage(
  client: SupabaseClient,
  bucket: "avatars" | "project-images",
  path: string | null,
) {
  if (!path) return null;
  const { data, error } = await client.storage
    .from(bucket)
    .createSignedUrl(path, 300);
  return error ? null : (data?.signedUrl ?? null);
}

export async function ownProfileContext() {
  const session = await requireUser();
  const { data, error } = await session.client
    .from("profiles")
    .select("id,username,avatar_url")
    .eq("user_id", session.user.id)
    .maybeSingle();
  if (error || !data)
    throw new Error("Não foi possível carregar seu perfil. Tente novamente.");
  return {
    ...session,
    profile: data as {
      id: string;
      username: string | null;
      avatar_url: string | null;
    },
  };
}

export async function getProfile(
  username?: string,
): Promise<SocialProfile | null> {
  const { client, user } = await requireUser();
  if (username !== undefined && !usernameSchema.safeParse(username).success)
    return null;
  const query = client.from("profiles").select(PROFILE_COLUMNS);
  const { data, error } = await (
    username === undefined
      ? query.eq("user_id", user.id)
      : query.eq("username", username.toLowerCase())
  ).maybeSingle();
  if (error)
    throw new Error("Não foi possível carregar o perfil. Tente novamente.");
  if (!data) return null;
  const profile = data as Omit<
    SocialProfile,
    "skills" | "interests" | "projects"
  >;
  const [skills, interests, projects, avatar] = await Promise.all([
    client
      .from("profile_skills")
      .select("skills(id,name)")
      .eq("profile_id", profile.id),
    client
      .from("profile_interests")
      .select("interests(id,name)")
      .eq("profile_id", profile.id),
    client
      .from("projects")
      .select(PROJECT_COLUMNS)
      .eq("profile_id", profile.id)
      .order("created_at", { ascending: false }),
    signedImage(client, "avatars", profile.avatar_url),
  ]);
  if (skills.error || interests.error || projects.error)
    throw new Error("Não foi possível carregar os detalhes do perfil.");
  const skillRows = skills.data as unknown as { skills: ProfileLabel | null }[];
  const interestRows = interests.data as unknown as {
    interests: ProfileLabel | null;
  }[];
  return {
    id: profile.id,
    username: profile.username,
    name: profile.name,
    bio: profile.bio,
    course: profile.course,
    semester: profile.semester,
    institution: profile.institution,
    avatar_url: avatar,
    skills: skillRows
      .flatMap((row) => (row.skills ? [row.skills] : []))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    interests: interestRows
      .flatMap((row) => (row.interests ? [row.interests] : []))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    projects: await Promise.all(
      (projects.data as SocialProject[]).map(async (project) => ({
        id: project.id,
        title: project.title,
        description: project.description,
        project_url: project.project_url,
        repository_url: project.repository_url,
        image_url: await signedImage(
          client,
          "project-images",
          project.image_url,
        ),
      })),
    ),
  };
}

export async function getOwnProject(id: string) {
  const { client, profile } = await ownProfileContext();
  if (!idSchema.safeParse(id).success) return null;
  const { data, error } = await client
    .from("projects")
    .select(PROJECT_COLUMNS)
    .eq("id", id)
    .eq("profile_id", profile.id)
    .maybeSingle();
  if (error) throw new Error("Não foi possível carregar o projeto.");
  if (!data) return null;
  const project = data as SocialProject;
  return {
    ...project,
    image_url: await signedImage(client, "project-images", project.image_url),
  };
}
