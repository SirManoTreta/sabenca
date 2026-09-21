import Link from "next/link";
import { Brand } from "@/components/layout/brand";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/services/session";
import { logout } from "@/app/auth/actions";
export const dynamic = "force-dynamic";
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();
  return (
    <div className="min-h-screen bg-[#f3f5f7]">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-6">
          <Brand />
          <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-primary">
            Administração · FATECE
          </span>
          <form action={logout}>
            <Button variant="outline" size="sm">
              Sair
            </Button>
          </form>
        </div>
        <nav
          aria-label="Administração"
          className="mx-auto flex max-w-7xl gap-6 overflow-x-auto px-6 pb-4 text-sm"
        >
          <Link href="/admin/alunos">Alunos cadastrados</Link>
          <Link href="/admin/alunos/importar">Importar planilha</Link>
          <Link href="/admin/alunos/importacoes">Histórico de importações</Link>
          <Link href="/auth/update-password">Alterar senha</Link>
        </nav>
      </header>
      <main id="main" className="mx-auto max-w-7xl px-6 py-10">
        {children}
      </main>
    </div>
  );
}
