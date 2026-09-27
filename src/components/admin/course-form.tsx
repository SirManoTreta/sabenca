"use client";
import { useActionState } from "react";
import { updateCourse } from "@/app/admin/cursos/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Course } from "@/types/course";

export function CourseForm({ course }: { course?: Course }) {
  const [state, action, pending] = useActionState(updateCourse, {});
  const suffix = course?.id ?? "new";
  return (
    <form action={action} className="space-y-4">
      {course && <input type="hidden" name="id" value={course.id} />}
      <div>
        <label
          htmlFor={`name-${suffix}`}
          className="mb-2 block text-sm font-semibold"
        >
          Nome do curso
        </label>
        <Input
          id={`name-${suffix}`}
          name="name"
          defaultValue={course?.name}
          minLength={2}
          maxLength={120}
          required
          disabled={pending}
        />
      </div>
      <div>
        <label
          htmlFor={`status-${suffix}`}
          className="mb-2 block text-sm font-semibold"
        >
          Situação do curso
        </label>
        <select
          id={`status-${suffix}`}
          name="status"
          defaultValue={course?.status ?? "active"}
          disabled={pending}
          className="h-11 w-full rounded-lg border border-input bg-white px-3 text-sm"
        >
          <option value="active">Ativo</option>
          <option value="inactive">Inativo</option>
        </select>
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="text-sm text-primary">
          {state.success}
        </p>
      )}
      <Button disabled={pending}>
        {pending ? "Salvando…" : course ? "Salvar curso" : "Cadastrar curso"}
      </Button>
    </form>
  );
}
