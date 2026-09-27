import { listAdminCourses } from "@/services/courses";
import { CourseForm } from "@/components/admin/course-form";

export const metadata = {
  title: "Cursos da instituição",
  robots: { index: false, follow: false },
};
export default async function CoursesPage() {
  const courses = await listAdminCourses();
  return (
    <>
      <p className="text-xs font-semibold uppercase tracking-widest text-primary">
        Administração institucional
      </p>
      <h1 className="mt-3 text-3xl font-bold text-[#063b73]">
        Cursos da instituição
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
        Cadastre e atualize os cursos da FATECE. Cursos inativos preservam os
        vínculos existentes e não aceitam novas importações.
      </p>
      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_2fr]">
        <section className="h-fit rounded-2xl border border-border bg-white p-6">
          <h2 className="mb-5 text-xl font-bold">Novo curso</h2>
          <CourseForm />
        </section>
        <section aria-label="Catálogo de cursos" className="space-y-3">
          {courses.map((course) => (
            <details
              key={`${course.id}-${course.name}-${course.status}`}
              className="rounded-2xl border border-border bg-white p-5"
            >
              <summary className="cursor-pointer break-words font-semibold">
                {course.name}{" "}
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {course.status === "active" ? "Ativo" : "Inativo"} · Editar
                </span>
              </summary>
              <div className="mt-5">
                <CourseForm course={course} />
              </div>
            </details>
          ))}
          {!courses.length && (
            <p className="rounded-2xl bg-white p-8 text-sm text-muted-foreground">
              Nenhum curso cadastrado. Adicione o primeiro curso para
              disponibilizá-lo na importação.
            </p>
          )}
        </section>
      </div>
    </>
  );
}
