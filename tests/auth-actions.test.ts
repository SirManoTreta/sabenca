import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  updateUser: vi.fn(),
  getUser: vi.fn(),
  signOut: vi.fn(),
  configured: vi.fn(() => true),
  studentByRa: vi.fn(),
  permitAttempt: vi.fn(),
  beginActivation: vi.fn(),
  activationFor: vi.fn(),
  activateStudent: vi.fn(),
  accessContext: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: mocks }),
}));
vi.mock("@/lib/supabase/config", () => ({
  supabaseConfigured: mocks.configured,
}));
vi.mock("@/lib/institution/config", () => ({
  institutionConfigured: mocks.configured,
  appOrigin: () => "http://localhost:3000",
}));
vi.mock("@/services/institution-auth", () => mocks);
vi.mock("@/services/session", () => ({ accessContext: mocks.accessContext }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error("REDIRECT:" + url);
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import {
  login,
  firstAccess,
  recoverPassword,
  setInitialPassword,
  updatePassword,
  logout,
  adminLogin,
} from "@/app/auth/actions";
const form = (data: Record<string, string>) => {
  const result = new FormData();
  for (const [key, value] of Object.entries(data)) result.set(key, value);
  return result;
};
const valid = { ra: "00123", password: "safe-password" };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.configured.mockReturnValue(true);
  mocks.permitAttempt.mockResolvedValue(true);
  mocks.signOut.mockResolvedValue({ error: null });
  mocks.accessContext.mockResolvedValue({ member: true, admin: false });
  mocks.studentByRa.mockResolvedValue({
    id: "student",
    auth_user_id: "user",
    status: "active",
    email: "private@example.test",
  });
});
describe("institutional server auth", () => {
  it.each(["pending", "blocked", "inactive"])(
    "refuses %s records with a generic error",
    async (status) => {
      mocks.studentByRa.mockResolvedValue({ status });
      expect(await login({}, form(valid))).toEqual({
        error: "RA ou senha inválidos.",
      });
      expect(mocks.signInWithPassword).not.toHaveBeenCalled();
    },
  );
  it("does not reveal RA existence or private email", async () => {
    mocks.studentByRa.mockResolvedValue(undefined);
    const result = await login({}, form(valid));
    expect(result).toEqual({ error: "RA ou senha inválidos." });
    expect(JSON.stringify(result)).not.toContain("@");
  });
  it("resolves RA internally and checks membership after Auth", async () => {
    mocks.signInWithPassword.mockResolvedValue({
      data: { user: { id: "user" } },
      error: null,
    });
    await expect(
      login({}, form({ ...valid, next: "https://evil.test" })),
    ).rejects.toThrow("REDIRECT:/marketplace");
    expect(mocks.signInWithPassword).toHaveBeenCalledWith({
      email: "private@example.test",
      password: "safe-password",
    });
  });
  it("rejects access revoked during sign-in", async () => {
    mocks.signInWithPassword.mockResolvedValue({
      data: { user: { id: "user" } },
      error: null,
    });
    mocks.accessContext.mockResolvedValue({ member: false, admin: false });
    expect(await login({}, form(valid))).toEqual({
      error: "RA ou senha inválidos.",
    });
    expect(mocks.signOut).toHaveBeenCalled();
  });
  it("enforces attempt limit before database lookup", async () => {
    mocks.permitAttempt.mockResolvedValue(false);
    await login({}, form(valid));
    expect(mocks.studentByRa).not.toHaveBeenCalled();
  });
  it("validates first access date without choosing a password or exposing email", async () => {
    const result = await firstAccess(
      {},
      form({ ra: "00123", birthDate: "14/05/2003" }),
    );
    expect(mocks.beginActivation).toHaveBeenCalledWith("00123", "2003-05-14");
    expect(result.success).toContain("Se os dados corresponderem");
    expect(JSON.stringify(result)).not.toContain("private@example.test");
  });
  it("does not send email on invalid first access form", async () => {
    expect(
      await firstAccess({}, form({ ra: "00123", birthDate: "31/02/2003" })),
    ).toHaveProperty("fields");
    expect(mocks.beginActivation).not.toHaveBeenCalled();
  });
  it("recovers by RA using the stored email only", async () => {
    mocks.resetPasswordForEmail.mockResolvedValue({ error: null });
    const result = await recoverPassword(
      {},
      form({ ra: "00123", email: "attacker@example.test" }),
    );
    expect(mocks.resetPasswordForEmail).toHaveBeenCalledWith(
      "private@example.test",
      {
        redirectTo:
          "http://localhost:3000/auth/callback?next=/auth/update-password",
      },
    );
    expect(result.success).toContain("Se o RA");
  });
  it("does not recover blocked students", async () => {
    mocks.studentByRa.mockResolvedValue({ status: "blocked" });
    await recoverPassword({}, form({ ra: "00123" }));
    expect(mocks.resetPasswordForEmail).not.toHaveBeenCalled();
  });
  it("requires email session and birth-date challenge before activation", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "user" } },
      error: null,
    });
    mocks.activationFor.mockResolvedValue(null);
    expect(
      await setInitialPassword(
        {},
        form({ password: "safe-password", confirmPassword: "safe-password" }),
      ),
    ).toHaveProperty("error");
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });
  it("sets password before activating membership", async () => {
    const user = { id: "user", email_confirmed_at: "now" };
    mocks.getUser.mockResolvedValue({ data: { user }, error: null });
    mocks.activationFor.mockResolvedValue({ id: "student" });
    mocks.updateUser.mockResolvedValue({ error: null });
    await expect(
      setInitialPassword(
        {},
        form({ password: "safe-password", confirmPassword: "safe-password" }),
      ),
    ).rejects.toThrow("REDIRECT:/marketplace");
    expect(mocks.updateUser.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.activateStudent.mock.invocationCallOrder[0],
    );
  });
  it("does not activate when setting the password fails", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "user" } },
      error: null,
    });
    mocks.activationFor.mockResolvedValue({ id: "student" });
    mocks.updateUser.mockResolvedValue({ error: new Error("failed") });
    expect(
      await setInitialPassword(
        {},
        form({ password: "safe-password", confirmPassword: "safe-password" }),
      ),
    ).toHaveProperty("error");
    expect(mocks.activateStudent).not.toHaveBeenCalled();
  });
  it("blocks password recovery for an unassociated Supabase account", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "user", email_confirmed_at: "now" } },
      error: null,
    });
    mocks.accessContext.mockResolvedValue({ member: false });
    await updatePassword(
      {},
      form({ password: "safe-password", confirmPassword: "safe-password" }),
    );
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });
  it("does not derive admin rights from login alone", async () => {
    mocks.signInWithPassword.mockResolvedValue({ error: null });
    expect(
      await adminLogin(
        {},
        form({ email: "student@example.test", password: "safe-password" }),
      ),
    ).toHaveProperty("error");
    expect(mocks.signOut).toHaveBeenCalled();
  });
  it.each([
    [{ member: true, admin: false }, "/auth/login"],
    [{ member: false, admin: true }, "/auth/admin"],
  ])(
    "lets authorized users change their own password: %j",
    async (access, path) => {
      mocks.getUser.mockResolvedValue({
        data: { user: { id: "user", email_confirmed_at: "now" } },
        error: null,
      });
      mocks.accessContext.mockResolvedValue(access);
      mocks.updateUser.mockResolvedValue({ error: null });
      await expect(
        updatePassword(
          {},
          form({ password: "safe-password", confirmPassword: "safe-password" }),
        ),
      ).rejects.toThrow(`REDIRECT:${path}?message=password-updated`);
      expect(mocks.updateUser).toHaveBeenCalledWith({
        password: "safe-password",
      });
      expect(mocks.signOut).toHaveBeenCalled();
    },
  );
  it("refuses an unconfirmed administrator password change", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "user" } },
      error: null,
    });
    mocks.accessContext.mockResolvedValue({ member: false, admin: true });
    await updatePassword(
      {},
      form({ password: "safe-password", confirmPassword: "safe-password" }),
    );
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });
  it("does not claim logout when Auth fails", async () => {
    mocks.signOut.mockResolvedValue({ error: new Error("network") });
    await expect(logout()).rejects.toThrow("Não foi possível encerrar");
  });
});
