"use client";

import { useActionState, useRef } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  sendRequest,
  acceptRequest,
  rejectRequest,
  cancelRequest,
  removeAcceptedConnection,
} from "@/app/(community)/connections/actions";
import type {
  ConnectionActionState,
  ConnectionState,
} from "@/types/connections";

export function ConnectionActions({
  state,
  targetProfileId,
  name,
  allowRemove = false,
}: {
  state: ConnectionState;
  targetProfileId: string;
  name: string;
  allowRemove?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const removeButton = useRef<HTMLButtonElement>(null);
  const [feedback, action, pending] = useActionState(
    async (_previous: ConnectionActionState, form: FormData) => {
      const intent = form.get("intent");
      const handler =
        intent === "send"
          ? sendRequest
          : intent === "accept"
            ? acceptRequest
            : intent === "reject"
              ? rejectRequest
              : intent === "cancel"
                ? cancelRequest
                : intent === "remove"
                  ? removeAcceptedConnection
                  : null;
      if (!handler) return { error: "Ação inválida." };
      const result = await handler({}, form);
      if (intent === "remove") dialog.current?.close();
      return result;
    },
    {},
  );
  if (state.kind === "self" || state.kind === "unavailable") return null;
  const fields = (
    <>
      <input type="hidden" name="target_profile_id" value={targetProfileId} />
      {"id" in state && (
        <input type="hidden" name="connection_id" value={state.id} />
      )}
    </>
  );
  return (
    <div className="min-w-0 space-y-3" aria-busy={pending}>
      <form action={action} className="flex flex-wrap items-center gap-2">
        {fields}
        {state.kind === "none" && (
          <Button name="intent" value="send" disabled={pending}>
            Conectar
          </Button>
        )}
        {state.kind === "outgoing" && (
          <>
            <span className="text-sm text-muted-foreground">
              Solicitação enviada
            </span>
            <Button
              variant="outline"
              name="intent"
              value="cancel"
              disabled={pending}
            >
              Cancelar
            </Button>
          </>
        )}
        {state.kind === "incoming" && (
          <>
            <Button name="intent" value="accept" disabled={pending}>
              Aceitar
            </Button>
            <Button
              variant="outline"
              name="intent"
              value="reject"
              disabled={pending}
            >
              Recusar
            </Button>
          </>
        )}
        {state.kind === "accepted" && (
          <>
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
              <Check size={16} aria-hidden="true" />
              Conectado
            </span>
            {allowRemove && (
              <Button
                ref={removeButton}
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => dialog.current?.showModal()}
              >
                Remover conexão
              </Button>
            )}
          </>
        )}
      </form>
      {pending && (
        <p role="status" className="text-sm text-muted-foreground">
          Aguarde…
        </p>
      )}
      {!pending && feedback.error && (
        <p role="alert" className="text-sm text-red-700">
          {feedback.error}
        </p>
      )}
      {!pending && feedback.success && (
        <p role="status" className="text-sm text-primary">
          {feedback.success}
        </p>
      )}
      {allowRemove && (
        <dialog
          ref={dialog}
          aria-label={`Remover conexão com ${name}?`}
          onClose={() => removeButton.current?.focus()}
          className="fixed inset-0 m-auto w-[calc(100%_-_2rem)] max-w-md rounded-2xl border border-border bg-white p-6 shadow-xl backdrop:bg-black/40"
        >
          <h2 className="break-words text-lg font-bold text-[#063b73]">
            Remover conexão com {name}?
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Vocês poderão enviar uma nova solicitação depois.
          </p>
          <form action={action} className="mt-6 flex flex-wrap gap-3">
            {fields}
            <Button
              type="button"
              variant="outline"
              autoFocus
              disabled={pending}
              onClick={() => dialog.current?.close()}
            >
              Cancelar
            </Button>
            <Button name="intent" value="remove" disabled={pending}>
              Remover
            </Button>
          </form>
        </dialog>
      )}
    </div>
  );
}
