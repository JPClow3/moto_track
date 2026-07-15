alter table public.sale_report_shares
  add column if not exists token_hash text;

-- Existing shares only retain a short prefix, so revoke them rather than preserve
-- credentials that cannot be verified against the full link token.
update public.sale_report_shares
set revoked_at = coalesce(revoked_at, now()), token_hash = coalesce(token_hash, token_prefix)
where token_hash is null;

alter table public.sale_report_shares
  alter column token_hash set not null;
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.sale_report_shares'::regclass and conname = 'sale_report_shares_token_hash_key') then
    alter table public.sale_report_shares
      add constraint sale_report_shares_token_hash_key unique (token_hash);
  end if;
end $$;
alter table public.sale_report_shares
  drop constraint if exists sale_report_shares_token_prefix_key;

drop policy if exists "sale report shares owner insert" on public.sale_report_shares;
drop policy if exists "sale report shares owner update" on public.sale_report_shares;
create policy "sale report shares owner insert" on public.sale_report_shares
  for insert with check (
    owner_id = auth.uid()
    and exists (
      select 1 from public.motorcycles
      where motorcycles.id = motorcycle_id and motorcycles.owner_id = auth.uid()
    )
  );
create policy "sale report shares owner update" on public.sale_report_shares
  for update using (owner_id = auth.uid()) with check (
    owner_id = auth.uid()
    and exists (
      select 1 from public.motorcycles
      where motorcycles.id = motorcycle_id and motorcycles.owner_id = auth.uid()
    )
  );
