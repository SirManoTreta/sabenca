import { AuthForm } from "@/components/auth/auth-form";
import { institutionConfigured } from "@/lib/institution/config";
export const metadata = { title: "Administração" };
export default async function AdminLogin({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { message } = await searchParams;
  return (
    <AuthForm
      mode="admin"
      available={institutionConfigured()}
      notice={
        message === "password-updated"
          ? "Senha atualizada. Entre com seu e-mail e sua nova senha."
          : undefined
      }
    />
  );
}
