import { ModuleFoundation } from "@/components/layout/module-foundation";
import { requireUser } from "@/services/session";
export const metadata = { title: "Conexões" };
export default async function ConnectionsPage() {
  await requireUser();
  return (
    <ModuleFoundation
      title="Encontros que abrem caminhos."
      description="Um espaço para suas conexões e solicitações da comunidade."
      next="As solicitações de conexão estarão disponíveis após a criação dos perfis e do Networks."
    />
  );
}
