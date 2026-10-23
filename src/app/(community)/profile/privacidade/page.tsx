import { privacySettings } from "@/services/moderation";
import { PrivacyForm } from "@/components/profile/privacy-form";
import { BlockForm } from "@/components/profile/social-safety";
import Link from "next/link";
import { ownMarketplaceContact } from "@/services/marketplace-contact";
import { MarketplaceContactForm } from "@/components/profile/marketplace-contact-form";
export const metadata = { title: "Privacidade do perfil" };
export default async function PrivacyPage({
  searchParams,
}: {
  searchParams: Promise<{ blocked?: string; unblocked?: string }>;
}) {
  const [{ settings, blocks }, contact] = await Promise.all([
    privacySettings(),
    ownMarketplaceContact(),
  ]);
  const params = await searchParams;
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <h1 className="text-3xl font-bold text-primary">Privacidade do perfil</h1>
      {params.blocked === "1" && (
        <p role="status" className="rounded-xl bg-secondary p-4">
          Usuário bloqueado. Conexões anteriores foram removidas.
        </p>
      )}
      {params.unblocked === "1" && (
        <p role="status" className="rounded-xl bg-secondary p-4">
          Usuário desbloqueado. Conexões anteriores não são restauradas.
        </p>
      )}
      <section className="rounded-2xl border border-border p-6">
        <PrivacyForm settings={settings} />
      </section>
      <section className="space-y-4">
        <MarketplaceContactForm contact={contact} />
      </section>
      <section className="space-y-4">
        <h2 className="text-2xl font-bold">Usuários bloqueados</h2>
        {!blocks.length && <p>Nenhum usuário bloqueado.</p>}
        {blocks.map((b) => (
          <article key={b.id} className="space-y-3">
            <h3 className="break-words font-medium">{b.name}</h3>
            <BlockForm id={b.id} unblock />
          </article>
        ))}
      </section>
      <Link href="/profile" className="text-primary underline">
        Voltar ao perfil
      </Link>
    </div>
  );
}
