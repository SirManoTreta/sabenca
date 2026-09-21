import Link from "next/link";
import {
  ArrowLeft,
  GraduationCap,
  ShoppingBag,
  Users,
  Layers3,
  Handshake,
} from "lucide-react";
import { Brand } from "@/components/layout/brand";
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[.95fr_1.05fr]">
      <aside className="relative hidden overflow-hidden bg-[#063B73] px-12 py-10 text-white lg:flex lg:flex-col xl:px-20">
        <Brand light />
        <div className="relative z-10 my-auto py-20">
          <span className="text-[11px] font-semibold uppercase tracking-[2px] text-[#89d7f7]">
            Comunidade universitária
          </span>
          <h2 className="mt-5 text-5xl font-bold leading-[1.12] tracking-tight">
            O seu campus.
            <br />
            Novas possibilidades.
          </h2>
          <p className="mt-5 max-w-sm text-sm leading-7 text-blue-100">
            Um espaço para conhecer pessoas, trocar conhecimentos e construir
            algo juntos.
          </p>
          <div className="mt-12 grid max-w-sm grid-cols-2 gap-y-6">
            {[
              [ShoppingBag, "Marketplace"],
              [Users, "Networks"],
              [Layers3, "Projetos"],
              [Handshake, "Conexões"],
            ].map(([Icon, label]) => {
              const Component = Icon as typeof ShoppingBag;
              return (
                <span
                  key={String(label)}
                  className="flex items-center gap-3 text-sm"
                >
                  <Component size={18} className="text-[#89d7f7]" />
                  {String(label)}
                </span>
              );
            })}
          </div>
        </div>
        <div
          className="absolute -bottom-55 -right-55 size-140 rounded-full border-[70px] border-[#0796D2]/35"
          aria-hidden="true"
        />
        <div
          className="absolute bottom-35 right-15 size-9 rounded-lg bg-[#F7943D] rotate-12"
          aria-hidden="true"
        />
        <span className="relative z-10 flex items-center gap-3 text-xs text-blue-100">
          <GraduationCap size={22} />
          <span>
            <strong className="text-white">FATECE</strong>
            <br />
            Faculdade de Tecnologia, Ciência e Educação
          </span>
        </span>
      </aside>
      <div className="flex min-h-screen flex-col px-6 py-8 sm:px-12">
        <Link
          href="/"
          className="inline-flex w-fit items-center gap-2 text-xs text-muted-foreground"
        >
          <ArrowLeft size={15} />
          Voltar ao início
        </Link>
        <div className="mt-10 lg:hidden">
          <Brand />
        </div>
        <main id="main" className="mx-auto my-auto w-full max-w-[400px] py-12">
          {children}
        </main>
        <p className="text-center text-[11px] leading-5 text-muted-foreground">
          Acesso exclusivo para estudantes autorizados pela instituição.
          <br />
          Seus dados institucionais permanecem privados.
        </p>
      </div>
    </div>
  );
}
