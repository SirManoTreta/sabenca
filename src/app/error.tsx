"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main id="main" className="mx-auto max-w-lg px-6 py-24">
      <h1 className="serif text-3xl">Não conseguimos carregar este espaço.</h1>
      <p className="my-6 text-sm leading-6 text-muted-foreground">
        Ocorreu um problema temporário. Tente novamente em instantes.
      </p>
      <Button onClick={reset}>Tentar novamente</Button>
    </main>
  );
}
