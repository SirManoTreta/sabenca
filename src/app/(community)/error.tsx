"use client";
import { Button } from "@/components/ui/button";
export default function CommunityError({ reset }: { reset: () => void }) {
  return (
    <div
      role="alert"
      className="mx-auto max-w-xl space-y-5 rounded-2xl bg-secondary p-8"
    >
      <h1 className="text-2xl font-bold text-[#063b73]">
        Não foi possível carregar esta página.
      </h1>
      <p className="text-muted-foreground">
        Verifique sua conexão e tente novamente.
      </p>
      <Button onClick={reset}>Tentar novamente</Button>
    </div>
  );
}
