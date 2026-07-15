alter table public.legacy_id_map enable row level security;
alter table public.site_settings enable row level security;
alter table public.motorcycle_templates enable row level security;
alter table public.motorcycle_template_specs enable row level security;
alter table public.billing_events enable row level security;

create policy "motorcycle templates authenticated read"
  on public.motorcycle_templates
  for select to authenticated using (true);
create policy "motorcycle template specs authenticated read"
  on public.motorcycle_template_specs
  for select to authenticated using (true);

revoke all on function public.handle_new_user() from public;
revoke all on function public.handle_new_user() from anon, authenticated;
alter function public.set_updated_at() set search_path = public;
alter function public.adjust_maintenance_part_stock(uuid, integer) set search_path = public;
