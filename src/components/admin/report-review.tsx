"use client";
import { useActionState } from "react";
import { changeReport } from "@/app/admin/denuncias/actions";
import { Button } from "@/components/ui/button";
import { FormFeedback } from "@/components/profile/form-feedback";
export function ReportReview({ id }: { id: string }) {
  const [state, action, pending] = useActionState(changeReport, {});
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <label className="block text-sm font-medium">
        Tratamento
        <select
          name="status"
          className="mt-1 block w-full rounded-xl border border-border bg-white p-3"
        >
          <option value="reviewed">Analisada</option>
          <option value="dismissed">Dispensada</option>
          <option value="actioned">Resolvida após providências</option>
        </select>
      </label>
      <p className="text-sm">
        Registrar o resultado não suspende contas nem exclui conteúdo
        automaticamente. Para anúncios, abra “Consultar conteúdo denunciado” e
        use a desativação administrativa. Use a gestão de alunos se a análise
        exigir restrição institucional.
      </p>
      <FormFeedback state={state} />
      <Button disabled={pending}>
        {pending ? "Salvando…" : "Registrar tratamento"}
      </Button>
    </form>
  );
}
