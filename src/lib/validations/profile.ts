import { z } from "zod";

export const normalizeLabel = (value: string) =>
  value.normalize("NFC").trim().replace(/\s+/gu, " ");
export const labelKey = (value: string) => normalizeLabel(value).toLowerCase();
export const usernameSchema = z
  .string()
  .toLowerCase()
  .regex(
    /^[a-z0-9_]{3,30}$/,
    "Use de 3 a 30 letras, números ou _. Não use espaços.",
  );
export const labelKindSchema = z.enum(["skills", "interests"]);
const labels = (max: number) =>
  z
    .array(
      z
        .string()
        .transform(normalizeLabel)
        .pipe(
          z
            .string()
            .min(1, "Informe um nome.")
            .max(max, `Use até ${max} caracteres.`)
            .regex(/^[^\p{Cc}]+$/u, "Nome inválido."),
        ),
    )
    .max(20, "Escolha até 20 opções.")
    .transform((values) => {
      const unique = new Map<string, string>();
      for (const value of values)
        if (!unique.has(labelKey(value))) unique.set(labelKey(value), value);
      return [...unique.values()];
    });
export const profileSchema = z.object({
  username: usernameSchema,
  bio: z.string().trim().max(500, "A biografia pode ter até 500 caracteres."),
  skills: labels(60),
  interests: labels(80),
});
export type ProfileInput = z.infer<typeof profileSchema>;
