import Link from "next/link";
import { ListingPhoto } from "./listing-photo";
import {
  formatPrice,
  conditionLabels,
  statusLabels,
} from "@/lib/validations/listing";
import type { Listing, ListingSeller } from "@/types/marketplace";
export function sellerHref(seller: Pick<ListingSeller, "id" | "username">) {
  return seller.username
    ? `/users/${seller.username}`
    : `/users/id/${seller.id}`;
}
export function ListingCard({
  listing,
  mine = false,
}: {
  listing: Listing;
  mine?: boolean;
}) {
  return (
    <article className="min-w-0 overflow-hidden rounded-2xl border border-border bg-white p-4">
      <Link
        href={`/marketplace/${listing.id}`}
        aria-label={`Abrir anúncio ${listing.title}`}
      >
        <ListingPhoto
          src={listing.images[0]?.url ?? null}
          title={listing.title}
        />
      </Link>
      <div className="mt-4 space-y-3">
        <h2 className="break-words text-lg font-bold text-[#063b73]">
          <Link href={`/marketplace/${listing.id}`}>{listing.title}</Link>
        </h2>
        <p className="text-xl font-bold text-primary">
          {formatPrice(listing.price)}
        </p>
        <p className="text-sm text-muted-foreground">
          {listing.category.name}
          {listing.condition !== "not_applicable"
            ? ` · ${conditionLabels[listing.condition]}`
            : ""}
        </p>
        {mine && (
          <p className="text-sm font-semibold text-primary">
            {statusLabels[listing.status]}
          </p>
        )}
        <div className="border-t border-border pt-3 text-sm">
          <Link
            className="font-semibold text-primary"
            href={sellerHref(listing.seller)}
          >
            {listing.seller.name}
          </Link>
          <p className="mt-1 break-words text-muted-foreground">
            {listing.seller.course ?? "Curso não informado"}
          </p>
        </div>
        <time
          dateTime={listing.created_at}
          className="block text-xs text-muted-foreground"
        >
          {new Date(listing.created_at).toLocaleDateString("pt-BR", {
            timeZone: "America/Sao_Paulo",
          })}
        </time>
      </div>
    </article>
  );
}
