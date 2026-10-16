import Link from "next/link";
export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main id="main" className="mx-auto max-w-3xl space-y-6 px-6 py-12">
      <Link href="/" className="font-medium text-primary underline">
        SABENÇA · Início
      </Link>
      {children}
      <p className="text-sm text-muted-foreground">
        Versão acadêmica do MVP, 15 de outubro de 2026. Antes de uso
        institucional definitivo, a instituição deve revisar estes documentos e
        preencher o canal de contato.
      </p>
    </main>
  );
}
