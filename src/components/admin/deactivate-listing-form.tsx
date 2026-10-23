"use client";
import { useActionState } from "react";
import { deactivateListingReport } from "@/app/admin/denuncias/actions";
import { Button } from "@/components/ui/button";
import { FormFeedback } from "@/components/profile/form-feedback";
export function DeactivateListingForm({ reportId }: { reportId: string }) {
  const [state, action, pending] = useActionState(deactivateListingReport, {});
  return (
    <form
      action={action}
      className="space-y-4 rounded-xl border border-border p-4"
    >
      <input type="hidden" name="id" value={reportId} />
      <p className="text-sm">
        A desativação remove o anúncio do Marketplace e impede republicação pelo
        vendedor. O conteúdo e a denúncia permanecem registrados.
      </p>
      <label className="flex items-start gap-3">
        <input type="checkbox" name="confirm" required className="mt-1" />
        Confirmo desativar administrativamente este anúncio
      </label>
      <Button type="submit" disabled={pending}>
        {pending ? "Desativando…" : "Desativar anúncio denunciado"}
      </Button>
      <FormFeedback state={state} />
    </form>
  );
}
