export async function load({ locals }) {
  const user = locals.user!;
  const { data: profile } = await locals.supabase
    .from("profiles")
    .select("is_staff")
    .eq("id", user.id)
    .maybeSingle();

  const [
    { count: users },
    { count: articles },
    { count: events },
    { count: requests },
  ] = await Promise.all([
    locals.supabase
      .from("profiles")
      .select("*", { count: "exact", head: true }),
    locals.supabase
      .from("forum_articles")
      .select("*", { count: "exact", head: true }),
    locals.supabase
      .from("billing_events")
      .select("*", { count: "exact", head: true }),
    locals.supabase
      .from("account_data_requests")
      .select("*", { count: "exact", head: true }),
  ]);

  return {
    isStaff: Boolean(profile?.is_staff),
    counts: { users, articles, events, requests },
  };
}
