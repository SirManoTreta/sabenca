export type StudentStatus = "pending" | "active" | "blocked" | "inactive";
export type ImportStudent = {
  line: number;
  ra: string;
  name: string;
  email: string;
  phone: string;
  birth_date: string;
  cpf_fingerprint: string;
  course: string | null;
  semester: number | null;
};
export type PreviewLine = {
  line: number;
  ra: string;
  name: string;
  course: string | null;
  semester: number | null;
  errors: string[];
};
export type ImportPreview = {
  fileName: string;
  total: number;
  valid: number;
  invalid: number;
  lines: PreviewLine[];
  receipt: string;
};
export type ImportState = {
  error?: string;
  success?: string;
  preview?: ImportPreview;
};
export type StudentListItem = {
  id: string;
  ra: string;
  name: string;
  course: string | null;
  semester: number | null;
  status: StudentStatus;
};
