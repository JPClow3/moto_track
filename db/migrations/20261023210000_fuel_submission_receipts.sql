-- Stable offline acknowledgements survive deletion of the visible record.
-- Only an opaque digest is retained, never receipt amounts, notes or station data.
create table public.offline_fuel_submissions (
  id uuid primary key,
  owner_id uuid not null references neon_auth."user"(id) on delete cascade,
  payload_fingerprint text check (payload_fingerprint is null or payload_fingerprint ~ '^[0-9a-f]{64}$'),
  accepted_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index offline_fuel_submissions_owner_idx on public.offline_fuel_submissions (owner_id);
revoke all on public.offline_fuel_submissions from public;

create function public.remember_deleted_fuel_submission()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  -- During auth-account CASCADE the parent is already gone. Do not create a
  -- new FK row while that same account and its existing receipts are removed.
  if exists (select 1 from neon_auth."user" where id = old.owner_id) then
    insert into public.offline_fuel_submissions (id, owner_id, payload_fingerprint, accepted_at, deleted_at)
    values (old.id, old.owner_id, null, old.created_at, now())
    on conflict (id) do update set deleted_at = excluded.deleted_at
      where offline_fuel_submissions.owner_id = old.owner_id;
  end if;
  return old;
end;
$$;

revoke all on function public.remember_deleted_fuel_submission() from public;
create trigger remember_deleted_fuel_submission
before delete on public.fuel_records
for each row execute function public.remember_deleted_fuel_submission();
