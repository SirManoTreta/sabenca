"use client";
import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import {
  deleteListing,
  deleteListingImage,
  setListingStatus,
  uploadListingImage,
} from "@/app/(community)/marketplace/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormFeedback } from "@/components/profile/form-feedback";
import { ListingPhoto } from "./listing-photo";
import {
  IMAGE_ACCEPT,
  MAX_IMAGE_BYTES,
  IMAGE_SIZE_ERROR,
} from "@/lib/validations/image";
import type { Listing, MarketplaceState } from "@/types/marketplace";
export function ListingStatusControls({ listing }: { listing: Listing }) {
  const [state, action, pending] = useActionState(setListingStatus, {});
  const choices =
    listing.status === "active"
      ? [
          ["sold", "Marcar como vendido"],
          ["inactive", "Desativar"],
        ]
      : [["active", "Reativar anúncio"]];
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={listing.id} />
      <fieldset disabled={pending} className="flex flex-wrap gap-3">
        {choices.map(([status, label]) => (
          <Button
            key={status}
            name="status"
            value={status}
            variant="outline"
            type="submit"
          >
            {pending ? "Atualizando..." : label}
          </Button>
        ))}
      </fieldset>
      <FormFeedback state={state} />
    </form>
  );
}
export function ListingDelete({ id }: { id: string }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [state, action, pending] = useActionState<MarketplaceState, FormData>(
    async (previous, form) => {
      const result = await deleteListing(previous, form);
      if (result.success) {
        router.push("/marketplace/meus-anuncios");
        router.refresh();
      }
      return result;
    },
    {},
  );
  return (
    <form action={action} className="rounded-2xl border border-border p-5">
      <input type="hidden" name="id" value={id} />
      <h2 className="font-bold text-[#063b73]">Excluir anúncio</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        O anúncio e suas imagens serão removidos.
      </p>
      <label className="my-4 flex items-start gap-3 text-sm">
        <input
          name="confirm"
          type="checkbox"
          checked={confirm}
          onChange={(e) => setConfirm(e.target.checked)}
          disabled={pending}
        />
        Confirmo a exclusão deste anúncio.
      </label>
      <Button type="submit" variant="outline" disabled={!confirm || pending}>
        {pending ? "Excluindo..." : "Excluir anúncio"}
      </Button>
      <FormFeedback state={state} />
    </form>
  );
}
function RemoveImage({
  listing,
  imageId,
}: {
  listing: Listing;
  imageId: string;
}) {
  const [state, action, pending] = useActionState(deleteListingImage, {});
  return (
    <form action={action}>
      <input type="hidden" name="id" value={listing.id} />
      <input type="hidden" name="image_id" value={imageId} />
      <Button
        type="submit"
        variant="outline"
        className="mt-3"
        disabled={pending}
      >
        {pending ? "Removendo..." : "Remover imagem"}
      </Button>
      <FormFeedback state={state} />
    </form>
  );
}
export function ListingImages({ listing }: { listing: Listing }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<MarketplaceState, FormData>(
    async (_previous, form) => {
      const files = form
        .getAll("images")
        .filter((f): f is File => f instanceof File && f.size > 0);
      if (!files.length) return { error: "Escolha uma imagem." };
      if (files.length + listing.images.length > 5)
        return { error: "Use até 5 imagens por anúncio." };
      if (files.some((f) => f.size > MAX_IMAGE_BYTES))
        return { error: IMAGE_SIZE_ERROR };
      for (const file of files) {
        const body = new FormData();
        body.set("id", listing.id);
        body.set("image", file);
        const result = await uploadListingImage({}, body);
        if (result.error) {
          router.refresh();
          return result;
        }
      }
      router.refresh();
      return { success: "Imagens adicionadas." };
    },
    {},
  );
  return (
    <section className="space-y-5">
      <h2 className="text-xl font-bold text-[#063b73]">Imagens do anúncio</h2>
      <p className="text-sm text-muted-foreground">
        A primeira imagem é a capa. Até 5 imagens, 4 MiB por arquivo.
      </p>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {listing.images.map((i) => (
          <div key={i.id}>
            <ListingPhoto src={i.url} title={listing.title} />
            <RemoveImage listing={listing} imageId={i.id} />
          </div>
        ))}
      </div>
      {listing.images.length < 5 && (
        <form action={action} className="space-y-3">
          <fieldset disabled={pending}>
            <label
              htmlFor="additional-images"
              className="mb-2 block font-semibold"
            >
              Adicionar imagens
            </label>
            <Input
              name="images"
              type="file"
              id="additional-images"
              accept={IMAGE_ACCEPT}
              multiple
            />
            <Button type="submit" className="mt-3">
              {pending ? "Enviando..." : "Enviar imagens"}
            </Button>
          </fieldset>
          <FormFeedback state={state} />
        </form>
      )}
    </section>
  );
}
