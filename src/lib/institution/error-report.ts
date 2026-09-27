import type { PreviewLine } from "@/types/institution";
export function importErrorReport(lines: PreviewLine[]) {
  const cell = (value: string | number) => {
    const text = String(value);
    // Spreadsheet programs must never interpret imported text as a formula.
    const safe =
      /^[\s]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text) ? "'" + text : text;
    return `"${safe.replaceAll('"', '""')}"`;
  };
  return (
    "\uFEFF" +
    [
      ["linha", "ra", "nome", "erro"],
      ...lines
        .filter((line) => line.errors.length)
        .map((line) => [line.line, line.ra, line.name, line.errors.join(" ")]),
    ]
      .map((row) => row.map(cell).join(";"))
      .join("\r\n")
  );
}
