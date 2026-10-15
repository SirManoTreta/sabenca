import { reportTarget } from "@/services/moderation";
import { notFound } from "next/navigation";
import Link from "next/link";
export default async function ReportTargetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const target = await reportTarget(id);
  if (!target) notFound();
  return (
    <article className="mx-auto max-w-3xl space-y-5 rounded-2xl bg-white p-6">
      <p>{target.kind as string}</p>
      <h1 className="break-words text-3xl font-bold text-primary">
        {target.title as string}
      </h1>
      <p className="whitespace-pre-wrap break-words">
        {(target.description as string) ?? "Sem descrição."}
      </p>
      <Link href="/admin/denuncias" className="text-primary underline">
        Voltar às denúncias
      </Link>
    </article>
  );
}
