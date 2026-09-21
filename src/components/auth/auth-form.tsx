"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
} from "lucide-react";
import {
  login,
  adminLogin,
  firstAccess,
  recoverPassword,
  updatePassword,
  setInitialPassword,
} from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AuthMode, AuthState } from "@/types/auth";
const content = {
  login: {
    title: "Acesse sua comunidade.",
    subtitle: "Entre com seu registro acadêmico e sua senha.",
    submit: "Entrar no SABENÇA",
    action: login,
  },
  admin: {
    title: "Acesso administrativo.",
    subtitle: "Área restrita à equipe autorizada da instituição.",
    submit: "Entrar na administração",
    action: adminLogin,
  },
  "first-access": {
    title: "Seu primeiro acesso.",
    subtitle:
      "Informe os dados cadastrados pela instituição para ativar seu acesso.",
    submit: "Validar e enviar link",
    action: firstAccess,
  },
  "forgot-password": {
    title: "Recupere seu acesso.",
    subtitle: "Vamos enviar um link ao e-mail cadastrado pela instituição.",
    submit: "Enviar link de recuperação",
    action: recoverPassword,
  },
  "update-password": {
    title: "Defina sua nova senha.",
    subtitle: "Escolha uma senha segura para continuar.",
    submit: "Salvar nova senha",
    action: updatePassword,
  },
  activate: {
    title: "Agora, sua própria senha.",
    subtitle:
      "E-mail confirmado. Falta só definir sua senha para ativar a conta.",
    submit: "Definir senha e ativar acesso",
    action: setInitialPassword,
  },
};
export function AuthForm({
  mode,
  next,
  notice,
  available = true,
}: {
  mode: AuthMode;
  next?: string;
  notice?: string;
  available?: boolean;
}) {
  const page = content[mode];
  const [state, action, pending] = useActionState<AuthState, FormData>(
    page.action,
    {},
  );
  const [visible, setVisible] = useState(false);
  const passwordOnly = mode === "activate" || mode === "update-password";
  const fields = [
    ...(!passwordOnly
      ? [
          {
            name: mode === "admin" ? "email" : "ra",
            label:
              mode === "admin"
                ? "E-mail administrativo"
                : "RA (registro acadêmico)",
            placeholder:
              mode === "admin" ? "seu.email@instituicao.br" : "Informe seu RA",
            type: mode === "admin" ? "email" : "text",
            autoComplete: "username",
            max: mode === "admin" ? 254 : 30,
          },
        ]
      : []),
    ...(mode === "first-access"
      ? [
          {
            name: "birthDate",
            label: "Data de nascimento",
            placeholder: "DD/MM/AAAA",
            type: "text",
            autoComplete: "bday",
            max: 10,
          },
        ]
      : []),
    ...(["login", "admin", "activate", "update-password"].includes(mode)
      ? [
          {
            name: "password",
            label: passwordOnly ? "Nova senha" : "Senha",
            placeholder: passwordOnly
              ? "Pelo menos 8 caracteres"
              : "Informe sua senha",
            type: visible ? "text" : "password",
            autoComplete: passwordOnly ? "new-password" : "current-password",
            max: 128,
          },
        ]
      : []),
    ...(passwordOnly
      ? [
          {
            name: "confirmPassword",
            label: "Confirme a nova senha",
            placeholder: "Repita sua senha",
            type: visible ? "text" : "password",
            autoComplete: "new-password",
            max: 128,
          },
        ]
      : []),
  ];
  return (
    <div className="entrance">
      <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[1.5px] text-primary">
        <LockKeyhole size={12} />
        Comunidade FATECE
      </div>
      <h1 className="text-[32px] font-bold leading-tight tracking-[-1px] text-[#063B73]">
        {page.title}
      </h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        {page.subtitle}
      </p>
      {(mode === "first-access" || mode === "activate") && (
        <ol
          aria-label="Etapas do primeiro acesso"
          className="mt-6 grid grid-cols-3 gap-2 text-[10px]"
        >
          <li className="border-t-2 border-primary pt-2">01 · Identificação</li>
          <li
            className={
              "border-t-2 pt-2 " +
              (state.success || mode === "activate"
                ? "border-primary"
                : "border-border text-muted-foreground")
            }
          >
            02 · E-mail
          </li>
          <li
            className={
              "border-t-2 pt-2 " +
              (mode === "activate"
                ? "border-primary"
                : "border-border text-muted-foreground")
            }
          >
            03 · Sua senha
          </li>
        </ol>
      )}
      {notice && (
        <p
          role="status"
          className="mt-5 rounded-xl bg-secondary p-4 text-sm leading-6"
        >
          {notice}
        </p>
      )}
      {!available && (
        <p
          role="status"
          className="mt-5 rounded-xl border border-border bg-secondary/50 p-4 text-sm leading-6"
        >
          O acesso institucional está em preparação. Procure a instituição para
          saber quando estará disponível.
        </p>
      )}
      {state.success ? (
        <div
          role="status"
          className="mt-7 rounded-xl border border-border bg-secondary p-5"
        >
          <CheckCircle2 className="mb-3 size-6 text-primary" />
          <p className="text-sm leading-6">{state.success}</p>
          <Link
            href="/auth/login"
            className="mt-4 inline-flex text-sm font-semibold text-primary underline underline-offset-4"
          >
            Voltar para o login
          </Link>
        </div>
      ) : (
        <form action={action} className="mt-7 space-y-5" noValidate>
          {next && <input type="hidden" name="next" value={next} />}
          {fields.map((field) => (
            <div key={field.name}>
              <label
                htmlFor={field.name}
                className="mb-2 block text-xs font-semibold"
              >
                {field.label}
              </label>
              <div className="relative">
                <Input
                  {...{
                    id: field.name,
                    name: field.name,
                    type: field.type,
                    placeholder: field.placeholder,
                    autoComplete: field.autoComplete,
                    maxLength: field.max,
                  }}
                  required
                  disabled={pending}
                  aria-invalid={Boolean(state.fields?.[field.name])}
                  aria-describedby={
                    state.fields?.[field.name]
                      ? field.name + "-error"
                      : undefined
                  }
                  className={field.name === "password" ? "pr-12" : ""}
                />
                {field.name === "password" && (
                  <button
                    type="button"
                    aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
                    aria-pressed={visible}
                    onClick={() => setVisible(!visible)}
                    className="absolute right-1 top-1 flex size-10 items-center justify-center rounded-lg text-muted-foreground focus-visible:outline-2"
                  >
                    {visible ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                )}
              </div>
              {state.fields?.[field.name] && (
                <p
                  id={field.name + "-error"}
                  className="mt-1.5 text-xs text-destructive"
                >
                  {state.fields[field.name]?.[0]}
                </p>
              )}
            </div>
          ))}
          {mode === "login" && (
            <div className="text-right">
              <Link
                href="/auth/forgot-password"
                className="text-xs font-semibold text-primary underline underline-offset-4"
              >
                Esqueci minha senha
              </Link>
            </div>
          )}
          {mode === "first-access" && (
            <p className="text-xs leading-5 text-muted-foreground">
              O e-mail é aquele informado à instituição. Se seus dados mudaram,
              solicite a atualização à secretaria.
            </p>
          )}
          {state.error && (
            <p
              role="alert"
              className="rounded-lg bg-red-50 p-3 text-sm text-destructive"
            >
              {state.error}
            </p>
          )}
          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={pending || !available}
          >
            {pending ? (
              <>
                <LoaderCircle className="animate-spin" />
                Aguarde...
              </>
            ) : (
              <>
                {page.submit}
                <ArrowRight />
              </>
            )}
          </Button>
        </form>
      )}
      <div className="mt-7 border-t border-border pt-6 text-center text-xs text-muted-foreground">
        {mode === "login" ? (
          <>
            Ainda não ativou seu acesso?{" "}
            <Link
              href="/auth/primeiro-acesso"
              className="font-bold text-primary"
            >
              Primeiro acesso
            </Link>
          </>
        ) : (
          <Link href="/auth/login" className="font-semibold text-primary">
            Voltar para o login
          </Link>
        )}
      </div>
    </div>
  );
}
