import { z } from "zod";

export const idSchema = z.uuid("Identificador inválido.");
export const projectLinkSchema = z
  .string()
  .trim()
  .max(2048, "URL muito longa.")
  .refine((value) => {
    if (!value) return true;
    try {
      const url = new URL(value);
      return (
        ["https:", "http:"].includes(url.protocol) &&
        !!url.hostname &&
        !url.username &&
        !url.password &&
        !/\s/.test(value)
      );
    } catch {
      return false;
    }
  }, "Informe uma URL válida começando com https:// ou http://.");
export const projectSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "O título precisa ter pelo menos 3 caracteres.")
    .max(120, "Use até 120 caracteres."),
  description: z
    .string()
    .trim()
    .min(1, "Descreva seu projeto.")
    .max(5000, "Use até 5.000 caracteres."),
  project_url: projectLinkSchema,
  repository_url: projectLinkSchema,
});
export type ProjectInput = z.infer<typeof projectSchema>;
