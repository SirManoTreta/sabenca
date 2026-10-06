import Link from "next/link";
import { getMarketplace } from "@/services/marketplace";
import { marketplaceHref } from "@/lib/validations/listing";
import { ListingCard } from "./listing-card";
export async function ProfileListings({
  profileId,
  own,
}: {
  profileId: string;
  own: boolean;
}) {
  const result = await getMarketplace({ seller: profileId });
  return (
    <section className="space-y-5">
      <div className="flex flex-wrap justify-between gap-4">
        <h2 className="text-2xl font-bold text-[#063b73]">Anúncios</h2>
        <Link
          className="font-semibold text-primary"
          href={
            own
              ? "/marketplace/meus-anuncios"
              : marketplaceHref({ seller: profileId })
          }
        >
          {own ? "Gerenciar meus anúncios" : "Ver todos os anúncios"}
        </Link>
      </div>
      {result.listings.length ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {result.listings.slice(0, 3).map((l) => (
            <ListingCard key={l.id} listing={l} />
          ))}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
          Nenhum anúncio ativo publicado ainda.
        </p>
      )}
    </section>
  );
}
