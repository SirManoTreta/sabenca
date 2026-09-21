"use client";
import { useActionState, useState } from "react";
import { changeStudentStatus } from "@/app/admin/alunos/actions";
import { Button } from "@/components/ui/button";
import type { StudentStatus } from "@/types/institution";
export function StatusControl({
  id,
  status,
}: {
  id: string;
  status: StudentStatus;
}) {
  const [state, action, pending] = useActionState<
    { error?: string; success?: string },
    FormData
  >(changeStudentStatus, {});
  const [editing, setEditing] = useState(false);
  return (
    <div>
      {!editing ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setEditing(true)}
        >
          Alterar acesso
        </Button>
      ) : (
        <form action={action} className="space-y-2">
          <input type="hidden" name="id" value={id} />
          <label className="block text-xs">
            Nova situação
            <select
              name="operation"
              className="ml-2 rounded border border-border p-2"
              defaultValue={
                status === "blocked" || status === "inactive"
                  ? "restore"
                  : "block"
              }
            >
              <option value="block">Bloquear</option>
              <option value="inactive">Desativar</option>
              <option value="restore">Restaurar acesso</option>
            </select>
          </label>
          <p className="text-xs text-muted-foreground">
            A alteração passa a valer nas próximas consultas.
          </p>
          <Button size="sm" disabled={pending}>
            Confirmar
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setEditing(false)}
          >
            Cancelar
          </Button>
        </form>
      )}
      {state.error && (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="mt-2 text-xs text-primary">
          {state.success}
        </p>
      )}
    </div>
  );
}
