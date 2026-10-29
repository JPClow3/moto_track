create table if not exists public.garage_memberships (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references neon_auth."user"(id) on delete cascade,
  member_id uuid not null references neon_auth."user"(id) on delete cascade,
  role text not null check (role in ('viewer', 'contributor', 'workshop')),
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique(owner_id, member_id),
  check (owner_id <> member_id)
);
create index if not exists garage_memberships_member_idx on public.garage_memberships(member_id);

create table if not exists public.garage_invitations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references neon_auth."user"(id) on delete cascade,
  invited_email text not null,
  role text not null check (role in ('viewer', 'contributor', 'workshop')),
  token_hash text not null unique,
  token_prefix text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references neon_auth."user"(id) on delete set null,
  revoked_at timestamptz
);
create index if not exists garage_invitations_owner_idx on public.garage_invitations(owner_id);

create table if not exists public.garage_activity (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references neon_auth."user"(id) on delete cascade,
  actor_id uuid references neon_auth."user"(id) on delete set null,
  membership_id uuid references public.garage_memberships(id) on delete set null,
  record_table text not null check (record_table in ('fuel_records', 'maintenance_records')),
  record_id uuid not null,
  created_at timestamptz not null default now()
);
create index if not exists garage_activity_owner_idx on public.garage_activity(owner_id, created_at desc);
