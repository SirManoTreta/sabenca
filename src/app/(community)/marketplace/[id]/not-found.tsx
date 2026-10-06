import Link from "next/link";
export default function ListingNotFound() {
  return (
    <section className="py-12">
      <h1 className="text-2xl font-bold text-[#063b73]">
        Anúncio indisponível
      </h1>
      <p className="mt-3 text-muted-foreground">
        Este anúncio não existe ou não está disponível para seu acesso.
      </p>
      <Link
        className="mt-5 inline-block font-semibold text-primary"
        href="/marketplace"
      >
        Voltar ao Marketplace
      </Link>
    </section>
  );
}
