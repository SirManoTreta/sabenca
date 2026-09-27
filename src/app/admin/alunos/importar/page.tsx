import { ImportForm } from "@/components/admin/import-form";
import { requireAdmin } from "@/services/session";
import Link from "next/link";
import { Button } from "@/components/ui/button";
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
        Use o modelo oficial para evitar erros de formatação. Campos
        obrigatórios: RA, nome, e-mail, telefone, data de nascimento e CPF.
        Curso e semestre são opcionais. O RA deve estar em formato Texto; datas,
        em DD/MM/AAAA ou formato de data do Excel.
      </p>
      <div className="mb-8 flex flex-wrap items-center gap-4">
        <Button asChild>
          <a href="/admin/alunos/modelo" download>
            Baixar modelo de planilha
          </a>
        </Button>
        <Link
          href="/admin/cursos"
          className="text-sm font-semibold text-primary underline"
        >
          Consultar e cadastrar cursos
        </Link>
        <p className="w-full text-sm text-muted-foreground">
          Se informado, o curso deve estar cadastrado e ativo. Semestre: inteiro
          de 1 a 30. O modelo vem vazio, com uma única aba.
        </p>
      </div>
      <ImportForm />
    </>
  );
}
