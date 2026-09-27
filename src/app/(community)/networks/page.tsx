import { getNetworks } from "@/services/networks";
import { NetworkFilterForm } from "@/components/networks/network-filters";
import { StudentCard } from "@/components/networks/student-card";
import { NetworkPagination } from "@/components/networks/pagination";
import type { NetworkSearchParams } from "@/types/networks";
export const metadata = {
  title: "Networks",
  robots: { index: false, follow: false },
};
export default async function NetworksPage({
  searchParams,
}: {
  searchParams: Promise<NetworkSearchParams>;
}) {
  const result = await getNetworks(await searchParams);
  return (
    <>
      <p className="text-xs font-semibold uppercase tracking-widest text-primary">
        Comunidade FATECE
      </p>
      <h1 className="mt-3 text-4xl font-bold tracking-tight text-[#063b73]">
        Networks
      </h1>
      <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
        Encontre pessoas, habilidades e interesses dentro da sua comunidade.
      </p>
      <NetworkFilterForm {...result} />
      {result.error ? (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-5 text-sm text-destructive"
        >
          {result.error}
        </p>
      ) : (
        <>
          <p role="status" className="mb-5 text-sm text-muted-foreground">
            {result.total}{" "}
            {result.total === 1
              ? "estudante encontrado"
              : "estudantes encontrados"}
          </p>
          {result.students.length ? (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {result.students.map((student) => (
                <StudentCard key={student.id} student={student} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border p-12 text-center">
              <h2 className="text-lg font-semibold">
                Nenhum estudante nesta página
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Ajuste os filtros ou volte à primeira página para continuar a
                busca.
              </p>
            </div>
          )}
          <NetworkPagination filters={result.filters} total={result.total} />
        </>
      )}
    </>
  );
}
