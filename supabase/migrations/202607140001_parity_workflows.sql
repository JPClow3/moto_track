create policy "public article comments read" on public.article_comments
  for select using (true);

create or replace function public.adjust_maintenance_part_stock(part_uuid uuid, delta integer)
returns void language plpgsql security invoker as $$
begin
  update public.maintenance_parts set stock_quantity = greatest(0, stock_quantity + delta)
  where id = part_uuid and owner_id = auth.uid() and track_stock = true;
  if not found then raise exception 'Part not found or unavailable'; end if;
end;
$$;
