import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function NotFound() {
  return (
    <main id="main" className="mx-auto max-w-lg px-6 py-24">
      <p className="text-xs text-muted-foreground">
        404 · Caminho não encontrado
      </p>
      <h1 className="serif mt-4 text-4xl">Vamos voltar ao campus?</h1>
      <p className="my-6 text-sm text-muted-foreground">
        Esta página não está disponível.
      </p>
      <Button asChild>
        <Link href="/">Voltar ao início</Link>
      </Button>
    </main>
  );
}
