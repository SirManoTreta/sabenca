import { ModuleFoundation } from "@/components/layout/module-foundation";
import { requireUser } from "@/services/session";
export const metadata = { title: "Meu perfil" };
export default async function ProfilePage() {
  const { user } = await requireUser();
  const name =
    typeof user.user_metadata.name === "string"
      ? user.user_metadata.name
      : "estudante";
  return (
    <ModuleFoundation
      title={`Boas-vindas, ${name}.`}
      description="Seu acesso está confirmado. Este será o lugar para contar sua história, mostrar habilidades e compartilhar seus projetos."
      next="A edição do perfil é a próxima etapa de desenvolvimento, conforme o guia do projeto."
    />
  );
}
