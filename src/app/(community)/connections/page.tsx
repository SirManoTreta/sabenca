import Link from "next/link";
import { getConnections } from "@/services/connections";
import { ConnectionCard } from "@/components/connections/connection-card";
import { Button } from "@/components/ui/button";
import type { ConnectionDirection } from "@/types/connections";
export const metadata = { title: "Conexões" };
export default async function ConnectionsPage() {
  const result = await getConnections();
  const sections: {
    direction: ConnectionDirection;
    title: string;
    empty: string;
    help: string;
  }[] = [
    {
      direction: "incoming",
      title: "Solicitações recebidas",
      empty: "Nenhuma solicitação recebida.",
      help: "Quando alguém quiser se conectar, ela aparecerá aqui.",
    },
    {
      direction: "outgoing",
      title: "Solicitações enviadas",
      empty: "Nenhuma solicitação enviada.",
      help: "Encontre estudantes com quem você quer trocar ideias.",
    },
    {
      direction: "accepted",
      title: "Minhas conexões",
      empty: "Você ainda não possui conexões.",
      help: "Explore o Networks para encontrar estudantes.",
    },
  ];
  return (
    <div className="entrance space-y-10">
      <header>
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-primary">
          Gente e ideias por perto
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-[#063b73] sm:text-4xl">
          Conexões
        </h1>
        <p className="mt-3 text-muted-foreground">
          Gerencie seus contatos dentro da comunidade.
        </p>
      </header>
      {sections.map(({ direction, title, empty, help }) => (
        <section
          key={direction}
          aria-labelledby={`connections-${direction}`}
          className="space-y-4"
        >
          <h2
            id={`connections-${direction}`}
            className="text-xl font-bold text-[#063b73]"
          >
            {title}{" "}
            <span className="text-base font-medium text-muted-foreground">
              ({result[direction].total})
            </span>
          </h2>
          {result[direction].items.length ? (
            <div className="space-y-4">
              {result[direction].items.map((item) => (
                <ConnectionCard key={item.id} item={item} />
              ))}
              {result[direction].total > result[direction].items.length && (
                <p className="text-sm text-muted-foreground">
                  Exibindo {result[direction].items.length} de{" "}
                  {result[direction].total}. As demais aparecem conforme você
                  gerencia esta lista.
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border p-6 sm:p-8">
              <p className="font-semibold text-[#063b73]">{empty}</p>
              <p className="mt-2 text-sm text-muted-foreground">{help}</p>
              {direction === "accepted" && (
                <Button asChild className="mt-5">
                  <Link href="/networks">Explorar Networks</Link>
                </Button>
              )}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
