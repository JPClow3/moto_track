/**
 * URL scheme guard for rendered Markdown bodies.
 *
 * Rendering the token tree through Svelte (rather than {@html}) already stops
 * `<script>` and `onerror=` — Svelte escapes every interpolation. It does NOT
 * stop a `javascript:` URL: `[click](javascript:...)` is ordinary, valid
 * Markdown, and binding that straight to `href` gives script execution on
 * click. So links and images are scheme-checked here.
 *
 * Allowlist, not blocklist: any scheme we did not name is refused.
 */
const SAFE_SCHEME = /^(?:https?:|mailto:|tel:)/i;

/** A URL scheme per RFC 3986: ALPHA *( ALPHA / DIGIT / "+" / "-" / "." ) ":" */
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/**
 * Returns the href if it is safe to bind, or `null` if it must be refused.
 * Relative, root-relative and fragment links carry no scheme and are allowed.
 */
export function safeHref(href: unknown): string | null {
  const value = String(href ?? "")
    // Browsers strip TAB, LF and CR from a URL *anywhere*, including mid-scheme:
    // "java\tscript:alert(1)" still navigates as javascript:. Strip them before
    // the scheme test, or the test reads a harmless string and waves it through.
    .replace(/[\t\n\r]/g, "")
    // Leading C0 control characters and spaces are ignored when resolving too.
    // Matching control characters is the entire point here — this is the check
    // that stops "\x01javascript:" from sneaking past the scheme test.
    // eslint-disable-next-line no-control-regex
    .replace(/^[\x00-\x20]+/, "")
    .trimEnd();

  if (!value) return null;
  if (!HAS_SCHEME.test(value)) return value;
  return SAFE_SCHEME.test(value) ? value : null;
}

/** External links open in a new tab; internal ones navigate in place. */
export function isExternalHref(href: string): boolean {
  return /^https?:/i.test(href);
}
