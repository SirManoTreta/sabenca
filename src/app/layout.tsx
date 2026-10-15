import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
export const metadata: Metadata = {
  title: {
    default: "Sabença — Comunidade FATECE",
    template: "%s | Sabença",
  },
  description:
    "Encontre pessoas, compartilhe habilidades e descubra oportunidades na sua comunidade universitária.",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-white focus:p-3"
        >
          Pular para o conteúdo
        </a>
        {children}
        <footer className="border-t border-border px-6 py-6 text-sm text-muted-foreground"><nav aria-label="Documentos da comunidade" className="mx-auto flex max-w-7xl flex-wrap gap-x-6 gap-y-3"><Link href="/privacidade">Política de Privacidade</Link><Link href="/termos">Termos de Uso</Link><Link href="/comunidade">Regras da Comunidade</Link></nav></footer>
      </body>
    </html>
  );
}
