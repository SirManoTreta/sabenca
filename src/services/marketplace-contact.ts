import "server-only";
import { marketplaceContactSchema } from "@/lib/validations/marketplace-contact";
import { withCertificateActor } from "./certificates";
import { requireUser } from "./session";
export type MarketplaceContact = { url: string | null; enabled: boolean };
export async function ownMarketplaceContact() {
  const { user } = await requireUser();
  return withCertificateActor(user.id, async (sql) => {
    const [row] = await sql<
      MarketplaceContact[]
    >`select url,enabled from public.marketplace_contacts where user_id=${user.id}`;
    return row ?? { url: null, enabled: false };
  });
}
export async function saveMarketplaceContact(actor: string, input: unknown) {
  const v = marketplaceContactSchema.parse(input);
  await withCertificateActor(actor, async (sql) => {
    await sql`insert into public.marketplace_contacts(user_id,url,enabled) values (${actor},${v.url || null},${v.enabled})
      on conflict(user_id) do update set url=excluded.url,enabled=excluded.enabled`;
  });
}
