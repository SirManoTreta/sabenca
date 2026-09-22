import Link from "next/link";
import {
  ArrowUpRight,
  GraduationCap,
  MapPin,
  Pencil,
  Plus,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProfileImage } from "./profile-image";
import { ProjectCard } from "./project-card";
import type { SocialProfile, ProfileLabel } from "@/types/profile";

function Labels({
  title,
  labels,
  empty,
}: {
  title: string;
  labels: ProfileLabel[];
  empty: string;
}) {
  return (
    <section className="rounded-2xl border border-border p-6 sm:p-8">
      <h2 className="mb-5 text-lg font-bold text-[#063b73]">{title}</h2>
      {labels.length ? (
        <ul className="flex flex-wrap gap-2">
          {labels.map((label) => (
            <li
              key={label.id}
              className="max-w-full break-words rounded-xl bg-secondary px-3 py-2 text-sm font-medium text-primary"
            >
              {label.name}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{empty}</p>
      )}
    </section>
  );
}

export function ProfileView({
  profile,
  own = false,
}: {
  profile: SocialProfile;
  own?: boolean;
}) {
  return (
    <div className="entrance space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
          {own ? "Meu espaço na comunidade" : "Conheça quem está por perto"}
        </p>
        <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck size={15} /> Visível para membros ativos
        </span>
      </div>
      <section className="overflow-hidden rounded-3xl border border-border">
        <div
          className="relative h-28 overflow-hidden bg-[#063b73] sm:h-36"
          aria-hidden="true"
        >
          <div className="absolute -right-10 -top-28 size-80 rounded-full border-[35px] border-[#0a82bb]/40" />
          <div className="absolute right-48 top-12 size-5 rounded-full bg-accent" />
          <div className="absolute top-6 left-6 flex items-center gap-2 text-xs font-medium tracking-widest text-white/70 sm:left-8">
            <Sparkles size={15} /> SABENÇA · GENTE E IDEIAS
          </div>
        </div>
        <div className="p-6 sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
            <div className="-mt-16 relative">
              <ProfileImage src={profile.avatar_url} name={profile.name} />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="break-words text-3xl font-bold tracking-tight text-[#063b73] sm:text-4xl">
                {profile.name}
              </h1>
              <p className="mt-2 text-sm text-primary">
                {profile.username
                  ? `@${profile.username}`
                  : own
                    ? "Escolha seu username em Editar perfil."
                    : "Username ainda não definido."}
              </p>
            </div>
            {own && (
              <Button asChild className="self-start sm:self-auto">
                <Link href="/profile/edit">
                  <Pencil /> Editar perfil
                </Link>
              </Button>
            )}
          </div>
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-sm text-muted-foreground">
            <p className="flex items-start gap-2">
              <GraduationCap size={18} className="shrink-0 text-primary" />{" "}
              <span className="break-words">
                {profile.course || "Curso não informado"}
                {profile.semester
                  ? ` · ${profile.semester}º semestre`
                  : " · Semestre não informado"}
              </span>
            </p>
            <p className="flex items-start gap-2">
              <MapPin size={17} className="shrink-0 text-primary" />
              <span className="break-words">
                {profile.institution || "Instituição não informada"}
              </span>
            </p>
          </div>
          {own && profile.username && (
            <Link
              href={`/users/${profile.username}`}
              className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-primary"
            >
              Ver meu perfil na comunidade <ArrowUpRight size={15} />
            </Link>
          )}
        </div>
      </section>
      <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
        <section className="rounded-2xl bg-secondary/70 p-6 sm:p-8">
          <p className="mb-4 text-xs font-bold uppercase tracking-widest text-primary">
            Além da sala de aula
          </p>
          <h2 className="mb-5 text-xl font-bold text-[#063b73]">Sobre mim</h2>
          <p className="whitespace-pre-wrap break-words leading-7 text-muted-foreground">
            {profile.bio ||
              (own
                ? "Conte um pouco sobre você. Seus interesses e suas ideias podem ser o começo de uma nova conexão."
                : "Este estudante ainda não escreveu uma biografia.")}
          </p>
        </section>
        <div className="min-w-0 space-y-6">
          <Labels
            title="Habilidades"
            labels={profile.skills}
            empty="Nenhuma habilidade adicionada ainda."
          />
          <Labels
            title="Interesses"
            labels={profile.interests}
            empty="Nenhum interesse adicionado ainda."
          />
        </div>
      </div>
      <section className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-[#063b73]">
              Ideias que viraram projetos
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Na faculdade ou fora dela, conhecimento em prática.
            </p>
          </div>
          {own && (
            <Button asChild variant="outline">
              <Link href="/profile/projects/new">
                <Plus /> Adicionar projeto
              </Link>
            </Button>
          )}
        </div>
        {profile.projects.length ? (
          <div className="grid items-start gap-6 md:grid-cols-2 xl:grid-cols-3">
            {profile.projects.map((project) => (
              <ProjectCard key={project.id} project={project} own={own} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border px-6 py-12 text-center">
            <p className="font-semibold text-[#063b73]">
              Nenhum projeto adicionado ainda.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {own
                ? "Compartilhe algo que você criou, aprendeu ou está construindo."
                : "Os próximos projetos deste estudante aparecerão aqui."}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
