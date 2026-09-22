import { beforeEach, describe, expect, it, vi } from "vitest";
const alice = "11111111-1111-4111-8111-111111111111";
const projectId = "22222222-2222-4222-8222-222222222222";
const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  ownProfileContext: vi.fn(),
  saveProfile: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
  calls: [] as { table: string; method: string; args: unknown[] }[],
  results: [] as { data: unknown; error: unknown }[],
}));
vi.mock("@/services/session", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/services/profile", () => ({
  ownProfileContext: mocks.ownProfileContext,
}));
vi.mock("@/services/profile-write", () => ({ saveProfile: mocks.saveProfile }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error("REDIRECT:" + url);
  },
}));
import {
  updateProfile,
  saveProject,
  deleteProject,
  uploadAvatar,
  searchProfileLabels,
} from "@/app/(community)/profile/actions";

const client = {
  from(table: string) {
    const result = () =>
      Promise.resolve(
        mocks.results.shift() ?? { data: { id: projectId }, error: null },
      );
    const chain: Record<string, unknown> = {
      then: (resolve: (value: unknown) => void) => result().then(resolve),
      maybeSingle: result,
      single: result,
    };
    for (const method of [
      "select",
      "eq",
      "is",
      "insert",
      "update",
      "delete",
      "ilike",
      "order",
      "limit",
    ])
      chain[method] = (...args: unknown[]) => {
        mocks.calls.push({ table, method, args });
        return chain;
      };
    return chain;
  },
  storage: { from: () => ({ upload: mocks.upload, remove: mocks.remove }) },
};
const form = (data: Record<string, string | string[]>) => {
  const result = new FormData();
  for (const [key, value] of Object.entries(data))
    for (const entry of Array.isArray(value) ? value : [value])
      result.append(key, entry);
  return result;
};
const validProfile = {
  username: "ALICE",
  bio: "Aprendendo React",
  skills: ["React"],
  interests: ["Jogos"],
};
const validProject = {
  title: "Meu projeto",
  description: "Conhecimento em prática",
  project_url: "https://example.com",
  repository_url: "",
};
const png = () =>
  new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], "photo.png", {
    type: "image/png",
  });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.calls.length = 0;
  mocks.results.length = 0;
  const session = {
    client,
    user: { id: alice },
    profile: { id: alice, username: "alice", avatar_url: `${alice}/old.png` },
  };
  mocks.requireUser.mockResolvedValue(session);
  mocks.ownProfileContext.mockResolvedValue(session);
  mocks.saveProfile.mockResolvedValue({ previousUsername: null });
  mocks.upload.mockResolvedValue({ error: null });
  mocks.remove.mockResolvedValue({ error: null });
});
describe("profile Server Actions", () => {
  it("uses the authenticated owner, ignores forged identity fields and validates input", async () => {
    expect(
      await updateProfile(
        {},
        form({
          ...validProfile,
          profile_id: projectId,
          name: "Forged",
          course: "Forged",
        }),
      ),
    ).toEqual({ success: "Perfil atualizado." });
    expect(mocks.saveProfile).toHaveBeenCalledWith(alice, {
      ...validProfile,
      username: "alice",
    });
    mocks.saveProfile.mockClear();
    expect(
      await updateProfile({}, form({ ...validProfile, username: "a@b" })),
    ).toHaveProperty("fields.username");
    expect(mocks.saveProfile).not.toHaveBeenCalled();
  });
  it("converts a uniqueness error into safe feedback", async () => {
    mocks.saveProfile.mockRejectedValue({
      code: "23505",
      constraint_name: "profiles_username_key",
      message: "secret PostgreSQL detail",
    });
    const result = await updateProfile({}, form(validProfile));
    expect(result.error).toContain("já está em uso");
    expect(JSON.stringify(result)).not.toContain("PostgreSQL");
  });
  it("blocks unauthenticated and blocked actors before mutation", async () => {
    for (const route of ["/auth/login", "/auth/acesso-negado"]) {
      mocks.requireUser.mockRejectedValue(new Error("REDIRECT:" + route));
      await expect(updateProfile({}, form(validProfile))).rejects.toThrow(
        route,
      );
    }
    expect(mocks.saveProfile).not.toHaveBeenCalled();
  });
  it("searches normalized catalog names with escaped wildcards", async () => {
    mocks.results.push({ data: [{ id: "label", name: "React" }], error: null });
    expect(await searchProfileLabels("skills", " REACT_ ")).toHaveProperty(
      "labels.0.name",
      "React",
    );
    expect(mocks.calls).toContainEqual({
      table: "skills",
      method: "ilike",
      args: ["normalized_name", "%react\\_%"],
    });
    expect(await searchProfileLabels("profiles", "test")).toHaveProperty(
      "error",
    );
  });
  it("uploads under the authenticated folder and stores the object path", async () => {
    const data = new FormData();
    data.set("avatar", png());
    data.set("user_id", projectId);
    expect(await uploadAvatar({}, data)).toHaveProperty("success");
    const path = mocks.upload.mock.calls[0][0];
    expect(path).toMatch(new RegExp(`^${alice}/.*\\.png$`));
    expect(mocks.calls).toContainEqual({
      table: "profiles",
      method: "update",
      args: [{ avatar_url: path }],
    });
    expect(mocks.remove).toHaveBeenCalledWith([`${alice}/old.png`]);
  });
  it("cleans up the new upload on a failed update without deleting the old photo", async () => {
    mocks.results.push({ data: null, error: { code: "denied" } });
    const data = new FormData();
    data.set("avatar", png());
    expect(await uploadAvatar({}, data)).toHaveProperty("error");
    expect(mocks.remove).toHaveBeenCalledExactlyOnceWith([
      mocks.upload.mock.calls[0][0],
    ]);
  });
  it("refuses an invalid avatar before Storage", async () => {
    const data = new FormData();
    data.set("avatar", new File(["fake"], "a.png", { type: "image/png" }));
    expect(await uploadAvatar({}, data)).toHaveProperty("error");
    expect(mocks.upload).not.toHaveBeenCalled();
  });
});
describe("project Server Actions", () => {
  it("preserves an existing image when the browser submits an empty file placeholder", async () => {
    mocks.results.push({ data: { id: projectId, image_url: `${alice}/old.png` }, error: null });
    const data = form({ ...validProject, id: projectId });
    data.set("image", new File([], "undefined", { type: "application/octet-stream" }));
    await expect(saveProject({}, data)).rejects.toThrow("REDIRECT:/profile");
    expect(mocks.calls.find((call) => call.method === "update")?.args[0]).toMatchObject({ image_url: `${alice}/old.png` });
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.remove).not.toHaveBeenCalled();
  });
  it("creates a project with the server-resolved profile and safe optional links", async () => {
    await expect(
      saveProject({}, form({ ...validProject, profile_id: projectId })),
    ).rejects.toThrow("REDIRECT:/profile");
    expect(
      mocks.calls.find((call) => call.method === "insert")?.args[0],
    ).toMatchObject({ profile_id: alice, repository_url: null });
  });
  it("validates URLs and required fields before mutation", async () => {
    expect(
      await saveProject(
        {},
        form({
          ...validProject,
          project_url: "javascript:alert(1)",
          title: "",
        }),
      ),
    ).toHaveProperty("fields");
    expect(mocks.calls).toHaveLength(0);
  });
  it("refuses another user's project before uploading or updating", async () => {
    mocks.results.push({ data: null, error: null });
    const data = form({ ...validProject, id: projectId });
    data.set("image", png());
    expect(await saveProject({}, data)).toHaveProperty("error");
    expect(mocks.calls).toContainEqual({
      table: "projects",
      method: "eq",
      args: ["profile_id", alice],
    });
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.calls.some((call) => call.method === "update")).toBe(false);
  });
  it("updates an owned project and removes the previous image only after saving", async () => {
    mocks.results.push({
      data: { id: projectId, image_url: `${alice}/old.png` },
      error: null,
    });
    await expect(
      saveProject(
        {},
        form({ ...validProject, id: projectId, remove_image: "on" }),
      ),
    ).rejects.toThrow("REDIRECT:/profile");
    expect(
      mocks.calls.find((call) => call.method === "update")?.args[0],
    ).toMatchObject({ image_url: null, title: validProject.title });
    expect(mocks.remove).toHaveBeenCalledWith([`${alice}/old.png`]);
  });
  it("rolls back a project image upload when insertion fails", async () => {
    mocks.results.push({
      data: null,
      error: { message: "private internal detail" },
    });
    const data = form(validProject);
    data.set("image", png());
    const result = await saveProject({}, data);
    expect(result).toHaveProperty("error");
    expect(result.error).not.toContain("private");
    expect(mocks.remove).toHaveBeenCalledWith([mocks.upload.mock.calls[0][0]]);
  });
  it("deletes only owned projects and cleans their image", async () => {
    mocks.results.push({
      data: { image_url: `${alice}/project.png` },
      error: null,
    });
    await expect(deleteProject({}, form({ id: projectId }))).rejects.toThrow(
      "REDIRECT:/profile",
    );
    expect(mocks.calls).toContainEqual({
      table: "projects",
      method: "eq",
      args: ["profile_id", alice],
    });
    expect(mocks.remove).toHaveBeenCalledWith([`${alice}/project.png`]);
    mocks.remove.mockClear();
    mocks.results.push({ data: null, error: null });
    expect(await deleteProject({}, form({ id: projectId }))).toHaveProperty(
      "error",
    );
    expect(mocks.remove).not.toHaveBeenCalled();
  });
});
