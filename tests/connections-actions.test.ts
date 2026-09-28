import { beforeEach, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  send: vi.fn(),
  accept: vi.fn(),
  reject: vi.fn(),
  cancel: vi.fn(),
  remove: vi.fn(),
  revalidate: vi.fn(),
}));
vi.mock("@/services/session", () => ({ requireUser: mocks.requireUser }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/services/connections", () => ({
  ConnectionError: class extends Error {},
  sendConnectionRequest: mocks.send,
  acceptConnectionRequest: mocks.accept,
  rejectConnectionRequest: mocks.reject,
  cancelConnectionRequest: mocks.cancel,
  removeConnection: mocks.remove,
}));
import { ConnectionError } from "@/services/connections";
import {
  sendRequest,
  acceptRequest,
  rejectRequest,
  cancelRequest,
  removeAcceptedConnection,
} from "@/app/(community)/connections/actions";
const id = "40000000-0000-4000-8000-000000000001";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.requireUser.mockResolvedValue({ user: { id } });
});
it.each([
  sendRequest,
  acceptRequest,
  rejectRequest,
  cancelRequest,
  removeAcceptedConnection,
])("authenticates and validates before mutation", async (action) => {
  expect((await action({}, new FormData())).error).toContain("inválido");
  expect(mocks.requireUser).toHaveBeenCalledOnce();
  expect(mocks.send).not.toHaveBeenCalled();
  expect(mocks.accept).not.toHaveBeenCalled();
});
it.each([
  [sendRequest, "target_profile_id", "send"],
  [acceptRequest, "connection_id", "accept"],
  [rejectRequest, "connection_id", "reject"],
  [cancelRequest, "connection_id", "cancel"],
  [removeAcceptedConnection, "connection_id", "remove"],
] as const)(
  "revalidates shared pages and ignores forged identity fields",
  async (action, field, method) => {
    const form = new FormData();
    form.set(field, id);
    for (const key of ["requester_id", "receiver_id", "user_id", "status"])
      form.set(key, "forged");
    expect((await action({}, form)).success).toBeTruthy();
    expect(mocks[method]).toHaveBeenCalledExactlyOnceWith(id);
    expect(mocks.revalidate.mock.calls).toEqual([
      ["/connections"],
      ["/networks"],
      ["/users/[username]", "page"],
    ]);
  },
);
it("never exposes SQL details and refreshes stale state on conflict", async () => {
  const form = new FormData();
  form.set("target_profile_id", id);
  mocks.send.mockRejectedValueOnce(
    new Error("SQL policy constraint secret stack trace"),
  );
  expect(await sendRequest({}, form)).toEqual({
    error: "Não foi possível enviar a solicitação.",
  });
  mocks.send.mockRejectedValueOnce(
    new ConnectionError(
      "Já existe uma solicitação ou conexão com este estudante.",
    ),
  );
  expect((await sendRequest({}, form)).error).toContain("Já existe");
  expect(mocks.revalidate).toHaveBeenCalledTimes(6);
});
it("propagates authentication redirects before catching database failures", async () => {
  mocks.requireUser.mockRejectedValueOnce(new Error("NEXT_REDIRECT"));
  await expect(sendRequest({}, new FormData())).rejects.toThrow(
    "NEXT_REDIRECT",
  );
  expect(mocks.send).not.toHaveBeenCalled();
});
