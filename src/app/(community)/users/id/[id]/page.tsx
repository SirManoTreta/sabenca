import { notFound } from "next/navigation";
import { getProfile } from "@/services/profile";
import { getConnectionState } from "@/services/connections";
import { ProfileView } from "@/components/profile/profile-view";
export const metadata = { title: "Perfil da comunidade" };
export default async function ProfileByIdPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getProfile(undefined, id);
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
