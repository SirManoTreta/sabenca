import type { ProfileLabel } from "./profile";
export type NetworkStudent = {
  id: string;
  username: string;
  name: string;
  course: string | null;
  semester: number | null;
  institution: string | null;
  avatar_url: string | null;
  skills: ProfileLabel[];
  interests: ProfileLabel[];
};
export type NetworkCatalogs = {
  courses: ProfileLabel[];
  skills: ProfileLabel[];
  interests: ProfileLabel[];
};
export type NetworkFilters = {
  q: string;
  course?: string;
  semester?: number;
  skill?: string;
  interest?: string;
  page: number;
};
export type NetworkSearchParams = Record<string, string | string[] | undefined>;
export type NetworkResult = NetworkCatalogs & {
  students: NetworkStudent[];
  total: number;
  filters: NetworkFilters;
  error?: string;
};
