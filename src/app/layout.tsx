import type { Metadata } from "next";
import "./globals.css";
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
      </body>
    </html>
  );
}
