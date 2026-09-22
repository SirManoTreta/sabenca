"use client";
import { useState } from "react";
import { FolderOpen } from "lucide-react";

export function ProfileImage({
  src,
  name,
  project = false,
}: {
  src: string | null;
  name: string;
  project?: boolean;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("");
  return (
    <div
      className={
        project
          ? "grid aspect-[16/9] place-items-center overflow-hidden bg-secondary text-primary"
          : "grid size-24 shrink-0 place-items-center overflow-hidden rounded-3xl border-4 border-white bg-[#dceffc] text-3xl font-bold text-[#063b73] shadow-sm sm:size-32"
      }
    >
      {src && failed !== src ? (
        // Private, short-lived URLs must not enter the shared Next Image cache.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={project ? `Imagem de ${name}` : `Foto de ${name}`}
          className="size-full object-cover"
          onError={() => setFailed(src)}
          referrerPolicy="no-referrer"
        />
      ) : project ? (
        <FolderOpen
          size={42}
          strokeWidth={1.2}
          aria-label="Projeto sem imagem"
        />
      ) : (
        <span aria-label={`Iniciais de ${name}`}>{initials || "S"}</span>
      )}
    </div>
  );
}
