"use client";
import { useActionState } from "react";
import { reviewDocument } from "@/app/admin/certificados/actions";
import { Button } from "@/components/ui/button";
import { FormFeedback } from "@/components/profile/form-feedback";
export function CertificateReview({
  id,
  version,
  hasEvidence,
}: {
  id: string;
  version: string;
  hasEvidence: boolean;
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
          defaultValue={hasEvidence ? "verified" : "rejected"}
          className="mt-1 block w-full rounded-xl border border-border bg-white p-3"
        >
          <option value="verified" disabled={!hasEvidence}>
            Verificar documento
          </option>
          <option value="rejected">Rejeitar documento</option>
        </select>
      </label>
      {!hasEvidence && (
        <p className="text-sm">
          Aprovação exige arquivo enviado ou URL HTTPS de verificação válida.
          Consulte a evidência antes de aprovar.
        </p>
      )}
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
