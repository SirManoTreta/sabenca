"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { deleteProject, saveProject } from "@/app/(community)/profile/actions";
import { IMAGE_ACCEPT } from "@/lib/validations/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldError, FormFeedback } from "./form-feedback";
import { ProfileImage } from "./profile-image";
import type { SocialProject } from "@/types/profile";

export function ProjectForm({ project }: { project?: SocialProject }) {
  const [state, action, pending] = useActionState(saveProject, {});
  const [deleteState, deleteAction, deleting] = useActionState(
    deleteProject,
    {},
  );
  const [confirm, setConfirm] = useState(false);
  const [values, setValues] = useState({
    title: project?.title ?? "",
    description: project?.description ?? "",
    project_url: project?.project_url ?? "",
    repository_url: project?.repository_url ?? "",
  });
  return (
    <div className="space-y-10">
      <form action={action} className="space-y-6">
        {project && <input type="hidden" name="id" value={project.id} />}
        <fieldset
          disabled={pending || deleting}
          className="space-y-6 disabled:opacity-60"
        >
          <div>
            <label htmlFor="title" className="mb-2 block text-sm font-semibold">
              Título do projeto
            </label>
            <Input
              id="title"
              name="title"
              value={values.title}
              onChange={(event) =>
                setValues({ ...values, title: event.target.value })
              }
              required
              minLength={3}
              maxLength={120}
              aria-invalid={!!state.fields?.title}
              aria-describedby="title-error"
            />
            <FieldError id="title-error" errors={state.fields?.title} />
          </div>
          <div>
            <label
              htmlFor="description"
              className="mb-2 block text-sm font-semibold"
            >
              Descrição
            </label>
            <textarea
              id="description"
              name="description"
              value={values.description}
              onChange={(event) =>
                setValues({ ...values, description: event.target.value })
              }
              required
              maxLength={5000}
              rows={7}
              className="w-full rounded-xl border border-border p-4 text-sm leading-6 outline-primary"
              placeholder="Conte a ideia, o que você fez e o que aprendeu."
              aria-invalid={!!state.fields?.description}
              aria-describedby="description-error"
            />
            <FieldError
              id="description-error"
              errors={state.fields?.description}
            />
          </div>
          {(
            [
              ["project_url", "URL do projeto"],
              ["repository_url", "URL do repositório"],
            ] as const
          ).map(([field, label]) => (
            <div key={field}>
              <label
                htmlFor={field}
                className="mb-2 block text-sm font-semibold"
              >
                {label}{" "}
                <span className="font-normal text-muted-foreground">
                  (opcional)
                </span>
              </label>
              <Input
                id={field}
                name={field}
                type="url"
                value={values[field]}
                onChange={(event) =>
                  setValues({ ...values, [field]: event.target.value })
                }
                maxLength={2048}
                placeholder="https://"
                aria-invalid={!!state.fields?.[field]}
                aria-describedby={`${field}-error`}
              />
              <FieldError
                id={`${field}-error`}
                errors={state.fields?.[field]}
              />
            </div>
          ))}
          <div className="space-y-3">
            <label htmlFor="image" className="block text-sm font-semibold">
              Imagem do projeto{" "}
              <span className="font-normal text-muted-foreground">
                (opcional)
              </span>
            </label>
            {project?.image_url && (
              <div className="max-w-sm overflow-hidden rounded-xl">
                <ProfileImage
                  src={project.image_url}
                  name={project.title}
                  project
                />
              </div>
            )}
            <input
              id="image"
              name="image"
              type="file"
              accept={IMAGE_ACCEPT}
              className="block w-full min-w-0 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-primary"
              aria-describedby="image-help"
            />
            <p id="image-help" className="text-xs text-muted-foreground">
              JPEG, PNG ou WEBP. Até 5 MiB. Uma nova imagem substitui a
              anterior.
            </p>
            {project?.image_url && (
              <label className="flex items-center gap-2 text-sm">
                <input name="remove_image" type="checkbox" /> Remover imagem
                atual
              </label>
            )}
          </div>
        </fieldset>
        <FormFeedback state={state} />
        <div className="flex flex-wrap gap-3">
          <Button disabled={pending || deleting}>
            {pending
              ? "Salvando…"
              : project
                ? "Salvar projeto"
                : "Criar projeto"}
          </Button>
          <Button asChild variant="outline">
            <Link href="/profile">Cancelar</Link>
          </Button>
        </div>
      </form>
      {project && (
        <section className="border-t border-border pt-6">
          {confirm ? (
            <form action={deleteAction} className="space-y-4">
              <input type="hidden" name="id" value={project.id} />
              <p className="text-sm">
                Excluir “{project.title}”? O projeto e sua imagem serão
                removidos. Esta ação não pode ser desfeita.
              </p>
              <FormFeedback state={deleteState} />
              <div className="flex flex-wrap gap-3">
                <Button
                  disabled={pending || deleting}
                  className="bg-destructive hover:bg-destructive/90"
                >
                  {deleting ? "Excluindo…" : "Confirmar exclusão"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={deleting}
                  onClick={() => setConfirm(false)}
                >
                  Manter projeto
                </Button>
              </div>
            </form>
          ) : (
            <Button
              type="button"
              variant="ghost"
              className="text-destructive"
              disabled={pending}
              onClick={() => setConfirm(true)}
            >
              Excluir projeto
            </Button>
          )}
        </section>
      )}
    </div>
  );
}
