import { z } from "zod";
import { normalizeBirthDate, raSchema } from "./student";
const password = z
  .string()
  .min(8, "Use pelo menos 8 caracteres.")
  .max(128, "Use no máximo 128 caracteres.");
export const loginSchema = z.object({
  ra: raSchema,
  password: z.string().min(1, "Informe sua senha.").max(128),
});
export const adminLoginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Informe um e-mail válido.")),
  password: z.string().min(1, "Informe sua senha.").max(128),
});
export const firstAccessSchema = z.object({
  ra: raSchema,
  birthDate: z
    .string()
    .transform(normalizeBirthDate)
    .refine((v) => v !== null, "Use uma data válida no formato DD/MM/AAAA."),
});
export const recoverySchema = z.object({ ra: raSchema });
export const passwordSchema = z
  .object({ password, confirmPassword: z.string() })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas precisam ser iguais.",
    path: ["confirmPassword"],
  });
