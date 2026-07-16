export async function load({ locals, url }) {
  const { data: profile } = await locals.supabase
    .from("subscription_profiles")
    .select("*")
    .eq("owner_id", locals.user!.id)
    .maybeSingle();
  const { data: requests } = await locals.supabase
    .from("account_data_requests")
    .select("*")
    .eq("owner_id", locals.user!.id)
    .order("created_at", { ascending: false });
  return {
    profile,
    requests: requests ?? [],
    checkout: url.searchParams.get("checkout"),
  };
}

export const actions = {
  requestExport: async ({ locals }) => {
    await locals.supabase.from("account_data_requests").insert({
      owner_id: locals.user!.id,
      request_type: "export",
      status: "open",
    });
    return { ok: true };
  },
  requestDeletion: async ({ locals }) => {
    await locals.supabase.from("account_data_requests").insert({
      owner_id: locals.user!.id,
      request_type: "deletion",
      status: "open",
    });
    return { ok: true };
  },
};
