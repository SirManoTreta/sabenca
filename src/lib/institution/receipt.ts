import { randomUUID } from "node:crypto";
import { authFingerprint, fileDigest, secureEqual } from "./crypto";
type Receipt = {
  id: string;
  actor: string;
  digest: string;
  report: string;
  expires: number;
};
export function issueReceipt(actor: string, file: Buffer, report: unknown) {
  const payload: Receipt = {
    id: randomUUID(),
    actor,
    digest: fileDigest(file),
    report: fileDigest(Buffer.from(JSON.stringify(report))),
    expires: Date.now() + 15 * 60 * 1000,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${authFingerprint(`import:${encoded}`)}`;
}
export function verifyReceipt(
  token: string,
  actor: string,
  file: Buffer,
): Receipt {
  if (token.length > 2000)
    throw new Error("Prévia inválida. Analise a planilha novamente.");
  const [encoded, signature, extra] = token.split(".");
  if (
    !encoded ||
    !signature ||
    extra ||
    !secureEqual(signature, authFingerprint(`import:${encoded}`))
  )
    throw new Error("Prévia inválida. Analise a planilha novamente.");
  const data = JSON.parse(
    Buffer.from(encoded, "base64url").toString("utf8"),
  ) as Receipt;
  if (
    data.actor !== actor ||
    data.expires < Date.now() ||
    data.digest !== fileDigest(file)
  )
    throw new Error("A prévia expirou ou o arquivo mudou. Analise novamente.");
  return data;
}
