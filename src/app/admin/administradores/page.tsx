import { listAdministrators } from "@/services/administrators";
import { AdministratorForm } from "@/components/admin/administrator-form";
export const metadata = { title: "Administradores" };
export default async function AdministratorsPage() {
  const { administrators, invitations, ownId } = await listAdministrators();
  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-primary">Administradores</h1>
      <section className="max-w-xl space-y-4 rounded-2xl bg-white p-6">
        <p className="text-sm text-muted-foreground">
          Contas existentes mantêm a senha. Novas contas recebem convite por
          e-mail. Revogar remove somente a permissão administrativa.
        </p>
        <AdministratorForm />
      </section>
      <ul className="grid gap-4 md:grid-cols-2">
        {administrators.map((admin) => (
          <li
            key={admin.id}
            className="space-y-4 rounded-2xl border border-border bg-white p-6"
          >
            <h2 className="break-all font-semibold">{admin.email}</h2>
            <p>
              {admin.banned
                ? "Conta suspensa"
                : admin.confirmed
                  ? "E-mail confirmado"
                  : "Aguardando confirmação"}
              {admin.id === ownId ? " · Sua conta" : ""}
            </p>
            {admin.id !== ownId && <AdministratorForm id={admin.id} />}
            {!admin.confirmed && (
              <AdministratorForm resendEmail={admin.email} />
            )}
          </li>
        ))}
      </ul>
      {!!invitations.length && (
        <section className="space-y-3">
          <h2 className="text-xl font-bold">Convites incompletos</h2>
          <p>
            Para concluir um convite interrompido, adicione novamente o mesmo
            e-mail. A conta existente será preservada.
          </p>
          <ul>
            {invitations.map((i) => (
              <li key={i.email} className="break-all">
                {i.email} —{" "}
                {i.delivery_failed
                  ? "Precisa de nova tentativa"
                  : "Em processamento; nova tentativa disponível após 15 minutos"}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
