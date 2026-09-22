import { notFound } from "next/navigation";
import { getOwnProject } from "@/services/profile";
import { ProjectForm } from "@/components/profile/project-form";
export const metadata = { title: "Editar projeto" };
export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getOwnProject(id);
  if (!project) notFound();
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <h1 className="text-3xl font-bold text-[#063b73]">Editar projeto</h1>
      <ProjectForm project={project} />
    </div>
  );
}
