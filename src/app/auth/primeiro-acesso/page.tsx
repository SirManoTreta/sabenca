import { AuthForm } from "@/components/auth/auth-form";
import { institutionConfigured } from "@/lib/institution/config";
export const metadata = { title: "Primeiro acesso" };
export default function FirstAccessPage() {
  return <AuthForm mode="first-access" available={institutionConfigured()} />;
}
