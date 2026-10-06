import Link from "next/link";
import { notFound } from "next/navigation";
import { getListing } from "@/services/marketplace";
import { ownProfileContext } from "@/services/profile";
import { getConnectionState } from "@/services/connections";
import { ConnectionActions } from "@/components/connections/connection-actions";
import { ProfileImage } from "@/components/profile/profile-image";
import { ListingPhoto } from "@/components/marketplace/listing-photo";
import {
  ListingStatusControls,
  ListingDelete,
} from "@/components/marketplace/listing-management";
import { sellerHref } from "@/components/marketplace/listing-card";
import { Button } from "@/components/ui/button";
import {
  formatPrice,
  conditionLabels,
  statusLabels,
  marketplaceHref,
} from "@/lib/validations/listing";
export const metadata = { title: "Anúncio" };
export default async function ListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [listing, context] = await Promise.all([
    getListing(id),
    ownProfileContext(),
  ]);
  if (!listing) notFound();
  const own = listing.seller.id === context.profile.id;
  const connection = own
    ? undefined
    : await getConnectionState(listing.seller.id);
  return (
    <div className="entrance space-y-8">
      <Link href="/marketplace" className="text-sm font-semibold text-primary">
        Voltar ao Marketplace
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-primary">
            {listing.category.name}
          </p>
          <h1 className="mt-3 break-words text-3xl font-bold text-[#063b73]">
            {listing.title}
          </h1>
          <p className="mt-4 text-3xl font-bold text-primary">
            {formatPrice(listing.price)}
          </p>
        </div>
        <span className="rounded-full bg-secondary px-4 py-2 text-sm font-semibold text-primary">
          {listing.status === "active"
            ? "Disponível"
            : statusLabels[listing.status]}
        </span>
      </header>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {listing.images.length ? (
          listing.images.map((image) => (
            <ListingPhoto
              key={image.id}
              src={image.url}
              title={listing.title}
            />
          ))
        ) : (
          <ListingPhoto src={null} title={listing.title} />
        )}
      </div>
      <div className="grid gap-7 lg:grid-cols-[1.3fr_1fr]">
        <section className="rounded-2xl border border-border p-6">
          <h2 className="text-xl font-bold text-[#063b73]">Sobre o anúncio</h2>
          <p className="mt-5 whitespace-pre-wrap break-words leading-7 text-muted-foreground">
            {listing.description}
          </p>
          {listing.condition !== "not_applicable" && (
            <p className="mt-5 text-sm">
              Condição: {conditionLabels[listing.condition]}
            </p>
          )}
          <p className="mt-3 text-sm text-muted-foreground">
            Publicado em{" "}
            <time dateTime={listing.created_at}>
              {new Date(listing.created_at).toLocaleDateString("pt-BR", {
                timeZone: "America/Sao_Paulo",
              })}
            </time>
          </p>
        </section>
        <section className="space-y-4 rounded-2xl bg-secondary/60 p-6">
          <h2 className="text-xl font-bold text-[#063b73]">
            Vendido/oferecido por
          </h2>
          <div className="flex gap-4">
            <ProfileImage
              compact
              src={listing.seller.avatar_url}
              name={listing.seller.name}
            />
            <div className="min-w-0">
              <p className="break-words font-bold text-[#063b73]">
                {listing.seller.name}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {listing.seller.course ?? "Curso não informado"}
                {listing.seller.semester
                  ? ` · ${listing.seller.semester}º semestre`
                  : ""}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {listing.seller.institution}
              </p>
            </div>
          </div>
          <Button asChild>
            <Link href={sellerHref(listing.seller)}>Ver perfil</Link>
          </Button>
          <Link
            className="block text-sm font-semibold text-primary"
            href={marketplaceHref({ seller: listing.seller.id })}
          >
            Ver anúncios deste estudante
          </Link>
          {connection && (
            <ConnectionActions
              state={connection}
              targetProfileId={listing.seller.id}
              name={listing.seller.name}
            />
          )}
        </section>
      </div>
      {own && (
        <section className="space-y-6">
          <Button asChild variant="outline">
            <Link href={`/marketplace/${id}/editar`}>Editar anúncio</Link>
          </Button>
          <ListingStatusControls listing={listing} />
          <ListingDelete id={id} />
        </section>
      )}
    </div>
  );
}
