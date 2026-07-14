const defaultRedirect = "/dashboard";

export function safeInternalRedirect(
  redirectTo: string | null | undefined,
  fallback = defaultRedirect,
) {
  if (
    !redirectTo ||
    !redirectTo.startsWith("/") ||
    redirectTo.startsWith("//") ||
    redirectTo.startsWith("/\\")
  ) {
    return fallback;
  }
  return redirectTo;
}
