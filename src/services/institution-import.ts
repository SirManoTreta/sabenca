import "server-only";
import { database } from "@/lib/institution/database";
import { INSTITUTION_ID } from "@/lib/institution/config";
import { fileDigest } from "@/lib/institution/crypto";
import { parseStudentWorkbook } from "@/lib/institution/importer";
import { issueReceipt, verifyReceipt } from "@/lib/institution/receipt";
import type { ImportStudent, PreviewLine } from "@/types/institution";
import { courseKey } from "@/lib/validations/course";
import type { Course } from "@/types/course";
type ResolvedStudent = ImportStudent & { course_id: string | null };

function resolveCourses(
  students: ImportStudent[],
  lines: PreviewLine[],
  courses: Course[],
) {
  const catalog = new Map(
    courses.map((course) => [course.normalized_name, course]),
  );
  const valid: ResolvedStudent[] = [];
  for (const student of students) {
    const course = student.course
      ? catalog.get(courseKey(student.course))
      : undefined;
    const line = lines.find((row) => row.line === student.line)!;
    if (student.course && !course) {
      line.errors.push(
        `Curso "${student.course}" não está cadastrado na instituição. Cadastre o curso antes de importar este aluno.`,
      );
    } else if (course?.status === "inactive") {
      line.errors.push("O curso informado está inativo.");
    } else {
      line.course = course?.name ?? null;
      line.course_id = course?.id ?? null;
      valid.push({ ...student, course_id: course?.id ?? null });
    }
  }
  return valid;
}
type Conflict = { ra: string; email: string; cpf_fingerprint: string };
function markConflicts<T extends ImportStudent>(
  students: T[],
  lines: PreviewLine[],
  existing: Conflict[],
) {
  const accepted: T[] = [];
  for (const student of students) {
    const conflict = existing.find(
      (row) =>
        row.ra === student.ra ||
        row.email === student.email ||
        row.cpf_fingerprint === student.cpf_fingerprint,
    );
    if (conflict)
      lines
        .find((line) => line.line === student.line)!
        .errors.push(
          "RA, e-mail ou CPF já cadastrado. O registro existente será preservado.",
        );
    else accepted.push(student);
  }
  return accepted;
}
export async function previewImport(
  actor: string,
  buffer: Buffer,
  fileName: string,
) {
  const { students, lines } = await parseStudentWorkbook(buffer, fileName);
  const sql = database();
  const existing = students.length
    ? await sql<
        Conflict[]
      >`select ra,email,cpf_fingerprint from private.institution_students where institution_id=${INSTITUTION_ID} and (ra in ${sql(students.map((v) => v.ra))} or email in ${sql(students.map((v) => v.email))} or cpf_fingerprint in ${sql(students.map((v) => v.cpf_fingerprint))})`
    : [];
  const courses = await sql<
    Course[]
  >`select id,name,normalized_name,status from public.courses where institution_id=${INSTITUTION_ID}`;
  const valid = markConflicts(
    resolveCourses(students, lines, courses),
    lines,
    existing,
  );
  return {
    fileName: fileName.slice(0, 180),
    total: lines.length,
    valid: valid.length,
    invalid: lines.length - valid.length,
    lines,
    receipt: issueReceipt(actor, buffer, lines),
  };
}
export async function confirmImport(
  actor: string,
  buffer: Buffer,
  fileName: string,
  token: string,
) {
  const receipt = verifyReceipt(token, actor, buffer);
  const { students, lines } = await parseStudentWorkbook(buffer, fileName);
  const sql = database();
  return await sql.begin(async (tx) => {
    // Serialize imports for this installation; constraints remain the final race barrier.
    await tx`select id from private.institutions where id=${INSTITUTION_ID} for update`;
    const admin =
      await tx`select user_id from private.admin_users where user_id=${actor} and institution_id=${INSTITUTION_ID} for share`;
    if (!admin.length) throw new Error("Acesso administrativo revogado.");
    const previous =
      await tx`select valid_rows from private.import_batches where receipt_id=${receipt.id} and uploaded_by=${actor}`;
    if (previous.length) return Number(previous[0].valid_rows);
    const existing = students.length
      ? await tx<
          Conflict[]
        >`select ra,email,cpf_fingerprint from private.institution_students where institution_id=${INSTITUTION_ID} and (ra in ${tx(students.map((v) => v.ra))} or email in ${tx(students.map((v) => v.email))} or cpf_fingerprint in ${tx(students.map((v) => v.cpf_fingerprint))})`
      : [];
    // Hold catalog rows until commit: a course cannot become inactive between validation and insert.
    const courses = await tx<
      Course[]
    >`select id,name,normalized_name,status from public.courses where institution_id=${INSTITUTION_ID} order by id for share`;
    const accepted = markConflicts(
      resolveCourses(students, lines, courses),
      lines,
      existing,
    );
    if (fileDigest(Buffer.from(JSON.stringify(lines))) !== receipt.report)
      throw new Error(
        "Os registros mudaram desde a prévia. Analise o arquivo novamente.",
      );
    if (!accepted.length)
      throw new Error("Não há linhas válidas para importar.");
    const [batch] =
      await tx`insert into private.import_batches (institution_id,file_name,uploaded_by,receipt_id,total_rows,valid_rows,invalid_rows) values (${INSTITUTION_ID},${fileName.slice(0, 180)},${actor},${receipt.id},${lines.length},${accepted.length},${lines.length - accepted.length}) returning id`;
    for (const student of accepted)
      await tx`insert into private.institution_students (institution_id,ra,name,email,phone,birth_date,cpf_fingerprint,course_id,semester,import_batch_id) values (${INSTITUTION_ID},${student.ra},${student.name},${student.email},${student.phone},${student.birth_date},${student.cpf_fingerprint},${student.course_id},${student.semester},${batch.id})`;
    return accepted.length;
  });
}
