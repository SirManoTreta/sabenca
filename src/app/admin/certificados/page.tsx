import { adminCertificates } from "@/services/certificates";
import { CertificateReview } from "@/components/admin/certificate-review";
export const metadata = { title: "Análise de certificados" };
export default async function CertificateQueue() {
  const items = await adminCertificates();
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-primary">
        Certificados pendentes e analisados
      </h1>
      <p>
        Consulte a fonte emissora e o código informado. Verificar indica análise
        pelo SABENÇA; não garante autenticidade absoluta. São exibidos até 100
        registros, com pendentes primeiro.
      </p>
      {!items.length && <p>Nenhum certificado para analisar.</p>}
      <div className="grid gap-6 lg:grid-cols-2">
        {items.map((c) => (
          <article
            key={c.id}
            className="space-y-3 rounded-2xl border border-border bg-white p-6"
          >
            <h2 className="break-words text-xl font-bold">{c.title}</h2>
            <p>
              {c.owner_name ?? "Estudante"} · {c.issuer}
            </p>
            <p>
              Emissão: {c.issue_date} · Validade:{" "}
              {c.expiration_date ?? "Não informada"}
            </p>
            <p className="break-words">
              Credencial: {c.credential_id ?? "Não informada"} · Status:{" "}
              {c.status}
            </p>
            {c.verification_url && (
              <a
                href={c.verification_url}
                target="_blank"
                rel="noopener noreferrer"
                className="block break-all text-primary underline"
              >
                Consultar fonte de verificação
              </a>
            )}
            {c.has_file && (
              <a
                href={`/certificados/${c.id}/documento`}
                className="block text-primary underline"
              >
                Baixar documento privado
              </a>
            )}
            <CertificateReview id={c.id} version={c.updated_at} />
          </article>
        ))}
      </div>
    </div>
  );
}
