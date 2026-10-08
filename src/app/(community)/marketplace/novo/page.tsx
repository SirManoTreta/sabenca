import { ListingForm } from "@/components/marketplace/listing-form";
import { listingCategories } from "@/services/marketplace";
import { requireUser } from "@/services/session";
export const metadata = { title: "Criar anúncio" };
export default async function NewListingPage() {
  const { user } = await requireUser();
  const categories = await listingCategories(user.id);
  return (
    <div className="space-y-7">
      <h1 className="text-3xl font-bold text-[#063b73]">Criar anúncio</h1>
      <p className="text-muted-foreground">
        Compartilhe produtos, serviços e conhecimento com outros estudantes.
      </p>
      <ListingForm categories={categories} />
    </div>
  );
}
