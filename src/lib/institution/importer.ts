import ExcelJS from "exceljs";
import yauzl from "yauzl";
import { cpfFingerprint } from "./crypto";
import { studentSchema } from "@/lib/validations/student";
import type { ImportStudent, PreviewLine } from "@/types/institution";

export const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_EXPANDED_BYTES = 20 * 1024 * 1024;
const required = ["ra", "nome", "email", "telefone", "data_nascimento", "cpf"];
export const importColumns = [...required, "curso", "semestre"];
const headerName = (v: string) =>
  v
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s-]+/g, "_")
    .replace(/^e_mail$/, "email");

async function inspectArchive(buffer: Buffer) {
  await new Promise<void>((resolve, reject) => {
    yauzl.fromBuffer(
      buffer,
      { lazyEntries: true, validateEntrySizes: true },
      (error, zip) => {
        if (error || !zip)
          return reject(new Error("Arquivo .xlsx inválido ou danificado."));
        let count = 0,
          bytes = 0,
          expanded = 0;
        const fail = () => {
          zip.close();
          reject(
            new Error(
              "Planilha excede os limites de leitura ou contém conteúdo não permitido.",
            ),
          );
        };
        zip.on("error", fail);
        zip.on("entry", (entry: yauzl.Entry) => {
          count++;
          bytes += entry.uncompressedSize;
          if (
            count > 300 ||
            bytes > MAX_EXPANDED_BYTES ||
            entry.generalPurposeBitFlag & 1 ||
            /vbaProject|\.bin$/i.test(entry.fileName)
          )
            return fail();
          zip.openReadStream(entry, (streamError, stream) => {
            if (streamError || !stream) return fail();
            stream.on("error", fail);
            stream.on("data", (chunk: Buffer) => {
              expanded += chunk.length;
              if (expanded > MAX_EXPANDED_BYTES) {
                stream.destroy();
                fail();
              }
            });
            stream.on("end", () => zip.readEntry());
          });
        });
        zip.on("end", resolve);
        zip.readEntry();
      },
    );
  });
}
function textCell(cell: ExcelJS.Cell, field: string): string {
  const value = cell.value;
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) {
    if (field === "ra") {
      if (/^0{1,30}$/.test(cell.numFmt))
        return String(value).padStart(cell.numFmt.length, "0");
      throw new Error(
        "RA numérico: formate a célula como Texto para preservar zeros à esquerda.",
      );
    }
    if (field === "cpf") return String(value).padStart(11, "0");
    return String(value);
  }
  throw new Error(
    `Coluna ${field}: use um valor simples, sem fórmulas ou links.`,
  );
}
export async function parseStudentWorkbook(buffer: Buffer, fileName: string) {
  if (
    !/\.xlsx$/i.test(fileName) ||
    buffer.length > MAX_FILE_BYTES ||
    buffer.length === 0
  )
    throw new Error("Selecione um arquivo .xlsx de até 2 MiB.");
  await inspectArchive(buffer);
  const book = new ExcelJS.Workbook();
  try {
    await book.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  } catch {
    throw new Error("Não foi possível ler a planilha .xlsx.");
  }
  const sheets = book.worksheets.filter((sheet) => sheet.actualRowCount > 0);
  if (sheets.length !== 1)
    throw new Error("Use uma única aba preenchida para os alunos.");
  const sheet = sheets[0];
  if (sheet.rowCount > 1001 || sheet.columnCount > 20)
    throw new Error("Limite: 1.000 alunos e 20 colunas por arquivo.");
  const columns = new Map<string, number>();
  sheet.getRow(1).eachCell((cell, index) => {
    const header = headerName(textCell(cell, "cabeçalho"));
    if (columns.has(header)) throw new Error(`Coluna repetida: ${header}.`);
    columns.set(header, index);
  });
  const missing = required.filter((key) => !columns.has(key));
  if (missing.length)
    throw new Error(`Colunas obrigatórias ausentes: ${missing.join(", ")}.`);
  const students: ImportStudent[] = [];
  const lines: PreviewLine[] = [];
  const keys = {
    ra: new Set<string>(),
    email: new Set<string>(),
    cpf: new Set<string>(),
  };
  for (let line = 2; line <= sheet.rowCount; line++) {
    const row = sheet.getRow(line);
    if (!row.hasValues) continue;
    const errors: string[] = [];
    const values: Record<string, unknown> = {};
    for (const key of importColumns) {
      const index = columns.get(key);
      const cell = index ? row.getCell(index) : null;
      try {
        values[key] =
          key === "data_nascimento" && cell?.value instanceof Date
            ? cell.value
            : cell
              ? textCell(cell, key)
              : "";
      } catch (error) {
        errors.push((error as Error).message);
        values[key] = "";
      }
    }
    const parsed = studentSchema.safeParse({
      ra: values.ra,
      name: values.nome,
      email: values.email,
      phone: values.telefone,
      birth_date: values.data_nascimento,
      cpf: values.cpf,
      course: values.curso,
      semester: values.semestre,
    });
    if (!parsed.success)
      errors.push(
        ...parsed.error.issues.map(
          (issue) => `${String(issue.path[0])}: ${issue.message}`,
        ),
      );
    const preview: PreviewLine = {
      line,
      ra: String(values.ra ?? "").slice(0, 30),
      name: String(values.nome ?? "").slice(0, 100),
      course: null,
      semester: null,
      errors,
    };
    if (parsed.success && !errors.length) {
      const data = parsed.data;
      const fingerprint = cpfFingerprint(data.cpf);
      for (const [key, value, label] of [
        ["ra", data.ra, "RA"],
        ["email", data.email, "E-mail"],
        ["cpf", fingerprint, "CPF"],
      ] as const) {
        if (keys[key].has(value))
          errors.push(`${label} repetido nesta planilha.`);
        keys[key].add(value);
      }
      preview.course = data.course;
      preview.semester = data.semester;
      if (!errors.length)
        students.push({
          line,
          ra: data.ra,
          name: data.name,
          email: data.email,
          phone: data.phone,
          birth_date: data.birth_date!,
          cpf_fingerprint: fingerprint,
          course: data.course,
          semester: data.semester,
        });
    }
    lines.push(preview);
  }
  if (!lines.length) throw new Error("A planilha não contém alunos.");
  return { students, lines };
}
