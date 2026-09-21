"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/config";
import { institutionConfigured, appOrigin } from "@/lib/institution/config";
import {
  loginSchema,
  adminLoginSchema,
  firstAccessSchema,
  recoverySchema,
  passwordSchema,
} from "@/lib/validations/auth";
import { safeNext } from "@/lib/auth/redirect";
import { accessContext } from "@/services/session";
import {
  studentByRa,
  permitAttempt,
  beginActivation,
  activationFor,
  activateStudent,
} from "@/services/institution-auth";
import type { AuthState } from "@/types/auth";
const unavailable = {
  error:
    "O acesso institucional está sendo preparado. Tente novamente em breve.",
};
const invalidLogin = { error: "RA ou senha inválidos." };
export async function login(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fields: parsed.error.flatten().fieldErrors };
  if (!institutionConfigured()) return unavailable;
  try {
    if (!(await permitAttempt("login", parsed.data.ra))) return invalidLogin;
    const student = await studentByRa(parsed.data.ra);
    if (!student || student.status !== "active" || !student.auth_user_id)
      return invalidLogin;
    const client = await createClient();
    const { data, error } = await client.auth.signInWithPassword({
      email: student.email,
      password: parsed.data.password,
    });
    if (error || data.user?.id !== student.auth_user_id) return invalidLogin;
    if (!(await accessContext(client)).member) {
      await client.auth.signOut();
      return invalidLogin;
    }
  } catch {
    return invalidLogin;
  }
  revalidatePath("/", "layout");
  redirect(safeNext(form.get("next")));
}
export async function adminLogin(
  _: AuthState,
  form: FormData,
): Promise<AuthState> {
  const parsed = adminLoginSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fields: parsed.error.flatten().fieldErrors };
  if (!institutionConfigured()) return unavailable;
  const invalid = { error: "Credenciais inválidas ou acesso não autorizado." };
  try {
    if (!(await permitAttempt("admin", parsed.data.email))) return invalid;
    const client = await createClient();
    const { error } = await client.auth.signInWithPassword(parsed.data);
    if (error) return invalid;
    if (!(await accessContext(client)).admin) {
      await client.auth.signOut();
      return invalid;
    }
  } catch {
    return invalid;
  }
  redirect("/admin/alunos");
}
export async function firstAccess(
  _: AuthState,
  form: FormData,
): Promise<AuthState> {
  const parsed = firstAccessSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fields: parsed.error.flatten().fieldErrors };
  if (!institutionConfigured()) return unavailable;
  try {
    if (await permitAttempt("activation", parsed.data.ra))
      await beginActivation(parsed.data.ra, parsed.data.birthDate!);
  } catch {
    console.warn("SABENCA_ACTIVATION_DELIVERY_FAILED");
  }
  return {
    success:
      "Se os dados corresponderem a um aluno autorizado, um link será enviado ao e-mail cadastrado pela instituição. Abra-o neste navegador em até 20 minutos. Se não receber, procure a secretaria.",
  };
}
export async function recoverPassword(
  _: AuthState,
  form: FormData,
): Promise<AuthState> {
  const parsed = recoverySchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fields: parsed.error.flatten().fieldErrors };
  if (!institutionConfigured()) return unavailable;
  try {
    if (await permitAttempt("recovery", parsed.data.ra)) {
      const student = await studentByRa(parsed.data.ra);
      if (student?.status === "active" && student.auth_user_id) {
        const client = await createClient();
        const { error } = await client.auth.resetPasswordForEmail(
          student.email,
          {
            redirectTo:
              appOrigin() + "/auth/callback?next=/auth/update-password",
          },
        );
        if (error) console.warn("SABENCA_RECOVERY_DELIVERY_FAILED");
      }
    }
  } catch {
    console.warn("SABENCA_RECOVERY_UNAVAILABLE");
  }
  return {
    success:
      "Se o RA estiver vinculado a uma conta ativa, enviaremos um link ao e-mail cadastrado. Abra-o neste navegador. Se precisar, procure a secretaria.",
  };
}
export async function setInitialPassword(
  _: AuthState,
  form: FormData,
): Promise<AuthState> {
  const parsed = passwordSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fields: parsed.error.flatten().fieldErrors };
  if (!institutionConfigured()) return unavailable;
  try {
    const client = await createClient();
    const {
      data: { user },
      error,
    } = await client.auth.getUser();
    if (error || !user || !(await activationFor(user)))
      return {
        error:
          "O primeiro acesso expirou ou não foi autorizado. Inicie novamente.",
      };
    const { error: passwordError } = await client.auth.updateUser({
      password: parsed.data.password,
    });
    if (passwordError)
      return {
        error:
          "Não foi possível salvar a senha. Use uma senha diferente e tente novamente.",
      };
    await activateStudent(user);
  } catch {
    return {
      error:
        "Não foi possível ativar seu acesso. Tente novamente ou procure a secretaria.",
    };
  }
  revalidatePath("/", "layout");
  redirect("/marketplace");
}
export async function updatePassword(
  _: AuthState,
  form: FormData,
): Promise<AuthState> {
  const parsed = passwordSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fields: parsed.error.flatten().fieldErrors };
  if (!institutionConfigured()) return unavailable;
  let loginPath = "/auth/login";
  try {
    const client = await createClient();
    const {
      data: { user },
      error,
    } = await client.auth.getUser();
    const access = await accessContext(client);
    if (
      error ||
      !user ||
      !user.email_confirmed_at ||
      user.is_anonymous ||
      (!access.member && !access.admin)
    )
      return {
        error:
          "Seu acesso expirou ou está indisponível. Solicite um novo link.",
      };
    if (access.admin) loginPath = "/auth/admin";
    const { error: passwordError } = await client.auth.updateUser({
      password: parsed.data.password,
    });
    if (passwordError)
      return {
        error:
          "Não foi possível atualizar. Use uma senha diferente e tente novamente.",
      };
    const { error: signOutError } = await client.auth.signOut();
    if (signOutError)
      return {
        success:
          "Senha atualizada. Encerre sua sessão antes de entrar novamente.",
      };
  } catch {
    return { error: "Não foi possível atualizar sua senha. Tente novamente." };
  }
  revalidatePath("/", "layout");
  redirect(`${loginPath}?message=password-updated`);
}
export async function logout() {
  if (supabaseConfigured()) {
    const client = await createClient();
    const { error } = await client.auth.signOut();
    if (error)
      throw new Error("Não foi possível encerrar a sessão. Tente novamente.");
  }
  revalidatePath("/", "layout");
  redirect("/auth/login");
}
