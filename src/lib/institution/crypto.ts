import { createHash, createHmac, timingSafeEqual } from "node:crypto";
function secret(name: "CPF_HMAC_SECRET" | "AUTH_HMAC_SECRET") {
  const value = process.env[name];
  if (!value || Buffer.byteLength(value) < 32)
    throw new Error(`${name} must have at least 32 bytes`);
  return value;
}
export function cpfFingerprint(cpf: string) {
  return createHmac("sha256", secret("CPF_HMAC_SECRET"))
    .update(cpf)
    .digest("hex");
}
export function authFingerprint(value: string) {
  return createHmac("sha256", secret("AUTH_HMAC_SECRET"))
    .update(value)
    .digest("hex");
}
export function fileDigest(value: Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}
export function secureEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
