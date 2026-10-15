"use client";
import { useActionState } from "react";
import { manageAdministrator } from "@/app/admin/administradores/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormFeedback } from "@/components/profile/form-feedback";

export function AdministratorForm({
  id,
  resendEmail,
}: {
  id?: string;
  resendEmail?: string;
}) {
  const [state, action, pending] = useActionState(manageAdministrator, {});
  return (
    <form action={action} className="space-y-3">
      {resendEmail ? (
        <>
          <input name="email" type="hidden" value={resendEmail} />
          <input name="operation" type="hidden" value="resend" />
        </>
      ) : id ? (
        <>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="operation" value="revoke" />
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="confirm" value="yes" required />
            Confirmo revogar este acesso administrativo
          </label>
        </>
      ) : (
        <label className="block text-sm font-medium">
          E-mail do novo administrador
          <Input
            name="email"
            type="email"
            maxLength={254}
            required
            autoComplete="email"
          />
        </label>
      )}
      <FormFeedback state={state} />
      <Button
        disabled={pending}
        variant={id || resendEmail ? "outline" : "default"}
      >
        {pending
          ? "Processando…"
          : resendEmail
            ? "Reenviar convite"
            : id
              ? "Revogar acesso"
              : "Adicionar administrador"}
      </Button>
    </form>
  );
}
