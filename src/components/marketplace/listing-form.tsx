"use client";
import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  saveListing,
  uploadListingImage,
  setListingStatus,
} from "@/app/(community)/marketplace/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldError, FormFeedback } from "@/components/profile/form-feedback";
import {
  IMAGE_ACCEPT,
  MAX_IMAGE_BYTES,
  IMAGE_SIZE_ERROR,
} from "@/lib/validations/image";
import { MAX_LISTING_IMAGES, conditionLabels } from "@/lib/validations/listing";
import type { Listing, Category, MarketplaceState } from "@/types/marketplace";
export function ListingForm({
  categories,
  listing,
}: {
  categories: Category[];
  listing?: Listing;
}) {
  const router = useRouter();
  const [category, setCategory] = useState(
    listing?.category.id ?? categories[0]?.id ?? "",
  );
  const [condition, setCondition] = useState(listing?.condition ?? "used");
  const service = categories.find((c) => c.id === category)?.is_service;
  const [state, action, pending] = useActionState<MarketplaceState, FormData>(
    async (_previous, form) => {
      const files = form
        .getAll("images")
        .filter((f): f is File => f instanceof File && f.size > 0);
      form.delete("images"); // Only one image travels in each upload action request.
      if (files.length > MAX_LISTING_IMAGES)
        return { error: "Use até 5 imagens por anúncio." };
      if (files.some((f) => f.size > MAX_IMAGE_BYTES))
        return { error: IMAGE_SIZE_ERROR };
      const saved = await saveListing({}, form);
      if (!saved.id || saved.error) return saved;
      for (const file of files) {
        const image = new FormData();
        image.set("id", saved.id);
        image.set("image", file);
        const result = await uploadListingImage({}, image);
        if (result.error)
          return {
            id: saved.id,
            error: `${result.error} Seu anúncio foi salvo como inativo; continue a edição.`,
          };
      }
      if (!listing) {
        const publish = new FormData();
        publish.set("id", saved.id);
        publish.set("status", "active");
        const result = await setListingStatus({}, publish);
        if (result.error) return { id: saved.id, error: result.error };
      }
      router.push(`/marketplace/${saved.id}`);
      router.refresh();
      return saved;
    },
    {},
  );
  const fieldClass =
    "w-full rounded-xl border border-border bg-white px-4 py-3 text-sm outline-primary";
  return (
    <form action={action} className="max-w-3xl space-y-6">
      {listing && <input type="hidden" name="id" value={listing.id} />}
      <fieldset
        disabled={pending || (!!state.id && !listing)}
        className="space-y-6 disabled:opacity-60"
      >
        <div>
          <label htmlFor="title" className="mb-2 block font-semibold">
            Título do anúncio
          </label>
          <Input
            name="title"
            id="title"
            defaultValue={listing?.title ?? ""}
            required
            minLength={3}
            maxLength={120}
            aria-invalid={!!state.fields?.title}
            aria-describedby="title-error"
          />
          <FieldError id="title-error" errors={state.fields?.title} />
        </div>
        <div>
          <label htmlFor="description" className="mb-2 block font-semibold">
            Descrição
          </label>
          <textarea
            id="description"
            name="description"
            defaultValue={listing?.description ?? ""}
            required
            maxLength={5000}
            rows={6}
            className={fieldClass}
            aria-invalid={!!state.fields?.description}
            aria-describedby="description-error"
          />
          <FieldError
            id="description-error"
            errors={state.fields?.description}
          />
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <label htmlFor="price" className="mb-2 block font-semibold">
              Preço (R$)
            </label>
            <Input
              name="price"
              id="price"
              inputMode="decimal"
              defaultValue={listing?.price.replace(".", ",") ?? ""}
              placeholder="45,00"
              required
              aria-invalid={!!state.fields?.price}
              aria-describedby="price-error"
            />
            <FieldError id="price-error" errors={state.fields?.price} />
          </div>
          <div>
            <label htmlFor="category_id" className="mb-2 block font-semibold">
              Categoria
            </label>
            <select
              id="category_id"
              name="category_id"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setCondition("used");
              }}
              required
              className={fieldClass}
              aria-describedby="category-error"
            >
              <option value="">Escolha uma categoria</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <FieldError
              id="category-error"
              errors={state.fields?.category_id}
            />
          </div>
        </div>
        {service ? (
          <input type="hidden" name="condition" value="not_applicable" />
        ) : (
          <div>
            <label htmlFor="condition" className="mb-2 block font-semibold">
              Condição
            </label>
            <select
              name="condition"
              id="condition"
              value={condition === "not_applicable" ? "used" : condition}
              onChange={(e) => setCondition(e.target.value as typeof condition)}
              className={fieldClass}
              aria-describedby="condition-error"
            >
              {(["new", "like_new", "used"] as const).map((c) => (
                <option key={c} value={c}>
                  {conditionLabels[c]}
                </option>
              ))}
            </select>
            <FieldError id="condition-error" errors={state.fields?.condition} />
          </div>
        )}
        {!listing && (
          <div>
            <label htmlFor="images" className="mb-2 block font-semibold">
              Imagens do anúncio (opcional)
            </label>
            <Input
              type="file"
              id="images"
              name="images"
              accept={IMAGE_ACCEPT}
              multiple
              aria-describedby="image-help"
            />
            <p id="image-help" className="mt-2 text-sm text-muted-foreground">
              Até 5 imagens JPEG, PNG ou WebP, com até 4 MiB cada. A primeira
              será a capa.
            </p>
          </div>
        )}
        <div className="flex flex-wrap gap-3">
          <Button type="submit">
            {pending
              ? "Salvando..."
              : listing
                ? "Salvar alterações"
                : "Publicar anúncio"}
          </Button>
          <Button asChild variant="outline">
            <Link
              href={listing ? `/marketplace/${listing.id}` : "/marketplace"}
            >
              Cancelar
            </Link>
          </Button>
        </div>
      </fieldset>
      <FormFeedback state={state} />
      {state.id && !listing && state.error && (
        <Link
          className="inline-block font-semibold text-primary underline"
          href={`/marketplace/${state.id}/editar`}
        >
          Continuar edição do anúncio
        </Link>
      )}
    </form>
  );
}
