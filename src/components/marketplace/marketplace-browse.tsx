import Link from "next/link";
import { getMarketplace } from "@/services/marketplace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  conditionLabels,
  statusLabels,
  marketplaceHref,
  LISTING_PAGE_SIZE,
} from "@/lib/validations/listing";
import { ListingCard } from "./listing-card";
import type { MarketplaceParams } from "@/types/marketplace";
export async function MarketplaceBrowse({
  params,
  mine = false,
}: {
  params: MarketplaceParams;
  mine?: boolean;
}) {
  const result = await getMarketplace(params, mine);
  const f = result.filters;
  const pages = Math.ceil(result.total / LISTING_PAGE_SIZE);
  const select =
    "w-full rounded-xl border border-border bg-white px-3 py-3 text-sm outline-primary";
  return (
    <div className="entrance space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-primary">
            Sua comunidade, novas possibilidades
          </p>
          <h1 className="text-3xl font-bold text-[#063b73] sm:text-4xl">
            {mine ? "Meus anúncios" : "Marketplace"}
          </h1>
          <p className="mt-3 text-muted-foreground">
            Produtos, serviços e conhecimento de quem estuda com você.
          </p>
        </div>
        <Button asChild>
          <Link href="/marketplace/novo">Criar anúncio</Link>
        </Button>
      </header>
      <nav
        aria-label="Áreas do Marketplace"
        className="flex flex-wrap gap-5 text-sm font-semibold text-primary"
      >
        <Link href="/marketplace" aria-current={!mine ? "page" : undefined}>
          Explorar anúncios
        </Link>
        <Link
          href="/marketplace/meus-anuncios"
          aria-current={mine ? "page" : undefined}
        >
          Meus anúncios
        </Link>
      </nav>
      <form
        method="get"
        action={mine ? "/marketplace/meus-anuncios" : "/marketplace"}
        className="space-y-5 rounded-2xl bg-secondary/60 p-5 sm:p-6"
      >
        {f.seller && <input type="hidden" name="seller" value={f.seller} />}
        <div>
          <label htmlFor="q" className="mb-2 block text-sm font-semibold">
            Buscar anúncios
          </label>
          <Input
            name="q"
            id="q"
            defaultValue={f.q}
            maxLength={100}
            placeholder="Livros, serviços, eletrônicos..."
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label
              htmlFor="category"
              className="mb-2 block text-sm font-semibold"
            >
              Categoria
            </label>
            <select
              className={select}
              id="category"
              name="category"
              defaultValue={f.category ?? ""}
            >
              <option value="">Todas as categorias</option>
              {result.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="filter-condition"
              className="mb-2 block text-sm font-semibold"
            >
              Condição
            </label>
            <select
              className={select}
              name="condition"
              id="filter-condition"
              defaultValue={f.condition ?? ""}
              disabled={
                result.categories.find((c) => c.id === f.category)?.is_service
              }
            >
              <option value="">Todas as condições</option>
              {(["new", "like_new", "used"] as const).map((c) => (
                <option key={c} value={c}>
                  {conditionLabels[c]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="sort" className="mb-2 block text-sm font-semibold">
              Ordenar por
            </label>
            <select
              className={select}
              id="sort"
              name="sort"
              defaultValue={f.sort}
            >
              <option value="recent">Mais recentes</option>
              <option value="price_asc">Menor preço</option>
              <option value="price_desc">Maior preço</option>
            </select>
          </div>
          <div>
            <label htmlFor="min" className="mb-2 block text-sm font-semibold">
              Preço mínimo (R$)
            </label>
            <Input
              id="min"
              name="min"
              inputMode="decimal"
              defaultValue={f.min ?? ""}
            />
          </div>
          <div>
            <label htmlFor="max" className="mb-2 block text-sm font-semibold">
              Preço máximo (R$)
            </label>
            <Input
              id="max"
              name="max"
              inputMode="decimal"
              defaultValue={f.max ?? ""}
            />
          </div>
          {mine && (
            <div>
              <label
                htmlFor="filter-status"
                className="mb-2 block text-sm font-semibold"
              >
                Status
              </label>
              <select
                id="filter-status"
                name="status"
                className={select}
                defaultValue={f.status ?? ""}
              >
                <option value="">Todos os status</option>
                {Object.entries(statusLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          <Button type="submit">Pesquisar e filtrar</Button>
          <Button asChild variant="outline">
            <Link href={mine ? "/marketplace/meus-anuncios" : "/marketplace"}>
              Limpar filtros
            </Link>
          </Button>
        </div>
      </form>
      {"error" in result && result.error && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-4 text-sm text-red-800"
        >
          {result.error}
        </p>
      )}
      {result.listings.length ? (
        <>
          <p className="text-sm text-muted-foreground">
            {result.total} anúncio(s) encontrado(s).
          </p>
          <div className="grid items-start gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {result.listings.map((l) => (
              <ListingCard key={l.id} listing={l} mine={mine} />
            ))}
          </div>
        </>
      ) : (
        <section className="rounded-2xl border border-dashed border-border p-10 text-center">
          <h2 className="font-bold text-[#063b73]">
            {mine
              ? "Você ainda não publicou anúncios com estes filtros."
              : "Nenhum anúncio encontrado."}
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            {mine
              ? "Compartilhe algo útil com sua comunidade."
              : "Tente outra busca ou ajuste os filtros."}
          </p>
          {mine && (
            <Button asChild className="mt-5">
              <Link href="/marketplace/novo">Criar primeiro anúncio</Link>
            </Button>
          )}
        </section>
      )}
      {pages > 1 && (
        <nav
          aria-label="Paginação de anúncios"
          className="flex flex-wrap items-center justify-center gap-4"
        >
          {f.page > 1 && (
            <Link
              className="font-semibold text-primary"
              href={marketplaceHref(f, f.page - 1, mine)}
            >
              Página anterior
            </Link>
          )}
          <span className="text-sm text-muted-foreground">
            Página {f.page} de {pages}
          </span>
          {f.page < pages && (
            <Link
              className="font-semibold text-primary"
              href={marketplaceHref(f, f.page + 1, mine)}
            >
              Próxima página
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
