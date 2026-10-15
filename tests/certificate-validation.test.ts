import { describe, it, expect } from "vitest";
import {
  certificateSchema,
  validateCertificateFile,
} from "@/lib/validations/certificate";
const input = {
  title: "Curso de teste",
  issuer: "Universidade",
  issue_date: "2026-01-01",
};
describe("certificate input", () => {
  it("accepts progressive metadata and rejects inconsistent dates and unsafe URLs", () => {
    expect(certificateSchema.safeParse(input).success).toBe(true);
    expect(certificateSchema.safeParse({...input,expiration_date:"",credential_id:"",verification_url:""}).success).toBe(true);
    for (const patch of [
      { issue_date: "2099-01-01" },
      { expiration_date: "2025-01-01" },
      { verification_url: "javascript:alert(1)" },
      { verification_url: "not a URL" },
      { verification_url: "https://user:secret@example.test" },
      { issue_date: "2026-02-30" },
    ])
      expect(certificateSchema.safeParse({ ...input, ...patch }).success).toBe(
        false,
      );
  });
  it("checks signature, MIME, extension, EOF and size independently", async () => {
    const pdf = "%PDF-1.7\nfixture\n%%EOF";
    expect(
      await validateCertificateFile(
        new File([pdf], "document.pdf", { type: "application/pdf" }),
      ),
    ).toHaveProperty("bytes");
    for (const file of [
      new File([pdf], "document.exe", { type: "application/pdf" }),
      new File(["<script/>"], "document.pdf", { type: "application/pdf" }),
      new File([pdf], "document.pdf", { type: "image/png" }),
      new File(["%PDF-truncated"], "document.pdf", { type: "application/pdf" }),
      new File([new Uint8Array(4 * 1024 * 1024 + 1)], "document.pdf", {
        type: "application/pdf",
      }),
    ])
      expect(await validateCertificateFile(file)).toHaveProperty("error");
  });
});
