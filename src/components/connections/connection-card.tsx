import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ProfileImage } from "@/components/profile/profile-image";
import { ConnectionActions } from "./connection-actions";
import type { ConnectionItem } from "@/types/connections";

export function ConnectionCard({ item }: { item: ConnectionItem }) {
  const { person } = item;
  return (
    <article className="flex min-w-0 flex-col gap-5 rounded-2xl border border-border bg-white p-5 sm:flex-row sm:items-center sm:p-6">
      <ProfileImage src={person.avatar_url} name={person.name} compact />
      <div className="min-w-0 flex-1">
        <h3 className="break-words text-lg font-bold text-[#063b73]">
          {person.name}
        </h3>
        {person.username && (
          <p className="break-all text-sm text-muted-foreground">
            @{person.username}
          </p>
        )}
        <p className="mt-3 break-words text-sm font-semibold">
          {person.course ?? "Curso não informado"}
        </p>
        <p className="mt-1 break-words text-xs text-muted-foreground">
          {person.semester ? `${person.semester}º semestre · ` : ""}
          {person.institution}
        </p>
      </div>
      <div className="min-w-0 space-y-3 sm:max-w-72">
        {person.username && (
          <Button asChild variant="outline">
            <Link
              href={`/users/${person.username}`}
              aria-label={`Ver perfil de ${person.name}`}
            >
              Ver perfil
            </Link>
          </Button>
        )}
        <ConnectionActions
          state={{ kind: item.direction, id: item.id }}
          targetProfileId={person.profile_id}
          name={person.name}
          allowRemove
        />
      </div>
    </article>
  );
}
