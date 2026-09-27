import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { NetworkCatalogs, NetworkFilters } from "@/types/networks";
export function NetworkFilterForm({
  filters,
  courses,
  skills,
  interests,
}: NetworkCatalogs & { filters: NetworkFilters }) {
  const lists = [
    { key: "course", label: "Curso", items: courses, all: "Todos os cursos" },
    {
      key: "skill",
      label: "Habilidade",
      items: skills,
      all: "Todas as habilidades",
    },
    {
      key: "interest",
      label: "Interesse",
      items: interests,
      all: "Todos os interesses",
    },
  ] as const;
  return (
    <form
      action="/networks"
      className="my-8 rounded-2xl border border-border bg-white p-5 sm:p-6"
    >
      <label htmlFor="network-q" className="mb-2 block text-sm font-semibold">
        Buscar por nome, username ou habilidade
      </label>
      <Input
        id="network-q"
        type="search"
        name="q"
        defaultValue={filters.q}
        maxLength={100}
        placeholder="Quem você quer encontrar?"
      />
      <div className="mt-5 grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {lists.map(({ key, label, items, all }) => (
          <div key={key} className="min-w-0">
            <label
              htmlFor={`network-${key}`}
              className="mb-2 block text-sm font-semibold"
            >
              {label}
            </label>
            <select
              id={`network-${key}`}
              name={key}
              defaultValue={filters[key] ?? ""}
              className="h-11 w-full min-w-0 rounded-lg border border-input bg-white px-3 text-sm"
            >
              <option value="">{all}</option>
              {filters[key] &&
                !items.some((item) => item.id === filters[key]) && (
                  <option value={filters[key]}>Filtro indisponível</option>
                )}
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
        ))}
        <div className="min-w-0">
          <label
            htmlFor="network-semester"
            className="mb-2 block text-sm font-semibold"
          >
            Semestre
          </label>
          <select
            id="network-semester"
            name="semester"
            defaultValue={filters.semester ?? ""}
            className="h-11 w-full rounded-lg border border-input bg-white px-3 text-sm"
          >
            <option value="">Todos os semestres</option>
            {Array.from({ length: 30 }, (_, index) => (
              <option key={index + 1} value={index + 1}>
                {index + 1}º semestre
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="mt-5 flex items-center gap-5">
        <Button>Buscar estudantes</Button>
        <Link
          href="/networks"
          className="text-sm font-semibold text-primary underline"
        >
          Limpar filtros
        </Link>
      </div>
    </form>
  );
}
