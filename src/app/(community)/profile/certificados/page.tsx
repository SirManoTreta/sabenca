import { ownCertificates } from "@/services/certificates";
import {
  CertificateForm,
  CertificateCleanup,
} from "@/components/profile/certificate-form";
import Link from "next/link";
import { certificateExpired } from "@/lib/certificates";
export const metadata = { title: "Meus certificados" };
export default async function CertificatesPage() {
  const certificates = await ownCertificates();
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <h1 className="text-3xl font-bold text-primary">Meus certificados</h1>
      <p>
        Somente metadados verificados aparecem no seu perfil. Documentos ficam
        acessíveis apenas a você e à administração. A análise da plataforma não
        substitui a validação pela instituição emissora. Para aprovação, forneça
        um arquivo ou uma URL HTTPS de verificação.
      </p>
      <section className="rounded-2xl border border-border p-6">
        <h2 className="mb-5 text-xl font-bold">Adicionar certificado</h2>
        <CertificateForm />
      </section>
      {!certificates.length && <p>Nenhum certificado cadastrado.</p>}
      {certificates.map((c) => (
        <article
          key={c.id}
          className="space-y-4 rounded-2xl border border-border p-6"
        >
          <h2 className="break-words text-xl font-bold">{c.title}</h2>
          <p>
            Status:{" "}
            {c.status === "verified"
              ? certificateExpired(c.expiration_date)
                ? "Credencial expirada · documento anteriormente verificado"
                : "Documento verificado pelo SABENÇA"
              : c.status === "rejected"
                ? "Rejeitado"
                : "Pendente de análise"}
          </p>
          {c.rejection_reason && (
            <p className="whitespace-pre-wrap break-words">
              Motivo: {c.rejection_reason}
            </p>
          )}
          {c.has_file && (
            <a
              className="font-medium text-primary underline"
              href={`/certificados/${c.id}/documento`}
            >
              Baixar documento privado
            </a>
          )}
          <details>
            <summary className="cursor-pointer font-medium">
              Editar certificado
            </summary>
            <div className="mt-4">
              <CertificateForm certificate={c} />
            </div>
          </details>
          <CertificateForm certificate={c} remove />
        </article>
      ))}
      <section className="space-y-3 rounded-2xl border border-border p-6">
        <h2 className="font-bold">Arquivos de envios anteriores</h2>
        <p className="text-sm">
          Se uma falha interromper a remoção de um documento substituído, a
          plataforma registra a limpeza para nova tentativa.
        </p>
        <CertificateCleanup />
      </section>
      <Link href="/profile" className="text-primary underline">
        Voltar ao perfil
      </Link>
    </div>
  );
}
