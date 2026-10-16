"use client";
import { useActionState } from "react";
import { reviewDocument } from "@/app/admin/certificados/actions";
import { Button } from "@/components/ui/button";
import { FormFeedback } from "@/components/profile/form-feedback";
export function CertificateReview({
  id,
  version,
}: {
  id: string;
  version: string;
}) {
  const [state, action, pending] = useActionState(reviewDocument, {});
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="version" value={version} />
      <label className="block text-sm font-medium">
        Resultado da análise
        <select
          name="status"
          className="mt-1 block w-full rounded-xl border border-border bg-white p-3"
        >
          <option value="verified">Verificar documento</option>
          <option value="rejected">Rejeitar documento</option>
        </select>
      </label>
      <label className="block text-sm font-medium">
        Motivo da rejeição
        <textarea
          name="reason"
          maxLength={1000}
          className="mt-1 block w-full rounded-xl border border-border p-3"
        />
      </label>
      <FormFeedback state={state} />
      <Button disabled={pending}>
        {pending ? "Registrando…" : "Registrar análise"}
      </Button>
    </form>
  );
}
