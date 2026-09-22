import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const state = vi.hoisted(() => ({
  requireUser: vi.fn(),
  signed: vi.fn(),
  queries: [] as string[],
  filters: [] as unknown[],
  missing: false,
}));
vi.mock("@/services/session", () => ({ requireUser: state.requireUser }));
import { getProfile } from "@/services/profile";
const privateFields = {
  user_id: "auth-id",
  auth_user_id: "auth-id",
  email: "secret@example.test",
  phone: "5519999999999",
  birth_date: "2000-01-01",
  cpf_fingerprint: "sensitive-hash",
};
beforeEach(() => {
  vi.resetAllMocks();
  state.queries.length = 0;
  state.filters.length = 0;
  state.missing = false;
  state.signed.mockResolvedValue({
    data: { signedUrl: "https://storage.example/signed" },
    error: null,
  });
  const profile = {
    id: "profile-id",
    name: "Nome institucional",
    username: "alice",
    bio: null,
    course: "Computação",
    semester: 8,
    institution: "FATECE",
    avatar_url: "auth-id/image.png",
    ...privateFields,
  };
  const project = {
    id: "project-id",
    title: "Projeto",
    description: "Descrição",
    image_url: "auth-id/project.png",
    project_url: null,
    repository_url: null,
    ...privateFields,
  };
  const client = {
    from(table: string) {
      const result = () => ({
        data:
          table === "profiles"
            ? state.missing
              ? null
              : profile
            : table === "projects"
              ? [project]
              : [],
        error: null,
      });
      const chain = {
        select: (columns: string) => {
          state.queries.push(columns);
          return chain;
        },
        eq: (key: string, value: string) => {
          state.filters.push([key, value]);
          return chain;
        },
        order: () => chain,
        maybeSingle: async () => result(),
        then: (resolve: (value: unknown) => void) =>
          Promise.resolve(result()).then(resolve),
      };
      return chain;
    },
    storage: { from: () => ({ createSignedUrl: state.signed }) },
  };
  state.requireUser.mockResolvedValue({
    client,
    user: { id: "auth-id", user_metadata: { name: "Forged metadata" } },
  });
});
describe("profile reads and privacy", () => {
  it("loads own identity from profiles and only serializes social fields", async () => {
    const result = await getProfile();
    expect(result?.name).toBe("Nome institucional");
    expect(state.filters).toContainEqual(["user_id", "auth-id"]);
    for (const field of Object.keys(privateFields)) {
      expect(result).not.toHaveProperty(field);
      expect(result?.projects[0]).not.toHaveProperty(field);
    }
    expect(JSON.stringify(result)).not.toContain("secret@example");
    expect(
      state.queries.every(
        (columns) => !columns.includes("*") && !columns.includes("user_id"),
      ),
    ).toBe(true);
    expect(state.signed).toHaveBeenCalledWith("auth-id/image.png", 300);
  });
  it("allows an active member to view a normalized username", async () => {
    expect(await getProfile("ALICE")).toHaveProperty("username", "alice");
    expect(state.filters).toContainEqual(["username", "alice"]);
  });
  it("requires active membership before reads or signing", async () => {
    for (const route of ["/auth/login", "/auth/acesso-negado"]) {
      state.requireUser.mockRejectedValue(new Error("REDIRECT:" + route));
      await expect(getProfile("alice")).rejects.toThrow(route);
    }
    expect(state.queries).toHaveLength(0);
    expect(state.signed).not.toHaveBeenCalled();
  });
  it("returns a missing profile without generating image URLs", async () => {
    state.missing = true;
    expect(await getProfile("missing")).toBeNull();
    expect(state.signed).not.toHaveBeenCalled();
  });
  it("uses image fallback when signing fails", async () => {
    state.signed.mockResolvedValue({
      data: null,
      error: { message: "denied" },
    });
    const result = await getProfile();
    expect(result?.avatar_url).toBeNull();
    expect(result?.projects[0].image_url).toBeNull();
  });
});
