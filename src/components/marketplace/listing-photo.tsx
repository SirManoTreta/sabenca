"use client";
import { useState } from "react";
import { ShoppingBag } from "lucide-react";
export function ListingPhoto({
  src,
  title,
}: {
  src: string | null;
  title: string;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  return (
    <div className="grid aspect-[4/3] place-items-center overflow-hidden rounded-xl bg-secondary text-primary">
      {src && failed !== src ? (
        // Signed private URLs must not enter a shared image optimization cache.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={`Imagem de ${title}`}
          className="size-full object-contain"
          referrerPolicy="no-referrer"
          onError={() => setFailed(src)}
        />
      ) : (
        <ShoppingBag
          size={38}
          strokeWidth={1.2}
          aria-label="Anúncio sem imagem"
        />
      )}
    </div>
  );
}
