import ExcelJS from "exceljs";
import { importColumns } from "./importer";

export async function createStudentTemplate() {
  const book = new ExcelJS.Workbook();
  book.creator = "SABENÇA";
  const sheet = book.addWorksheet("Alunos", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  const widths = [22, 36, 36, 23, 22, 22, 44, 16];
  sheet.columns = importColumns.map((header, index) => ({
    header,
    key: header,
    width: widths[index],
  }));
  for (const key of ["ra", "cpf", "telefone"])
    sheet.getColumn(key).numFmt = "@";
  sheet.getColumn("data_nascimento").numFmt = "dd/mm/yyyy";
  sheet.getColumn("semestre").numFmt = "0";
  sheet.autoFilter = "A1:H1";
  sheet.getRow(1).height = 30;
  const notes = [
    "Obrigatório. Texto; preserve os zeros à esquerda.",
    "Obrigatório. Nome institucional completo, de 2 a 100 caracteres.",
    "Obrigatório. Endereço de e-mail do aluno.",
    "Obrigatório. DDD e número; código do Brasil opcional.",
    "Obrigatório. Data de nascimento em DD/MM/AAAA.",
    "Obrigatório. CPF como texto, com ou sem pontuação.",
    "Opcional. Se preenchido, use o nome de um curso ativo cadastrado em Administração > Cursos.",
    "Opcional. Número inteiro de 1 a 30.",
  ];
  sheet.getRow(1).eachCell((cell, index) => {
    cell.font = {
      name: "Calibri",
      size: 11,
      bold: true,
      color: { argb: "FFFFFFFF" },
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF063B73" },
    };
    cell.alignment = { vertical: "middle", horizontal: "left" };
    cell.note = notes[index - 1];
  });
  // Column styles extend to new rows without introducing sample records or extra sheets.
  return Buffer.from(await book.xlsx.writeBuffer());
}
