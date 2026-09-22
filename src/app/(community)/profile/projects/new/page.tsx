import { ownProfileContext } from "@/services/profile";
import { ProjectForm } from "@/components/profile/project-form";
export const metadata = { title: "Novo projeto" };
export default async function NewProjectPage() {
  await ownProfileContext();
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-[#063b73]">
          Uma ideia para compartilhar.
        </h1>
        <p className="mt-3 text-muted-foreground">
          Adicione um projeto acadêmico ou pessoal ao seu perfil.
        </p>
      </div>
      <ProjectForm />
    </div>
  );
}
