export type ProfileLabel = { id: string; name: string };
export type LabelKind = "skills" | "interests";
export type SocialProject = {
  id: string;
  title: string;
  description: string;
  image_url: string | null;
  project_url: string | null;
  repository_url: string | null;
};
export type SocialProfile = {
  id: string;
  username: string | null;
  name: string;
  bio: string | null;
  course: string | null;
  semester: number | null;
  institution: string | null;
  avatar_url: string | null;
  skills: ProfileLabel[];
  interests: ProfileLabel[];
  projects: SocialProject[];
};
export type ProfileActionState = {
  error?: string;
  success?: string;
  fields?: Record<string, string[] | undefined>;
};
