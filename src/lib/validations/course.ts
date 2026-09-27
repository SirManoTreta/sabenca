import { z } from "zod";

export const courseKey = (name: string) =>
  name.normalize("NFC").replace(/\s+/g, " ").trim().toLowerCase();
export const courseSchema = z.object({
  id: z.uuid().optional(),
  name: z
    .string()
    .transform((value) => value.normalize("NFC").replace(/\s+/g, " ").trim())
    .pipe(
      z
        .string()
        .min(2, "Informe um nome de 2 a 120 caracteres.")
        .max(120, "Use até 120 caracteres."),
    ),
  status: z.enum(["active", "inactive"]),
});
export type CourseInput = z.infer<typeof courseSchema>;
