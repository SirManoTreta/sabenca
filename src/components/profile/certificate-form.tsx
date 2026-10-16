"use client";
import { useActionState } from "react";
import { changeCertificate } from "@/app/(community)/profile/certificados/actions";
import type { Certificate } from "@/services/certificates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormFeedback } from "./form-feedback";
export function CertificateForm({
  certificate: c,
  remove = false,
}: {
  certificate?: Certificate;
  remove?: boolean;
}) {
  const [state, action, pending] = useActionState(changeCertificate, {});
  return (
    <form action={action} className="space-y-4">
      {c && <input type="hidden" name="id" value={c.id} />}
      {remove ? (
        <>
          <input type="hidden" name="operation" value="delete" />
          <label className="flex items-start gap-2 text-sm">
            <input name="confirm" value="yes" type="checkbox" required />
            Confirmo excluir este certificado e seu documento
          </label>
        </>
      ) : (
        <>
          <label className="block text-sm font-medium">
            Título
            <Input
              name="title"
              defaultValue={c?.title}
              minLength={3}
              maxLength={160}
              required
            />
          </label>
          <label className="block text-sm font-medium">
            Instituição emissora
            <Input
              name="issuer"
              defaultValue={c?.issuer}
              minLength={2}
              maxLength={160}
              required
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium">
              Data de emissão
              <Input
                name="issue_date"
                type="date"
                defaultValue={c?.issue_date}
                required
              />
            </label>
            <label className="block text-sm font-medium">
              Validade (opcional)
              <Input
                name="expiration_date"
                type="date"
                defaultValue={c?.expiration_date ?? ""}
              />
            </label>
          </div>
          <label className="block text-sm font-medium">
            Código da credencial (opcional)
            <Input
              name="credential_id"
              maxLength={160}
              defaultValue={c?.credential_id ?? ""}
            />
          </label>
          <label className="block text-sm font-medium">
            URL de verificação (opcional, HTTPS)
            <Input
              name="verification_url"
              type="url"
              maxLength={2048}
              defaultValue={c?.verification_url ?? ""}
            />
          </label>
          <label className="block text-sm font-medium">
            Documento privado (PDF, JPG ou PNG; até 4 MiB)
            <Input
              name="document"
              type="file"
              accept="application/pdf,image/jpeg,image/png"
            />
          </label>
          {c?.has_file && (
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="remove_file" value="yes" />
              Remover documento atual
            </label>
          )}
        </>
      )}
      <FormFeedback state={state} />
      <Button disabled={pending} variant={remove ? "outline" : "default"}>
        {pending
          ? "Processando…"
          : remove
            ? "Excluir certificado"
            : c
              ? "Salvar certificado"
              : "Cadastrar certificado"}
      </Button>
    </form>
  );
}
export function CertificateCleanup() {
  const [state, action, pending] = useActionState(changeCertificate, {});
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="operation" value="cleanup" />
      <FormFeedback state={state} />
      <Button variant="outline" disabled={pending}>
        {pending ? "Limpando…" : "Tentar limpeza de documentos"}
      </Button>
    </form>
  );
}
