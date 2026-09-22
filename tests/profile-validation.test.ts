import { describe, it, expect } from "vitest";
import { profileSchema, usernameSchema } from "@/lib/validations/profile";
import { projectSchema, projectLinkSchema } from "@/lib/validations/project";
import { MAX_IMAGE_BYTES, validateImage } from "@/lib/validations/image";

describe("profile validation", () => {
  it("normalizes username and equivalent labels", () => {
    expect(
      profileSchema.parse({
        username: "Samuel_123",
        bio: " Olá! ",
        skills: ["React", " react ", " REACT "],
        interests: ["Desenvolvimento   Web", "desenvolvimento web"],
      }),
    ).toEqual({
      username: "samuel_123",
      bio: "Olá!",
      skills: ["React"],
      interests: ["Desenvolvimento Web"],
    });
  });
  it.each([
    "sa",
    "a".repeat(31),
    "Samuel Silva",
    "samuel@",
    " samuel",
    "samuel ",
    "sámuel",
  ])("rejects invalid username %s", (name) => {
    expect(usernameSchema.safeParse(name).success).toBe(false);
  });
  it("enforces bio, label count and label length limits", () => {
    const valid = { username: "samuel", bio: "", skills: [], interests: [] };
    for (const override of [
      { bio: "a".repeat(501) },
      { skills: [" "] },
      { skills: ["a".repeat(61)] },
      { interests: ["a".repeat(81)] },
      { interests: Array.from({ length: 21 }, (_, i) => `Interesse ${i}`) },
    ])
      expect(profileSchema.safeParse({ ...valid, ...override }).success).toBe(
        false,
      );
  });
});
describe("project and upload validation", () => {
  it.each([
    "javascript:alert(1)",
    "data:text/html,hi",
    "ftp://host.com",
    "/relative",
    "https://user:password@example.com",
    "https://example.com/a b",
  ])("refuses unsafe URL %s", (url) =>
    expect(projectLinkSchema.safeParse(url).success).toBe(false),
  );
  it.each(["", "https://github.com/example/repo", "http://localhost:3000"])(
    "accepts optional or HTTP URL %s",
    (url) => expect(projectLinkSchema.safeParse(url).success).toBe(true),
  );
  it("requires title and description", () => {
    expect(
      projectSchema.safeParse({
        title: "ab",
        description: " ",
        project_url: "",
        repository_url: "",
      }).success,
    ).toBe(false);
  });
  it("rejects missing, oversized and spoofed files", async () => {
    expect(await validateImage(null)).toHaveProperty("error");
    expect(
      await validateImage(
        new File([new Uint8Array(MAX_IMAGE_BYTES + 1)], "a.png", {
          type: "image/png",
        }),
      ),
    ).toHaveProperty("error");
    expect(
      await validateImage(
        new File(["<script>attack</script>"], "a.png", { type: "image/png" }),
      ),
    ).toHaveProperty("error");
  });
  it.each([
    ["image/png", [137, 80, 78, 71, 13, 10, 26, 10]],
    ["image/jpeg", [255, 216, 255, 224]],
    ["image/webp", [82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80]],
  ] as const)("checks %s signature and MIME together", async (mime, bytes) => {
    expect(
      await validateImage(
        new File([new Uint8Array(bytes)], "file", { type: mime }),
      ),
    ).toHaveProperty("bytes");
    expect(
      await validateImage(
        new File([new Uint8Array(bytes)], "file.svg", {
          type: "image/svg+xml",
        }),
      ),
    ).toHaveProperty("error");
  });
});
