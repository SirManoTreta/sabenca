import { z } from "zod";
export const raSchema = z
  .string()
  .trim()
  .min(1, "Informe o RA.")
  .max(30)
  .regex(/^[A-Za-z0-9._-]+$/, "RA inválido.");
export function normalizeBirthDate(value: unknown): string | null {
  let year: number, month: number, day: number;
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    year = value.getUTCFullYear();
    month = value.getUTCMonth() + 1;
    day = value.getUTCDate();
  } else if (
    typeof value === "string" &&
    /^\d{2}\/\d{2}\/\d{4}$/.test(value.trim())
  ) {
    [day, month, year] = value.trim().split("/").map(Number);
  } else return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    year < 1900 ||
    date.getTime() > Date.now() ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  )
    return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
export function validCpf(value: string) {
  if (!/^\d{11}$/.test(value) || /^(\d)\1{10}$/.test(value)) return false;
  const digits = value.split("").map(Number);
  for (const count of [9, 10]) {
    const sum = digits
      .slice(0, count)
      .reduce((total, digit, index) => total + digit * (count + 1 - index), 0);
    const check = (sum * 10) % 11;
    if ((check === 10 ? 0 : check) !== digits[count]) return false;
  }
  return true;
}
export function normalizePhone(value: string) {
  const digits = value.replace(/[\s()+.-]/g, "");
  return /^(\d{10}|\d{11})$/.test(digits) ? `55${digits}` : digits;
}
export const studentSchema = z.object({
  ra: raSchema,
  name: z.string().trim().min(2, "Nome: use de 2 a 100 caracteres.").max(100),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254)
    .pipe(z.email("E-mail inválido.")),
  phone: z
    .string()
    .transform(normalizePhone)
    .refine(
      (v) => /^55[1-9]\d\d{8,9}$/.test(v),
      "Telefone inválido; informe DDD e número.",
    ),
  birth_date: z
    .unknown()
    .transform(normalizeBirthDate)
    .refine((v) => v !== null, "Data de nascimento inválida; use DD/MM/AAAA."),
  cpf: z
    .string()
    .transform((v) => v.replace(/[.\-\s]/g, ""))
    .refine(validCpf, "CPF inválido."),
  course: z
    .string()
    .trim()
    .max(120)
    .transform((v) => v || null),
  semester: z
    .string()
    .trim()
    .transform((v) => (v ? Number(v) : null))
    .refine(
      (v) => v === null || (Number.isInteger(v) && v >= 1 && v <= 30),
      "Semestre: informe um número de 1 a 30.",
    ),
});
