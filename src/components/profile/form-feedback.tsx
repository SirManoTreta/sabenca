import type { ProfileActionState } from "@/types/profile";
export function FormFeedback({ state }: { state: ProfileActionState }) {
  return (
    <div aria-live="polite">
      {state.error && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-4 text-sm text-destructive"
        >
          {state.error}
        </p>
      )}
      {state.success && (
        <p
          role="status"
          className="rounded-xl bg-secondary p-4 text-sm text-primary"
        >
          {state.success}
        </p>
      )}
    </div>
  );
}
export function FieldError({ id, errors }: { id: string; errors?: string[] }) {
  return errors?.length ? (
    <p id={id} className="mt-2 text-sm text-destructive">
      {errors.join(" ")}
    </p>
  ) : null;
}
