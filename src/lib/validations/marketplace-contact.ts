import { z } from "zod";
export const marketplaceContactSchema = z
  .object({
    url: z
      .string()
      .trim()
      .max(2048)
      .refine((value) => {
        if (!value) return true;
        try {
          const u = new URL(value);
          return (
            u.protocol === "https:" &&
            !!u.hostname &&
            !u.username &&
            !u.password &&
            /^https:\/\/[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?(:[0-9]{1,5})?([/?#][^\s]*)?$/.test(
              value,
            )
          );
        } catch {
          return false;
        }
      }, "Informe um link HTTPS válido, sem credenciais."),
    enabled: z.boolean(),
  })
  .refine((v) => !v.enabled || !!v.url, {
    message: "Informe o link antes de autorizar sua exibição.",
    path: ["url"],
  });
