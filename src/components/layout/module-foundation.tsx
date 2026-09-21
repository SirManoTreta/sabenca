import { Sprout } from "lucide-react";
export function ModuleFoundation({
  title,
  description,
  next,
}: {
  title: string;
  description: string;
  next: string;
}) {
  return (
    <>
      <span className="text-[10px] font-bold uppercase tracking-[2px] text-accent-foreground">
        Sua comunidade
      </span>
      <h1 className="serif mt-3 text-4xl">{title}</h1>
      <p className="mt-4 max-w-xl text-sm leading-7 text-muted-foreground">
        {description}
      </p>
      <div className="my-12 flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-white/40 p-8 text-center">
        <span className="mb-5 flex size-14 items-center justify-center rounded-full bg-secondary">
          <Sprout size={25} strokeWidth={1.5} />
        </span>
        <h2 className="text-lg font-semibold">
          Este espaço está ganhando forma.
        </h2>
        <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
          {next}
        </p>
        <span className="mt-5 rounded-full bg-secondary px-3 py-1 text-[10px] font-medium">
          Em desenvolvimento
        </span>
      </div>
    </>
  );
}
