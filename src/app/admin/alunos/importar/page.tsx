import { ImportForm } from "@/components/admin/import-form";
import { requireAdmin } from "@/services/session";
export const metadata = { title: "Importar alunos" };
export default async function ImportPage() {
  await requireAdmin();
  return (
    <>
      <p className="text-xs font-semibold uppercase tracking-widest text-primary">
        Registro institucional
      </p>
      <h1 className="mt-3 text-3xl font-bold text-[#063b73]">
        Importar alunos
      </h1>
      <p className="mb-8 mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
        Use as colunas ra, nome, email, telefone, data_nascimento e cpf. Curso e
        semestre são opcionais. O RA deve estar em formato Texto; datas, em
        DD/MM/AAAA ou formato de data do Excel.
      </p>
      <ImportForm />
    </>
  );
}
