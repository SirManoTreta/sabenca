const destinations = [
  "/marketplace",
  "/networks",
  "/profile",
  "/connections",
  "/auth/update-password",
  "/auth/definir-senha",
];
export function safeNext(value: unknown): string {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\x00-\x20]/.test(value)
  )
    return "/marketplace";
  try {
    const url = new URL(value, "https://sabenca.invalid");
    return destinations.some(
      (path) => url.pathname === path || url.pathname.startsWith(path + "/"),
    ) && url.origin === "https://sabenca.invalid"
      ? url.pathname + url.search
      : "/marketplace";
  } catch {
    return "/marketplace";
  }
}
