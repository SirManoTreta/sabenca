import ExcelJS from "exceljs";
import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  parseStudentWorkbook,
  importColumns,
} from "@/lib/institution/importer";
import { normalizeBirthDate, validCpf } from "@/lib/validations/student";
import { issueReceipt, verifyReceipt } from "@/lib/institution/receipt";
import { cpfFingerprint } from "@/lib/institution/crypto";
beforeAll(() => {
  process.env.CPF_HMAC_SECRET = "cpf-secret-for-tests-only-32-characters";
  process.env.AUTH_HMAC_SECRET = "auth-secret-for-tests-only-32-characters";
});
export async function workbook(
  rows: unknown[][],
  headers: string[] = importColumns,
) {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet("Alunos");
  sheet.addRow(headers);
  for (const row of rows) sheet.addRow(row);
  return Buffer.from(await book.xlsx.writeBuffer());
}
const student = () => [
  "00123",
  "João de Teste",
  "JOAO@example.test",
  "(19) 99999-9999",
  "14/05/2003",
  "529.982.247-25",
  "Computação",
  "8",
];
describe("server XLSX importer", () => {
  it("normalizes cells and exposes only minimized preview fields", async () => {
    const result = await parseStudentWorkbook(
      await workbook([student()]),
      "alunos.xlsx",
    );
    expect(result.students[0]).toMatchObject({
      ra: "00123",
      email: "joao@example.test",
      phone: "5519999999999",
      birth_date: "2003-05-14",
      semester: 8,
    });
    expect(result.students[0].cpf_fingerprint).toHaveLength(64);
    expect(result.students[0]).not.toHaveProperty("cpf");
    const preview = JSON.stringify(result.lines);
    for (const value of ["529", "2003", "99999", "@", "cpf_fingerprint"])
      expect(preview).not.toContain(value);
  });
  it("reads real Excel dates including the 1904 date system", async () => {
    const book = new ExcelJS.Workbook();
    book.properties.date1904 = true;
    const sheet = book.addWorksheet("Alunos");
    sheet.addRow(importColumns);
    const values = student();
    values[4] = new Date("2003-05-14T00:00:00Z") as unknown as string;
    sheet.addRow(values);
    sheet.getCell("E2").numFmt = "dd/mm/yyyy";
    const result = await parseStudentWorkbook(
      Buffer.from(await book.xlsx.writeBuffer()),
      "date.xlsx",
    );
    expect(result.students[0].birth_date).toBe("2003-05-14");
  });
  it("rejects missing and duplicated headers", async () => {
    await expect(
      parseStudentWorkbook(
        await workbook([student()], importColumns.slice(1)),
        "bad.xlsx",
      ),
    ).rejects.toThrow("ra");
    await expect(
      parseStudentWorkbook(
        await workbook([student()], [...importColumns, "RA"]),
        "bad.xlsx",
      ),
    ).rejects.toThrow("Coluna repetida");
  });
  it("validates CPF digits and impossible dates without exposing values", async () => {
    const row = student();
    row[4] = "31/02/2003";
    row[5] = "111.111.111-11";
    const result = await parseStudentWorkbook(
      await workbook([row]),
      "bad.xlsx",
    );
    expect(result.students).toHaveLength(0);
    expect(result.lines[0].errors.join(" ")).toMatch(/CPF inválido/);
    expect(JSON.stringify(result.lines)).not.toContain("111.111");
  });
  it("flags repeated RA, email and CPF without overwriting", async () => {
    const result = await parseStudentWorkbook(
      await workbook([student(), student()]),
      "repeated.xlsx",
    );
    expect(result.students).toHaveLength(1);
    expect(result.lines[1].errors).toHaveLength(3);
  });
  it("requires text RA when a numeric cell lost its formatting", async () => {
    const row: unknown[] = student();
    row[0] = 123;
    const result = await parseStudentWorkbook(
      await workbook([row]),
      "numeric.xlsx",
    );
    expect(result.students).toHaveLength(0);
    expect(result.lines[0].errors.join(" ")).toContain("zeros à esquerda");
  });
  it("preserves zero-padded numeric RA with explicit Excel number format", async () => {
    const book = new ExcelJS.Workbook();
    const sheet = book.addWorksheet("Alunos");
    sheet.addRow(importColumns);
    const values: unknown[] = student();
    values[0] = 123;
    sheet.addRow(values);
    sheet.getCell("A2").numFmt = "00000";
    const result = await parseStudentWorkbook(
      Buffer.from(await book.xlsx.writeBuffer()),
      "padded.xlsx",
    );
    expect(result.students[0].ra).toBe("00123");
  });
  it("rejects formulas, macros, malformed files and excessive rows", async () => {
    const row: unknown[] = student();
    row[1] = { formula: '"Person"', result: "Person" };
    expect(
      (await parseStudentWorkbook(await workbook([row]), "formula.xlsx"))
        .students,
    ).toHaveLength(0);
    await expect(
      parseStudentWorkbook(Buffer.from("invalid"), "file.xlsx"),
    ).rejects.toThrow();
    await expect(
      parseStudentWorkbook(await workbook([student()]), "file.xlsm"),
    ).rejects.toThrow();
    await expect(
      parseStudentWorkbook(
        await workbook(Array.from({ length: 1001 }, student)),
        "large.xlsx",
      ),
    ).rejects.toThrow("1.000");
  });
  it("allows optional course and semester", async () => {
    const row = student();
    row[6] = "";
    row[7] = "";
    const result = await parseStudentWorkbook(
      await workbook([row]),
      "optional.xlsx",
    );
    expect(result.students[0]).toMatchObject({ course: null, semester: null });
  });
  it("normalizes accents and header spacing", async () => {
    const headers = [
      "RA",
      "Nome",
      "E-mail",
      "Telefone",
      "Data nascimento",
      "CPF",
      "Curso",
      "Semestre",
    ];
    expect(
      (
        await parseStudentWorkbook(
          await workbook([student()], headers),
          "headers.xlsx",
        )
      ).students,
    ).toHaveLength(1);
  });
});
describe("identification and preview receipts", () => {
  it("validates CPF and calendar dates strictly", () => {
    expect(validCpf("52998224725")).toBe(true);
    expect(validCpf("52998224724")).toBe(false);
    expect(normalizeBirthDate("29/02/2003")).toBeNull();
    expect(normalizeBirthDate("01/01/2999")).toBeNull();
  });
  it("uses keyed fingerprints for CPF", () => {
    expect(cpfFingerprint("52998224725")).toBe(cpfFingerprint("52998224725"));
    expect(cpfFingerprint("52998224725")).not.toBe(
      cpfFingerprint("11144477735"),
    );
  });
  it("binds confirmation to the actor and exact file", () => {
    const file = Buffer.from("workbook");
    const receipt = issueReceipt("admin-a", file, []);
    expect(verifyReceipt(receipt, "admin-a", file).actor).toBe("admin-a");
    expect(() => verifyReceipt(receipt, "admin-b", file)).toThrow();
    expect(() =>
      verifyReceipt(receipt, "admin-a", Buffer.from("changed")),
    ).toThrow();
    expect(() =>
      verifyReceipt(receipt.slice(0, -2) + "xx", "admin-a", file),
    ).toThrow();
  });
  it("expires a preview after 15 minutes", () => {
    const file = Buffer.from("workbook");
    const receipt = issueReceipt("admin", file, []);
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now + 16 * 60 * 1000);
    expect(() => verifyReceipt(receipt, "admin", file)).toThrow();
    vi.restoreAllMocks();
  });
});
