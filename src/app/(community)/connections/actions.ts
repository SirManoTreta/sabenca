"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/services/session";
import { idSchema } from "@/lib/validations/project";
import {
  ConnectionError,
  sendConnectionRequest,
  acceptConnectionRequest,
  rejectConnectionRequest,
  cancelConnectionRequest,
  removeConnection,
} from "@/services/connections";
import type { ConnectionActionState } from "@/types/connections";

function refreshConnections() {
  revalidatePath("/connections");
  revalidatePath("/networks");
  revalidatePath("/users/[username]", "page");
}
async function run(
  form: FormData,
  field: "target_profile_id" | "connection_id",
  operation: (id: string) => Promise<unknown>,
  success: string,
  failure: string,
): Promise<ConnectionActionState> {
  await requireUser();
  const parsed = idSchema.safeParse(form.get(field));
  if (!parsed.success)
    return {
      error: "Identificador inválido. Atualize a página e tente novamente.",
    };
  try {
    await operation(parsed.data);
  } catch (error) {
    // Also refresh after a race so the UI reflects the authoritative relation.
    refreshConnections();
    return {
      error: error instanceof ConnectionError ? error.message : failure,
    };
  }
  refreshConnections();
  return { success };
}
export async function sendRequest(
  _state: ConnectionActionState,
  form: FormData,
) {
  return run(
    form,
    "target_profile_id",
    sendConnectionRequest,
    "Solicitação enviada.",
    "Não foi possível enviar a solicitação.",
  );
}
export async function acceptRequest(
  _state: ConnectionActionState,
  form: FormData,
) {
  return run(
    form,
    "connection_id",
    acceptConnectionRequest,
    "Conexão aceita.",
    "Não foi possível aceitar a solicitação.",
  );
}
export async function rejectRequest(
  _state: ConnectionActionState,
  form: FormData,
) {
  return run(
    form,
    "connection_id",
    rejectConnectionRequest,
    "Solicitação recusada.",
    "Não foi possível recusar a solicitação.",
  );
}
export async function cancelRequest(
  _state: ConnectionActionState,
  form: FormData,
) {
  return run(
    form,
    "connection_id",
    cancelConnectionRequest,
    "Solicitação cancelada.",
    "Não foi possível cancelar a solicitação.",
  );
}
export async function removeAcceptedConnection(
  _state: ConnectionActionState,
  form: FormData,
) {
  return run(
    form,
    "connection_id",
    removeConnection,
    "Conexão removida.",
    "Não foi possível remover a conexão.",
  );
}
