import Link from "next/link";
import { database } from "@/lib/institution/database";
import { INSTITUTION_ID } from "@/lib/institution/config";
import { requireAdmin } from "@/services/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusControl } from "@/components/admin/status-control";
import type { StudentListItem } from "@/types/institution";
export const metadata = { title: "Alunos cadastrados" };
const labels = {
  pending: "Pendente",
  active: "Ativo",
  blocked: "Bloqueado",
  inactive: "Inativo",
};
export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const q = (params.q ?? "").slice(0, 100).replace(/[%_]/g, "");
  const page = Math.min(10000, Math.max(1, Number(params.page) || 1));
  const sql = database();
  const students = await sql<
    StudentListItem[]
  >`select id,ra,name,course,semester,status from private.institution_students where institution_id=${INSTITUTION_ID} and (ra ilike ${"%" + q + "%"} or name ilike ${"%" + q + "%"}) order by created_at desc,id limit 51 offset ${Math.floor(page - 1) * 50}`;
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            Acesso institucional
          </p>
          <h1 className="mt-3 text-3xl font-bold text-[#063b73]">
            Alunos cadastrados
          </h1>
        </div>
        <Button asChild>
          <Link href="/admin/alunos/importar">Importar planilha</Link>
        </Button>
      </div>
      <form className="my-8 flex max-w-xl gap-3">
        <label htmlFor="q" className="sr-only">
          Pesquisar aluno por RA ou nome
        </label>
        <Input
          id="q"
          name="q"
          defaultValue={q}
          placeholder="Pesquisar por RA ou nome"
        />
        <Button>Pesquisar</Button>
      </form>
      <div className="overflow-x-auto rounded-2xl border border-border bg-white">
        <table className="w-full min-w-[700px] text-left text-sm">
          <thead className="bg-secondary">
            <tr>
              {["RA", "Aluno", "Curso", "Situação", "Acesso"].map((h) => (
                <th className="p-4" key={h}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {students.slice(0, 50).map((student) => (
              <tr key={student.id} className="border-t border-border">
                <td className="p-4 font-mono text-xs">{student.ra}</td>
                <td className="p-4 font-semibold">{student.name}</td>
                <td className="p-4 text-muted-foreground">
                  {student.course || "Não informado"}
                  {student.semester ? ` · ${student.semester}º` : ""}
                </td>
                <td className="p-4">
                  <span className="rounded-full bg-muted px-3 py-1 text-xs">
                    {labels[student.status]}
                  </span>
                </td>
                <td className="p-4">
                  <StatusControl id={student.id} status={student.status} />
                </td>
              </tr>
            ))}
            {!students.length && (
              <tr>
                <td
                  colSpan={5}
                  className="p-12 text-center text-muted-foreground"
                >
                  {q
                    ? "Nenhum aluno encontrado."
                    : "Nenhum aluno importado. Comece pela planilha da instituição."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-6 flex gap-4 text-sm text-primary">
        {page > 1 && (
          <Link
            href={{ pathname: "/admin/alunos", query: { q, page: page - 1 } }}
          >
            Anterior
          </Link>
        )}
        {students.length > 50 && (
          <Link
            href={{ pathname: "/admin/alunos", query: { q, page: page + 1 } }}
          >
            Próxima página
          </Link>
        )}
      </div>
    </>
  );
}
