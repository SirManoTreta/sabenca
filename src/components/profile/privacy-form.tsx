"use client";
import { useActionState } from "react";
import type { Privacy } from "@/services/moderation";
import { changePrivacy } from "@/app/(community)/profile/privacidade/actions";
import { Button } from "@/components/ui/button";
import { FormFeedback } from "./form-feedback";
const labels: Record<keyof Privacy, string> = {
  show_semester: "Semestre",
  show_bio: "Biografia",
  show_skills: "Habilidades e tecnologias",
  show_interests: "Interesses",
  show_projects: "Projetos e links de portfólio",
  show_listings: "Anúncios e serviços",
};
export function PrivacyForm({ settings }: { settings: Privacy }) {
  const [state, action, pending] = useActionState(changePrivacy, {});
  return (
    <form action={action} className="space-y-4">
      <fieldset disabled={pending} className="space-y-3">
        <legend className="mb-4 font-semibold">
          Informações visíveis para outros estudantes
        </legend>
        {(Object.keys(labels) as (keyof Privacy)[]).map((k) => (
          <label key={k} className="flex items-center gap-3">
            <input type="checkbox" name={k} defaultChecked={settings[k]} />
            {labels[k]}
          </label>
        ))}
      </fieldset>
      <p className="text-sm text-muted-foreground">
        Nome, curso e instituição continuam identificando seu vínculo acadêmico.
        Habilidades e interesses ocultos também deixam de participar dos filtros
        do Networks. Ocultar anúncios remove sua exposição no Marketplace. Você
        continua vendo seus próprios dados.
      </p>
      <FormFeedback state={state} />
      <Button disabled={pending}>
        {pending ? "Salvando…" : "Salvar privacidade"}
      </Button>
    </form>
  );
}
