import Link from "next/link";
import { listReports } from "@/services/moderation";
import { ReportReview } from "@/components/admin/report-review";
const reasons: Record<string, string> = {
  harassment: "Assédio",
  fraud: "Suspeita de fraude",
  inappropriate: "Conteúdo inadequado",
  privacy: "Privacidade",
  other: "Outro",
};
export const metadata = { title: "Denúncias" };
export default async function ReportsPage() {
  const items = await listReports();
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-primary">Denúncias</h1>
      <p>
        Até 100 registros, pendentes primeiro. A identidade de quem denuncia não
        é exibida à comunidade.
      </p>
      {!items.length && <p>Nenhuma denúncia recebida.</p>}
      <div className="grid gap-6 lg:grid-cols-2">
        {items.map((r) => (
          <article
            key={r.id}
            className="space-y-4 rounded-2xl border border-border bg-white p-6"
          >
            <h2 className="text-xl font-bold">
              {r.target_type === "profile" ? "Perfil" : "Anúncio"} ·{" "}
              {reasons[r.reason]}
            </h2>
            <p>Status: {r.status}</p>
            <p className="whitespace-pre-wrap break-words">
              {r.details ?? "Sem detalhes adicionais."}
            </p>
            <Link
              href={`/admin/denuncias/${r.id}`}
              className="block text-primary underline"
            >
              Consultar conteúdo denunciado
            </Link>
            <ReportReview id={r.id} />
          </article>
        ))}
      </div>
    </div>
  );
}
