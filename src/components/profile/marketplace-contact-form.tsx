"use client";
import { useActionState } from "react";
import { changeMarketplaceContact } from "@/app/(community)/profile/privacidade/actions";
import type { MarketplaceContact } from "@/services/marketplace-contact";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormFeedback } from "./form-feedback";
export function MarketplaceContactForm({
  contact,
}: {
  contact: MarketplaceContact;
}) {
  const [state, action, pending] = useActionState(changeMarketplaceContact, {});
  return (
    <form action={action} className="space-y-4">
      <h2 className="text-xl font-bold">Forma de contato para Marketplace</h2>
      <p className="text-sm text-muted-foreground">
        Forneça voluntariamente um link HTTPS, como https://wa.me/5511999999999
        ou sua página de contato. Esse link será usado em seus anúncios. Nenhum
        dado institucional é preenchido automaticamente.
      </p>
      <fieldset disabled={pending} className="space-y-4">
        <label htmlFor="marketplace-contact" className="block font-medium">
          Link de contato
        </label>
        <Input
          id="marketplace-contact"
          name="url"
          type="url"
          maxLength={2048}
          defaultValue={contact.url ?? ""}
          placeholder="https://wa.me/5511999999999"
        />
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            name="enabled"
            defaultChecked={contact.enabled}
            className="mt-1"
          />
          Autorizo exibir este contato aos estudantes que podem ver meus
          anúncios.
        </label>
        <p className="text-sm text-muted-foreground">
          Desmarque para ocultar. Ocultar anúncios ou bloquear um usuário também
          impede o acesso ao contato pela plataforma.
        </p>
        <Button type="submit">
          {pending ? "Salvando…" : "Salvar contato"}
        </Button>
      </fieldset>
      <FormFeedback state={state} />
    </form>
  );
}
