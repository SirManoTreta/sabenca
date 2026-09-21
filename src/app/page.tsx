import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  GraduationCap,
  ShoppingBag,
  Users,
  Fingerprint,
  ShieldCheck,
  BookOpen,
  Code2,
  Handshake,
} from "lucide-react";
import { Brand } from "@/components/layout/brand";
import { Button } from "@/components/ui/button";
const pillars = [
  {
    icon: ShoppingBag,
    title: "Marketplace",
    description:
      "Livros, materiais e serviços. Encontre o que precisa com quem está perto.",
    href: "/marketplace",
    label: "Explorar marketplace",
    number: "01",
  },
  {
    icon: Users,
    title: "Networks",
    description:
      "Conheça estudantes por habilidades, cursos e interesses em comum.",
    href: "/networks",
    label: "Descobrir conexões",
    number: "02",
  },
  {
    icon: Fingerprint,
    title: "Seu perfil",
    description:
      "Compartilhe suas habilidades, projetos e o que você quer construir.",
    href: "/profile",
    label: "Acessar meu perfil",
    number: "03",
  },
];
export default function Home() {
  return (
    <div>
      <div className="border-b border-border bg-[#f3f5f7]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-2.5 text-[10px] text-muted-foreground lg:px-10">
          <span className="flex items-center gap-2">
            <GraduationCap size={14} />
            <strong className="font-semibold text-[#063b73]">
              Comunidade FATECE
            </strong>
          </span>
          <span>Conhecimento que conecta.</span>
        </div>
      </div>
      <header className="mx-auto flex h-24 max-w-7xl items-center justify-between gap-6 px-6 lg:px-10">
        <Brand />
        <nav
          aria-label="Navegação principal"
          className="hidden items-center gap-8 text-xs text-muted-foreground md:flex"
        >
          <Link href="/marketplace">Marketplace</Link>
          <Link href="/networks">Networks</Link>
          <a href="#sobre">Sobre o SABENÇA</a>
        </nav>
        <Button asChild size="sm">
          <Link href="/auth/login">
            Entrar
            <ArrowUpRight />
          </Link>
        </Button>
      </header>
      <main id="main">
        <section className="relative overflow-hidden border-y border-border bg-[#f6f9fc]">
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-6 py-14 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:px-10 lg:py-20">
            <div className="entrance">
              <span className="mb-6 inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[2px] text-primary">
                <span className="size-1.5 rounded-full bg-accent" />
                Sua comunidade universitária
              </span>
              <h1 className="text-[clamp(44px,5vw,66px)] font-bold leading-[1.08] tracking-[-2.5px] text-[#063b73]">
                Conheça. Troque.
                <br />
                <span className="text-[#0796d2]">Colabore.</span>
              </h1>
              <p className="mt-6 max-w-[410px] text-[15px] leading-7 text-muted-foreground">
                Encontre estudantes, habilidades, produtos e serviços dentro da
                sua própria comunidade acadêmica.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link href="/auth/login">
                    Acessar SABENÇA
                    <ArrowRight />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/auth/primeiro-acesso">Primeiro acesso</Link>
                </Button>
              </div>
              <p className="mt-7 flex items-center gap-2 text-[11px] text-muted-foreground">
                <ShieldCheck size={15} className="text-primary" />
                Acesso para estudantes autorizados pela FATECE.
              </p>
            </div>
            <div
              className="relative mx-auto h-[370px] w-full max-w-[485px] overflow-hidden rounded-[24px] bg-[#063b73] sm:h-[400px]"
              role="img"
              aria-label="Pessoas, conhecimento e projetos conectados na comunidade FATECE"
            >
              <div className="campus-orbit -right-22 -top-22 size-105 border-[45px] border-[#0796d2]/40" />
              <div className="campus-orbit -left-22 -bottom-24 size-85 border-[40px] border-[#0796d2]/35" />
              <span className="absolute left-7 top-6 text-[10px] font-semibold tracking-[2px] text-blue-100">
                POSSIBILIDADES QUE SE ENCONTRAM
              </span>
              <div className="absolute left-[8%] top-[23%] w-[66%] -rotate-3 rounded-2xl bg-white p-5 shadow-xl">
                <div className="flex items-center gap-3">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-secondary text-primary">
                    <Users size={23} />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-[#063b73]">
                      Perto de quem cria.
                    </p>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      Ideias encontram pessoas.
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <span className="rounded-full bg-secondary px-3 py-1.5 text-[10px] text-primary">
                    Tecnologia
                  </span>
                  <span className="rounded-full bg-[#fff2e7] px-3 py-1.5 text-[10px] text-[#a8500b]">
                    Design
                  </span>
                </div>
              </div>
              <div className="absolute right-[7%] top-[56%] flex w-[62%] rotate-3 items-center gap-3 rounded-2xl bg-[#0796d2] p-5 text-white shadow-lg">
                <BookOpen size={28} strokeWidth={1.5} />
                <div>
                  <p className="text-sm font-bold">Conhecimento circula.</p>
                  <p className="mt-1 text-[10px]">Uma troca. Novos caminhos.</p>
                </div>
              </div>
              <span className="absolute bottom-7 left-7 flex items-center gap-2 text-[11px] text-blue-100">
                <Handshake size={18} />O próximo passo começa junto.
              </span>
              <span className="absolute right-8 top-[38%] grid size-11 rotate-12 place-items-center rounded-xl bg-accent text-[#063b73]">
                <Code2 size={23} />
              </span>
            </div>
          </div>
        </section>
        <section id="sobre" className="mx-auto max-w-7xl px-6 py-13 lg:px-10">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-[2px] text-primary">
                Um campus, muitas possibilidades
              </span>
              <h2 className="mt-3 text-2xl font-bold tracking-tight text-[#063b73]">
                Mais conexões. Mais oportunidades.
              </h2>
            </div>
            <p className="max-w-70 text-xs leading-6 text-muted-foreground">
              Três espaços para compartilhar o que você sabe e descobrir o que
              vem a seguir.
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {pillars.map(
              ({ icon: Icon, title, description, href, label, number }) => (
                <Link
                  key={title}
                  href={href}
                  className="group rounded-2xl border border-border p-6 transition-colors hover:border-primary/40 hover:bg-secondary/40"
                >
                  <div className="mb-5 flex items-center justify-between">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-secondary text-primary">
                      <Icon size={21} />
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      / {number}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-[#063b73]">
                    {title}
                  </h3>
                  <p className="mt-2 text-[13px] leading-6 text-muted-foreground">
                    {description}
                  </p>
                  <span className="mt-6 flex items-center justify-between text-[11px] font-semibold text-primary">
                    {label}
                    <ArrowUpRight size={16} />
                  </span>
                </Link>
              ),
            )}
          </div>
        </section>
      </main>
      <footer className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 border-t border-border px-6 py-7 text-[11px] text-muted-foreground lg:px-10">
        <span>SABENÇA · Comunidade universitária FATECE</span>
        <Link href="/auth/admin" className="hover:text-primary">
          Acesso administrativo
        </Link>
      </footer>
    </div>
  );
}
