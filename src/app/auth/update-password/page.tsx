import { AuthForm } from "@/components/auth/auth-form";
import { redirect } from "next/navigation";
import { requireIdentity, accessContext } from "@/services/session";
export const dynamic = "force-dynamic";
export const metadata = { title: "Nova senha" };
export default async function UpdatePasswordPage() {
  const { client } = await requireIdentity();
  const access = await accessContext(client);
  if (!access.member && !access.admin) redirect("/auth/acesso-negado");
  return <AuthForm mode="update-password" />;
}
