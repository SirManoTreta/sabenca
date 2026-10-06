import { beforeEach, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  save: vi.fn(),
  status: vi.fn(),
  add: vi.fn(),
  remove: vi.fn(),
  drop: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("@/services/session", () => ({ requireUser: mocks.user }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.refresh }));
vi.mock("@/services/marketplace", () => ({
  MarketplaceError: class extends Error {},
  saveListingData: mocks.save,
  changeListingStatus: mocks.status,
  addListingImage: mocks.add,
  removeListingImage: mocks.remove,
  deleteListingData: mocks.drop,
}));
import {
  saveListing,
  setListingStatus,
  deleteListing,
  uploadListingImage,
  deleteListingImage,
} from "@/app/(community)/marketplace/actions";
const id = "60000000-0000-4000-8000-000000000001";
function listing() {
  const f = new FormData();
  for (const [name, value] of Object.entries({
    title: "Livro de cálculo",
    description: "Livro em bom estado.",
    price: "45,50",
    category_id: id,
    condition: "used",
    seller_id: "forged",
    user_id: "forged",
  }))
    f.set(name, value);
  return f;
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.user.mockResolvedValue({ user: { id }, client: { storage: {} } });
  mocks.save.mockResolvedValue(id);
});
it("derives seller from authenticated identity, strips forged fields and revalidates profiles", async () => {
  expect((await saveListing({}, listing())).id).toBe(id);
  expect(mocks.save).toHaveBeenCalledExactlyOnceWith(
    id,
    {
      title: "Livro de cálculo",
      description: "Livro em bom estado.",
      price: "45.50",
      category_id: id,
      condition: "used",
    },
    undefined,
  );
  expect(mocks.refresh.mock.calls).toEqual([
    ["/marketplace", "layout"],
    ["/profile"],
    ["/users/[username]", "page"],
  ]);
});
it("validates all public action entry points before writes", async () => {
  for (const action of [
    saveListing,
    setListingStatus,
    deleteListing,
    uploadListingImage,
    deleteListingImage,
  ])
    expect((await action({}, new FormData())).error).toBeTruthy();
  expect(mocks.save).not.toHaveBeenCalled();
  expect(mocks.status).not.toHaveBeenCalled();
  expect(mocks.add).not.toHaveBeenCalled();
  expect(mocks.remove).not.toHaveBeenCalled();
  expect(mocks.drop).not.toHaveBeenCalled();
});
it("requires explicit deletion confirmation and validates allowed status", async () => {
  const f = new FormData();
  f.set("id", id);
  expect((await deleteListing({}, f)).error).toContain("Confirme");
  expect(mocks.drop).not.toHaveBeenCalled();
  f.set("status", "forged");
  expect((await setListingStatus({}, f)).error).toBeTruthy();
  f.set("status", "sold");
  expect((await setListingStatus({}, f)).success).toBeTruthy();
  expect(mocks.status).toHaveBeenCalledExactlyOnceWith(id, id, "sold");
});
it("does not expose database errors or internal details", async () => {
  mocks.save.mockRejectedValue(new Error("database password SQL stack trace"));
  expect(await saveListing({}, listing())).toEqual({
    error: "Não foi possível salvar o anúncio. Tente novamente.",
  });
});
