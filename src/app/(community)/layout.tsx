import { requireUser } from "@/services/session";
import { logout } from "@/app/auth/actions";
import { Brand } from "@/components/layout/brand";
import { MemberNav } from "@/components/layout/member-nav";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
export const dynamic = "force-dynamic";
export default async function CommunityLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser();
  return (
    <div className="mx-auto max-w-7xl px-5 sm:px-10">
      <header className="border-b border-border py-5">
        <div className="flex items-center justify-between">
          <Brand />
          <span className="hidden text-xs text-muted-foreground sm:block">
            {process.env.NEXT_PUBLIC_INSTITUTION_NAME || "Comunidade FATECE"}
          </span>
          <form action={logout}>
            <Button variant="ghost" size="sm">
              <LogOut /> Sair
            </Button>
          </form>
        </div>
        <div className="mt-5">
          <MemberNav />
        </div>
      </header>
      <main id="main" className="py-12">
        {children}
      </main>
      <footer className="border-t border-border py-6 text-xs text-muted-foreground">
        Sabença · Novas conexões começam perto.
      </footer>
    </div>
  );
}
