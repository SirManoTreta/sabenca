import Link from "next/link";
import { ArrowUpRight, Code2, Pencil } from "lucide-react";
import { ProfileImage } from "./profile-image";
import type { SocialProject } from "@/types/profile";
import { projectLinkSchema } from "@/lib/validations/project";

export function ProjectCard({
  project,
  own,
}: {
  project: SocialProject;
  own: boolean;
}) {
  return (
    <article className="min-w-0 overflow-hidden rounded-2xl border border-border bg-white">
      <ProfileImage src={project.image_url} name={project.title} project />
      <div className="space-y-4 p-6">
        <h3 className="break-words text-lg font-bold text-[#063b73]">
          {project.title}
        </h3>
        <p className="whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">
          {project.description}
        </p>
        <div className="flex flex-wrap gap-x-5 gap-y-3 text-sm font-semibold text-primary">
          {project.project_url &&
            projectLinkSchema.safeParse(project.project_url).success && (
              <a
                href={project.project_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1"
              >
                Ver projeto <ArrowUpRight size={16} />
              </a>
            )}
          {project.repository_url &&
            projectLinkSchema.safeParse(project.repository_url).success && (
              <a
                href={project.repository_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1"
              >
                <Code2 size={16} /> Repositório
              </a>
            )}
          {own && (
            <Link
              href={`/profile/projects/${project.id}/edit`}
              className="inline-flex items-center gap-1"
            >
              <Pencil size={14} /> Editar projeto
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
