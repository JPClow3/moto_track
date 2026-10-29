export async function load({ locals }) {
  const motorcycles = locals.user
    ? await locals.db<Array<{ id: string; name: string }>>`
    select id, name from motorcycles where owner_id = ${locals.user.id} and is_active = true order by name
  `.catch(() => [] as Array<{ id: string; name: string }>)
    : [];
  return { motorcycles };
}
