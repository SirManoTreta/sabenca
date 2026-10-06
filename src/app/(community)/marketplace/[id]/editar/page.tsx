import { notFound } from "next/navigation";
import { getListing, listingCategories } from "@/services/marketplace";
import { requireUser } from "@/services/session";
import { ListingForm } from "@/components/marketplace/listing-form";
import { ListingImages } from "@/components/marketplace/listing-management";
export const metadata = { title: "Editar anúncio" };
export default async function EditListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user } = await requireUser();
  const [listing, categories] = await Promise.all([
    getListing(id, true),
    listingCategories(user.id),
  ]);
  if (!listing) notFound();
  return (
    <div className="space-y-10">
      <h1 className="text-3xl font-bold text-[#063b73]">Editar anúncio</h1>
      <ListingForm categories={categories} listing={listing} />
      <ListingImages listing={listing} />
    </div>
  );
}
