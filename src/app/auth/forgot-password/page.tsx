import { AuthForm } from "@/components/auth/auth-form";
import { institutionConfigured } from "@/lib/institution/config";
export const metadata = { title: "Recuperar senha" };
export default function ForgotPasswordPage() {
  return (
    <AuthForm mode="forgot-password" available={institutionConfigured()} />
  );
}
