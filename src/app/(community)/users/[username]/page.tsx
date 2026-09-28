import { notFound } from "next/navigation";
import { getProfile } from "@/services/profile";
import { ProfileView } from "@/components/profile/profile-view";
import { getConnectionState } from "@/services/connections";
export const metadata = { title: "Perfil da comunidade" };
export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const profile = await getProfile(username);
  if (!profile) notFound();
  const connection = await getConnectionState(profile.id);
  return (
    <ProfileView
      profile={profile}
      own={connection.kind === "self"}
      connection={connection}
    />
  );
}
