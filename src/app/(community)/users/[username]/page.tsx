import { notFound } from "next/navigation";
import { getProfile } from "@/services/profile";
import { ProfileView } from "@/components/profile/profile-view";
export const metadata = { title: "Perfil da comunidade" };
export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const profile = await getProfile(username);
  if (!profile) notFound();
  return <ProfileView profile={profile} />;
}
