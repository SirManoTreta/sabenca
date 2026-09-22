import { notFound } from "next/navigation";
import { getProfile } from "@/services/profile";
import { ProfileForm } from "@/components/profile/profile-form";
import { AvatarUpload } from "@/components/profile/avatar-upload";
export const metadata = { title: "Editar perfil" };
export default async function EditProfilePage() {
  const profile = await getProfile();
  if (!profile) notFound();
  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <p className="mb-3 text-xs font-bold uppercase tracking-widest text-primary">
          Seu jeito de se apresentar
        </p>
        <h1 className="text-3xl font-bold text-[#063b73]">Editar perfil</h1>
        <p className="mt-3 text-muted-foreground">
          Compartilhe o que você sabe e o que desperta sua curiosidade.
        </p>
      </div>
      <div className="grid items-start gap-8 lg:grid-cols-[1fr_2fr]">
        <aside className="min-w-0 space-y-6">
          <AvatarUpload src={profile.avatar_url} name={profile.name} />
          <section className="space-y-3 rounded-2xl bg-secondary p-6 text-sm">
            <h2 className="font-bold text-[#063b73]">Dados da instituição</h2>
            <p className="break-words">{profile.name}</p>
            <p className="break-words text-muted-foreground">
              {profile.course || "Curso não informado"} ·{" "}
              {profile.semester
                ? `${profile.semester}º semestre`
                : "Semestre não informado"}
            </p>
            <p className="break-words text-muted-foreground">
              {profile.institution || "Instituição não informada"}
            </p>
            <p className="border-t border-border pt-3 text-xs leading-5 text-muted-foreground">
              Nome, curso e semestre são definidos pela instituição. Para
              corrigir esses dados, procure a secretaria.
            </p>
          </section>
        </aside>
        <div className="min-w-0 rounded-2xl border border-border p-6 sm:p-8">
          <ProfileForm
            profile={{
              username: profile.username,
              bio: profile.bio,
              skills: profile.skills,
              interests: profile.interests,
            }}
          />
        </div>
      </div>
    </div>
  );
}
