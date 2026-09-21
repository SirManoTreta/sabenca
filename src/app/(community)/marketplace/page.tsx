import { ModuleFoundation } from "@/components/layout/module-foundation";
import { requireUser } from "@/services/session";
export const metadata = { title: "Marketplace" };
export default async function MarketplacePage() {
  await requireUser();
  return (
    <ModuleFoundation
      title="Coisas boas circulam."
      description="Livros, materiais e serviços, de estudante para estudante."
      next="Em breve você poderá publicar anúncios e encontrar o que precisa para o próximo semestre."
    />
  );
}
