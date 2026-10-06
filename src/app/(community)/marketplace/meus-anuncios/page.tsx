import { MarketplaceBrowse } from "@/components/marketplace/marketplace-browse";
import type { MarketplaceParams } from "@/types/marketplace";
export const metadata = { title: "Meus anúncios" };
export default async function MyListingsPage({
  searchParams,
}: {
  searchParams: Promise<MarketplaceParams>;
}) {
  return <MarketplaceBrowse params={await searchParams} mine />;
}
