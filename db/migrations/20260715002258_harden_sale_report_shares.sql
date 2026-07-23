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

-- NOTE (Neon migration): the original migration dropped and recreated the
-- "sale report shares owner insert"/"owner update" RLS policies here (both
-- keyed on `owner_id = auth.uid()`) to add an ownership check on the linked
-- motorcycle. No RLS on Neon, so both the drop and the recreate were
-- omitted; the app-layer query for creating/updating a share now performs
-- this same "does this motorcycle belong to the caller" check in SQL.
