import { ModuleFoundation } from "@/components/layout/module-foundation";
import { requireUser } from "@/services/session";
export const metadata = { title: "Networks" };
export default async function NetworksPage() {
  await requireUser();
  return (
    <ModuleFoundation
      title="Quem vai criar com você?"
      description="Descubra pessoas por curso, habilidades e interesses em comum."
      next="A descoberta de estudantes será liberada após a etapa de perfis. Seus próximos parceiros de projeto estarão aqui."
    />
  );
}
