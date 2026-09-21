import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logout } from "@/app/auth/actions";
export const metadata = { title: "Acesso indisponível" };
export default function AccessDenied() {
  return (
    <>
      <ShieldAlert className="size-10 text-primary" />
      <h1 className="mt-5 text-3xl font-bold text-[#063b73]">
        Acesso indisponível.
      </h1>
      <p className="my-5 text-sm leading-7 text-muted-foreground">
        Sua conta não tem permissão para acessar esta área. Se ainda não ativou
        seu acesso, siga as orientações abaixo. Para bloqueios ou alterações
        cadastrais, procure a secretaria.
      </p>
      <Button asChild>
        <Link href="/auth/primeiro-acesso">Primeiro acesso</Link>
      </Button>
      <form action={logout} className="mt-4">
        <Button variant="outline">Sair da conta</Button>
      </form>
    </>
  );
}
