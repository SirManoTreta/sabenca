export type Course = {
  id: string;
  name: string;
  normalized_name: string;
  status: "active" | "inactive";
};
export type CourseState = { error?: string; success?: string };
