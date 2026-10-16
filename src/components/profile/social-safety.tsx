"use client";
import { useActionState } from "react";
import {
  submitReport,
  changeBlock,
} from "@/app/(community)/profile/privacidade/actions";
import { Button } from "@/components/ui/button";
import { FormFeedback } from "./form-feedback";
export function ReportForm({
  type,
  id,
}: {
  type: "profile" | "listing";
  id: string;
}) {
  const [state, action, pending] = useActionState(submitReport, {});
  return (
    <details className="rounded-xl border border-border p-4">
      <summary className="cursor-pointer font-medium">
        {type === "profile" ? "Denunciar perfil" : "Denunciar anúncio"}
      </summary>
      <form action={action} className="mt-4 space-y-3">
        <input type="hidden" name="target_type" value={type} />
        <input type="hidden" name="target_id" value={id} />
        <label className="block text-sm font-medium">
          Motivo
          <select
            name="reason"
            className="mt-1 block w-full rounded-xl border border-border bg-white p-3"
          >
            <option value="harassment">Assédio ou comportamento abusivo</option>
            <option value="fraud">Suspeita de fraude</option>
            <option value="inappropriate">Conteúdo inadequado</option>
            <option value="privacy">Exposição de dados pessoais</option>
            <option value="other">Outro</option>
          </select>
        </label>
        <label className="block text-sm font-medium">
          Detalhes (opcional)
          <textarea
            name="details"
            maxLength={2000}
            className="mt-1 block w-full rounded-xl border border-border p-3"
          />
        </label>
        <FormFeedback state={state} />
        <Button disabled={pending}>
          {pending ? "Enviando…" : "Enviar denúncia"}
        </Button>
      </form>
    </details>
  );
}
export function BlockForm({
  id,
  unblock = false,
}: {
  id: string;
  unblock?: boolean;
}) {
  const [state, action, pending] = useActionState(changeBlock, {});
  return (
    <form
      action={action}
      className="space-y-3 rounded-xl border border-border p-4"
    >
      <input type="hidden" name="id" value={id} />
      <input
        type="hidden"
        name="operation"
        value={unblock ? "unblock" : "block"}
      />
      {!unblock && (
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="confirm" value="yes" required />
          Confirmo bloquear este usuário. Vocês deixam de se ver na comunidade e
          as conexões entre vocês serão removidas.
        </label>
      )}
      <FormFeedback state={state} />
      <Button variant="outline" disabled={pending}>
        {pending
          ? "Processando…"
          : unblock
            ? "Desbloquear usuário"
            : "Bloquear usuário"}
      </Button>
    </form>
  );
}
