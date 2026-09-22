import { getProfile } from "@/services/profile";
import { ProfileView } from "@/components/profile/profile-view";
export const metadata = { title: "Meu perfil" };
export default async function ProfilePage() {
  const profile = await getProfile();
  if (!profile)
    return (
      <div className="rounded-2xl bg-secondary p-8">
        <h1 className="text-2xl font-bold text-primary">
          Seu perfil ainda não está disponível.
        </h1>
        <p className="mt-3 text-muted-foreground">
          Procure a instituição para verificar seu cadastro.
        </p>
      </div>
    );
  return <ProfileView profile={profile} own />;
}
