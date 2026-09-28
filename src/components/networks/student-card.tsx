import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ProfileImage } from "@/components/profile/profile-image";
import { ConnectionActions } from "@/components/connections/connection-actions";
import type { NetworkStudent } from "@/types/networks";
import type { ProfileLabel } from "@/types/profile";
function Labels({
  title,
  items,
  max,
}: {
  title: string;
  items: ProfileLabel[];
  max: number;
}) {
  if (!items.length) return null;
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold text-muted-foreground">
        {title}
      </h3>
      <ul className="flex flex-wrap gap-2">
        {items.slice(0, max).map((item) => (
          <li
            key={item.id}
            className="max-w-full break-words rounded-lg bg-secondary px-2.5 py-1 text-xs text-primary"
          >
            {item.name}
          </li>
        ))}
        {items.length > max && (
          <li
            className="py-1 text-xs text-muted-foreground"
            aria-label={`Mais ${items.length - max} ${title.toLowerCase()}`}
          >
            +{items.length - max}
          </li>
        )}
      </ul>
    </div>
  );
}
export function StudentCard({ student }: { student: NetworkStudent }) {
  return (
    <article className="flex min-w-0 flex-col rounded-2xl border border-border bg-white p-6">
      <ProfileImage src={student.avatar_url} name={student.name} compact />
      <h2 className="mt-4 break-words text-lg font-bold text-[#063b73]">
        {student.name}
      </h2>
      <p className="break-all text-sm text-muted-foreground">
        @{student.username}
      </p>
      <div className="my-5 border-y border-border py-4">
        <p className="mb-2 text-xs font-semibold text-muted-foreground">
          Dados acadêmicos
        </p>
        <p className="break-words text-sm font-semibold">
          {student.course ?? "Curso não informado"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {student.semester ? `${student.semester}º semestre · ` : ""}
          {student.institution}
        </p>
      </div>
      <div className="mb-6 space-y-4">
        <Labels title="Habilidades" items={student.skills} max={3} />
        <Labels title="Interesses" items={student.interests} max={3} />
        {!student.skills.length && !student.interests.length && (
          <p className="text-sm text-muted-foreground">
            Conheça mais no perfil.
          </p>
        )}
      </div>
      <Button asChild variant="outline" className="mt-auto w-full">
        <Link
          href={`/users/${student.username}`}
          aria-label={`Ver perfil de ${student.name}`}
        >
          Ver perfil
        </Link>
      </Button>
      <div className="mt-3">
        <ConnectionActions
          state={student.connection}
          targetProfileId={student.id}
          name={student.name}
        />
      </div>
    </article>
  );
}
