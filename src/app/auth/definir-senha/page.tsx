import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { requireIdentity } from "@/services/session";
import { activationFor } from "@/services/institution-auth";
import { institutionConfigured } from "@/lib/institution/config";
export const dynamic = "force-dynamic";
export const metadata = { title: "Ativar acesso" };
export default async function ActivatePage() {
  if (!institutionConfigured()) redirect("/auth/primeiro-acesso");
  const { user } = await requireIdentity();
  if (!(await activationFor(user)))
    redirect("/auth/login?message=invalid-link");
  return <AuthForm mode="activate" />;
}
