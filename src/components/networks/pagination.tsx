import Link from "next/link";
import { Button } from "@/components/ui/button";
import { networksHref, NETWORK_PAGE_SIZE } from "@/lib/validations/networks";
import type { NetworkFilters } from "@/types/networks";
export function NetworkPagination({
  filters,
  total,
}: {
  filters: NetworkFilters;
  total: number;
}) {
  const pages = Math.max(1, Math.ceil(total / NETWORK_PAGE_SIZE));
  if (pages === 1 && filters.page === 1) return null;
  return (
    <nav
      aria-label="Paginação de estudantes"
      className="mt-8 flex flex-wrap items-center justify-between gap-4"
    >
      {filters.page > 1 ? (
        <Button asChild variant="outline">
          <Link href={networksHref(filters, Math.min(pages, filters.page - 1))}>
            Anterior
          </Link>
        </Button>
      ) : (
        <span />
      )}
      <p className="text-sm text-muted-foreground">
        Página {filters.page} de {pages}
      </p>
      {filters.page < pages && (
        <Button asChild variant="outline">
          <Link href={networksHref(filters, filters.page + 1)}>Próxima</Link>
        </Button>
      )}
    </nav>
  );
}
