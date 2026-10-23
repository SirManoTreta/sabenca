// Match database eligibility at the Brazilian calendar-day boundary.
export function certificateExpired(
  expiration: string | null,
  now = new Date(),
) {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return !!expiration && expiration < today;
}
