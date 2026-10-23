"use client";
import { useActionState } from "react";
import { changeStudentAcademics } from "@/app/admin/alunos/actions";
import type { Course } from "@/types/course";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormFeedback } from "@/components/profile/form-feedback";
export function StudentAcademicsForm({
  id,
  courseId,
  semester,
  courses,
}: {
  id: string;
  courseId: string | null;
  semester: number | null;
  courses: Course[];
}) {
  const [state, action, pending] = useActionState(changeStudentAcademics, {});
  return (
    <details className="mt-3">
      <summary className="cursor-pointer text-sm font-semibold text-primary">
        Atualizar curso e semestre
      </summary>
      <form action={action} className="mt-3 space-y-3">
        <input type="hidden" name="id" value={id} />
        <fieldset disabled={pending} className="space-y-3">
          <label className="block text-sm">
            Curso acadêmico
            <select
              name="course_id"
              defaultValue={courseId ?? ""}
              className="mt-1 block w-full rounded-xl border border-border bg-white p-2"
            >
              <option value="" disabled={!!courseId}>
                Não informado
              </option>
              {courses
                .filter((c) => c.status === "active" || c.id === courseId)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.status === "inactive" ? " (inativo)" : ""}
                  </option>
                ))}
            </select>
          </label>
          <label className="block text-sm">
            Semestre acadêmico
            <Input
              type="number"
              name="semester"
              min={1}
              max={30}
              defaultValue={semester ?? ""}
            />
          </label>
          <Button size="sm" type="submit">
            {pending ? "Salvando…" : "Salvar dados acadêmicos"}
          </Button>
        </fieldset>
        <FormFeedback state={state} />
      </form>
    </details>
  );
}
