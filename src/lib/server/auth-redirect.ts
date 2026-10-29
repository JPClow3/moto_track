const defaultRedirect = "/dashboard";

// Placeholder origin: only used to ask the URL parser whether a target stays
// on the same origin, never emitted.
const PROBE_ORIGIN = "https://moto-track.invalid";

export function safeInternalRedirect(
  redirectTo: string | null | undefined,
  fallback = defaultRedirect,
) {
  if (!redirectTo || !redirectTo.startsWith("/")) return fallback;
  // Browsers strip tabs/newlines and read "\" as "/" while parsing, so a
  // prefix check alone let "/\t/evil.example" leave the site.
  if (
    [...redirectTo].some(
      (char) => char <= "\u001f" || char === "\u007f" || char === "\\",
    )
  )
    return fallback;
  try {
    if (new URL(redirectTo, PROBE_ORIGIN).origin !== PROBE_ORIGIN)
      return fallback;
  } catch {
    return fallback;
  }
  return redirectTo;
}
