import { AuthForm } from "@/components/auth/auth-form";
import { institutionConfigured } from "@/lib/institution/config";
import { safeNext } from "@/lib/auth/redirect";
export const metadata = { title: "Entrar" };
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; message?: string }>;
}) {
  const params = await searchParams;
  const notices: Record<string, string> = {
    "password-updated": "Senha atualizada. Entre com seu RA e sua nova senha.",
    "invalid-link":
      "Este link expirou ou foi aberto em outro navegador. Inicie o primeiro acesso ou a recuperação novamente.",
  };
  return (
    <AuthForm
      mode="login"
      next={safeNext(params.next)}
      notice={notices[params.message ?? ""]}
      available={institutionConfigured()}
    />
  );
}
