import "server-only";
import { database } from "@/lib/institution/database";
import { INSTITUTION_ID } from "@/lib/institution/config";
import { fileDigest } from "@/lib/institution/crypto";
import { parseStudentWorkbook } from "@/lib/institution/importer";
import { issueReceipt, verifyReceipt } from "@/lib/institution/receipt";
import type { ImportStudent, PreviewLine } from "@/types/institution";
type Conflict = { ra: string; email: string; cpf_fingerprint: string };
function markConflicts(
  students: ImportStudent[],
  lines: PreviewLine[],
  existing: Conflict[],
) {
  const accepted: ImportStudent[] = [];
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
  const valid = markConflicts(students, lines, existing);
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
    const accepted = markConflicts(students, lines, existing);
    if (fileDigest(Buffer.from(JSON.stringify(lines))) !== receipt.report)
      throw new Error(
        "Os registros mudaram desde a prévia. Analise o arquivo novamente.",
      );
    if (!accepted.length)
      throw new Error("Não há linhas válidas para importar.");
    const [batch] =
      await tx`insert into private.import_batches (institution_id,file_name,uploaded_by,receipt_id,total_rows,valid_rows,invalid_rows) values (${INSTITUTION_ID},${fileName.slice(0, 180)},${actor},${receipt.id},${lines.length},${accepted.length},${lines.length - accepted.length}) returning id`;
    for (const student of accepted)
      await tx`insert into private.institution_students (institution_id,ra,name,email,phone,birth_date,cpf_fingerprint,course,semester,import_batch_id) values (${INSTITUTION_ID},${student.ra},${student.name},${student.email},${student.phone},${student.birth_date},${student.cpf_fingerprint},${student.course},${student.semester},${batch.id})`;
    return accepted.length;
  });
}
