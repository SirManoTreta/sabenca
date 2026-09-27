import ExcelJS from "exceljs";
import { beforeAll, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const admin = vi.hoisted(() => vi.fn());
vi.mock("@/services/session", () => ({ requireAdmin: admin }));
import { createStudentTemplate } from "@/lib/institution/template";
import {
  parseStudentWorkbook,
  importColumns,
} from "@/lib/institution/importer";
import { GET } from "@/app/admin/alunos/modelo/route";
import { courseKey, courseSchema } from "@/lib/validations/course";
import { importErrorReport } from "@/lib/institution/error-report";
import { networkFiltersSchema, networksHref } from "@/lib/validations/networks";
beforeAll(() => {
  process.env.CPF_HMAC_SECRET = "template-test-secret-at-least-32-characters";
});

describe("official Excel template", () => {
  it("round-trips one empty sheet, headers, formats, notes and frozen header", async () => {
    const buffer = await createStudentTemplate();
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    expect(book.worksheets).toHaveLength(1);
    const sheet = book.worksheets[0];
    expect(sheet.actualRowCount).toBe(1);
    expect((sheet.getRow(1).values as string[]).slice(1)).toEqual(
      importColumns,
    );
    expect(sheet.getColumn(1).numFmt).toBe("@");
    expect(sheet.getColumn(6).numFmt).toBe("@");
    expect(sheet.getColumn(5).numFmt).toBe("dd/mm/yyyy");
    expect(sheet.getColumn(8).numFmt).toBe("0");
    expect(sheet.views[0]).toMatchObject({ state: "frozen", ySplit: 1 });
    expect(sheet.autoFilter).toBe("A1:H1");
    expect(sheet.getCell("A1").note).toBeTruthy();
    await expect(parseStudentWorkbook(buffer, "modelo.xlsx")).rejects.toThrow(
      "não contém alunos",
    );
    sheet.addRow([
      "001234",
      "Aluno Teste",
      "test@example.test",
      "19999999999",
      new Date("2000-05-14T00:00:00Z"),
      "52998224725",
      "Computação",
      8,
    ]);
    const parsed = await parseStudentWorkbook(
      Buffer.from(await book.xlsx.writeBuffer()),
      "modelo.xlsx",
    );
    expect(parsed.students).toHaveLength(1);
    expect(parsed.students[0]).toMatchObject({
      ra: "001234",
      birth_date: "2000-05-14",
      course: "Computação",
      semester: 8,
    });
    expect(parsed.lines[0].errors).toEqual([]);
  });
  it("protects the download and returns private XLSX headers", async () => {
    admin.mockRejectedValueOnce(new Error("denied"));
    await expect(GET()).rejects.toThrow("denied");
    admin.mockResolvedValueOnce({});
    const response = await GET();
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("content-disposition")).toContain(
      "modelo-importacao-alunos-sabenca.xlsx",
    );
    expect(response.headers.get("content-type")).toContain(
      "spreadsheetml.sheet",
    );
  });
});
describe("course and Networks input", () => {
  it("exports only invalid rows and escapes spreadsheet formulas and CSV quotes", () => {
    const csv = importErrorReport([
      {
        line: 2,
        ra: "=1+1",
        name: 'Pessoa "teste"',
        course: null,
        semester: null,
        errors: ["Curso inválido"],
      },
      {
        line: 3,
        ra: "00123",
        name: "Válido",
        course: null,
        semester: null,
        errors: [],
      },
    ]);
    expect(csv).toContain('"\'=1+1"');
    expect(csv).toContain('"Pessoa ""teste"""');
    expect(csv).not.toContain("00123");
  });
  it("normalizes only safe course equivalences", () => {
    expect(courseKey("  CIÊNCIA   da Computação ")).toBe(
      courseKey("Ciência da Computação"),
    );
    expect(courseKey("Ciencia da Computacao")).not.toBe(
      courseKey("Ciência da Computação"),
    );
    expect(
      courseSchema.safeParse({ name: " ", status: "active" }).success,
    ).toBe(false);
  });
  it.each([
    { page: "0" },
    { page: "1.5" },
    { page: "10001" },
    { semester: "31" },
    { semester: "-1" },
    { course: "wrong" },
    { skill: ["x", "y"] },
    { q: "x".repeat(101) },
  ])("rejects malformed filters %j", (input) => {
    expect(networkFiltersSchema.safeParse(input).success).toBe(false);
  });
  it("defaults and retains all filters during pagination", () => {
    expect(networkFiltersSchema.parse({})).toMatchObject({ q: "", page: 1 });
    const values = {
      q: "React & SQL",
      course: "11111111-1111-4111-8111-111111111111",
      semester: 8,
      page: 1,
    };
    const url = new URL(networksHref(values, 2), "http://localhost");
    expect(url.searchParams.get("q")).toBe(values.q);
    expect(url.searchParams.get("course")).toBe(values.course);
    expect(url.searchParams.get("semester")).toBe("8");
    expect(url.searchParams.get("page")).toBe("2");
  });
});
