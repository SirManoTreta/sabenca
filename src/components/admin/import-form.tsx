"use client";
import { useActionState, useState } from "react";
import {
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  LoaderCircle,
} from "lucide-react";
import { importStudents } from "@/app/admin/alunos/actions";
import { Button } from "@/components/ui/button";
import type { ImportState } from "@/types/institution";
export function ImportForm() {
  const [file, setFile] = useState<File | null>(null);
  const [reviewedFile, setReviewedFile] = useState<File | null>(null);
  const [state, action, pending] = useActionState<ImportState, FormData>(
    async (prev, data) => {
      if (file) data.set("file", file);
      const result = await importStudents(prev, data);
      if (result.preview) setReviewedFile(file);
      return result;
    },
    {},
  );
  const preview = reviewedFile === file ? state.preview : undefined;
  return (
    <form action={action} className="space-y-6">
      <div className="rounded-2xl border border-dashed border-primary/40 bg-white p-8">
        <FileSpreadsheet className="mb-4 size-9 text-primary" />
        <label
          htmlFor="file"
          className="block text-base font-bold text-[#063b73]"
        >
          Selecione a planilha de alunos
        </label>
        <p id="file-help" className="mb-5 mt-2 text-sm text-muted-foreground">
          Arquivo .xlsx · até 2 MiB · até 1.000 alunos · uma aba preenchida
        </p>
        <input
          id="file"
          type="file"
          accept=".xlsx"
          aria-describedby="file-help"
          disabled={pending}
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setReviewedFile(null);
          }}
          className="block w-full text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-secondary file:px-4 file:py-3 file:font-semibold file:text-primary"
        />
        {file && (
          <p className="mt-3 text-xs text-muted-foreground">
            Selecionado: {file.name}
          </p>
        )}
        <Button
          className="mt-6"
          name="intent"
          value="preview"
          disabled={!file || pending}
        >
          {pending ? <LoaderCircle className="animate-spin" /> : <Upload />}
          Analisar planilha
        </Button>
      </div>
      {state.error && (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-destructive"
        >
          {state.error}
        </p>
      )}
      {state.success && (
        <div
          role="status"
          className="flex items-center gap-3 rounded-xl bg-secondary p-5 text-sm"
        >
          <CheckCircle2 className="shrink-0 text-primary" />
          {state.success}
        </div>
      )}
      {preview && (
        <section
          aria-label="Prévia da importação"
          className="rounded-2xl border border-border bg-white p-5 sm:p-7"
        >
          <h2 className="text-xl font-bold text-[#063b73]">
            Confira antes de importar
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Nenhum aluno foi gravado. Dados privados não são exibidos nesta
            prévia.
          </p>
          <div className="my-6 grid grid-cols-3 gap-3">
            {[
              [preview.total, "Linhas"],
              [preview.valid, "Válidas"],
              [preview.invalid, "Com erro"],
            ].map(([value, label]) => (
              <div key={label} className="rounded-xl bg-muted p-4">
                <strong className="text-2xl text-[#063b73]">{value}</strong>
                <p className="mt-1 text-xs text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
          <div className="max-h-96 overflow-auto">
            <table className="w-full min-w-[620px] text-left text-xs">
              <thead className="sticky top-0 bg-muted">
                <tr>
                  {["Linha", "RA", "Nome", "Curso / semestre", "Validação"].map(
                    (h) => (
                      <th key={h} className="p-3">
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {preview.lines.map((row) => (
                  <tr key={row.line} className="border-b border-border">
                    <td className="p-3">{row.line}</td>
                    <td className="p-3 font-mono">{row.ra || "—"}</td>
                    <td className="p-3">{row.name || "—"}</td>
                    <td className="p-3">
                      {row.course || "—"}
                      {row.semester ? ` / ${row.semester}º` : ""}
                    </td>
                    <td
                      className={
                        "max-w-75 p-3 " +
                        (row.errors.length
                          ? "text-destructive"
                          : "text-primary")
                      }
                    >
                      {row.errors.length
                        ? row.errors.join(" ")
                        : "Pronto para importar"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <input type="hidden" name="receipt" value={preview.receipt} />
          <label className="mt-6 flex items-start gap-3 text-sm leading-6">
            <input
              type="checkbox"
              name="confirm"
              value="yes"
              required={false}
              className="mt-1 size-4"
              disabled={pending || !preview.valid}
            />
            <span>
              Confirmo a importação de{" "}
              <strong>{preview.valid} linha(s) válida(s)</strong>. As{" "}
              {preview.invalid} linha(s) com erro serão ignoradas; alunos
              existentes serão preservados.
            </span>
          </label>
          <Button
            name="intent"
            value="confirm"
            className="mt-5"
            disabled={pending || !preview.valid}
          >
            {pending ? (
              <LoaderCircle className="animate-spin" />
            ) : (
              <CheckCircle2 />
            )}
            Confirmar importação
          </Button>
        </section>
      )}
    </form>
  );
}
