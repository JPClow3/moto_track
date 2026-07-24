/**
 * Root-level so *every* page — marketing, app, and the error boundary — can
 * read the locale and the session. Without `user` here the public header had no
 * way to know someone was signed in, which stranded logged-in visitors on the
 * marketing pages with only an "Entrar" button.
 */
export async function load({ locals }) {
  let theme = "system";
  if (locals.user) {
    const [profile] = await locals.db<Array<{ theme: string }>>`
      select theme from profiles where id = ${locals.user.id}
    `.catch(() => [] as Array<{ theme: string }>);
    theme = profile?.theme ?? "system";
  }
  return {
    locale: locals.locale,
    theme,
    user: locals.user
      ? // Deliberately not the whole session user: this is serialised into
        // the HTML of every page, including public ones.
        { id: locals.user.id, email: locals.user.email ?? null }
      : null,
  };
}
