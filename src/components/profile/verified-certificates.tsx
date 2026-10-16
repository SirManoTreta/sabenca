import { requireUser } from "@/services/session";
import Link from "next/link";
type Metadata = {
  id: string;
  title: string;
  issuer: string;
  issue_date: string;
  expiration_date: string | null;
  credential_id: string | null;
  verification_url: string | null;
};
export async function VerifiedCertificates({
  profileId,
  own,
}: {
  profileId: string;
  own: boolean;
}) {
  const { client } = await requireUser();
  const { data, error } = await client.rpc("visible_certificates", {
    target_profile: profileId,
  });
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-primary">Certificados</h2>
        {own && (
          <Link
            href="/profile/certificados"
            className="font-medium text-primary underline"
          >
            Gerenciar certificados
          </Link>
        )}
      </div>
      {error ? (
        <p role="alert">Não foi possível carregar os certificados.</p>
      ) : !(data as Metadata[] | null)?.length ? (
        <p>Nenhum certificado verificado para exibir.</p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {(data as Metadata[]).map((c) => (
            <li
              key={c.id}
              className="space-y-2 rounded-2xl border border-border p-5"
            >
              <h3 className="break-words font-bold">{c.title}</h3>
              <p>
                {c.issuer} · {c.issue_date}
                {c.expiration_date ? ` · Válido até ${c.expiration_date}` : ""}
              </p>
              <p className="text-sm font-semibold text-primary">
                Documento verificado pelo SABENÇA
              </p>
              {c.credential_id && (
                <p className="break-words text-sm">
                  Credencial: {c.credential_id}
                </p>
              )}
              {c.verification_url && (
                <a
                  href={c.verification_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline"
                >
                  Fonte de verificação
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
