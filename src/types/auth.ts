export type AuthState = {
  error?: string;
  success?: string;
  fields?: Record<string, string[] | undefined>;
};
export type AuthMode =
  | "login"
  | "admin"
  | "first-access"
  | "forgot-password"
  | "update-password"
  | "activate";
