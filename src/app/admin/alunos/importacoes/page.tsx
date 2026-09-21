import { requireAdmin } from "@/services/session";
import { database } from "@/lib/institution/database";
import { INSTITUTION_ID } from "@/lib/institution/config";
export const metadata = { title: "Histórico de importações" };
export default async function ImportHistory() {
  await requireAdmin();
  const sql = database();
  const batches =
    await sql`select id,file_name,total_rows,valid_rows,invalid_rows,created_at from private.import_batches where institution_id=${INSTITUTION_ID} order by created_at desc limit 100`;
  return (
    <>
      <h1 className="text-3xl font-bold text-[#063b73]">
        Histórico de importações
      </h1>
      <p className="mb-8 mt-3 text-sm text-muted-foreground">
        As 100 importações mais recentes. Arquivos originais não são
        armazenados.
      </p>
      <div className="overflow-x-auto rounded-2xl border border-border bg-white">
        <table className="w-full min-w-[550px] text-left text-sm">
          <thead className="bg-secondary">
            <tr>
              {["Arquivo", "Data", "Linhas", "Importadas", "Com erro"].map(
                (h) => (
                  <th key={h} className="p-4">
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {batches.map((batch) => (
              <tr key={String(batch.id)} className="border-t border-border">
                <td className="p-4">{String(batch.file_name)}</td>
                <td className="p-4">
                  {new Date(batch.created_at).toLocaleString("pt-BR", {
                    timeZone: "America/Sao_Paulo",
                  })}
                </td>
                <td className="p-4">{batch.total_rows}</td>
                <td className="p-4">{batch.valid_rows}</td>
                <td className="p-4">{batch.invalid_rows}</td>
              </tr>
            ))}
            {!batches.length && (
              <tr>
                <td
                  colSpan={5}
                  className="p-12 text-center text-muted-foreground"
                >
                  Nenhuma importação realizada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
