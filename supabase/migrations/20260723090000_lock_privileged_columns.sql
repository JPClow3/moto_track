-- Prevent privilege escalation via client-writable RLS policies:
-- 1) profiles.self update could set is_staff = true
-- 2) subscription_profiles owner insert/update could set plan/status/grace

create or replace function public.protect_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and new.is_staff is distinct from old.is_staff
     and coalesce(auth.role(), '') is distinct from 'service_role' then
    raise exception 'is_staff can only be changed by service role';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_privileges on public.profiles;
create trigger protect_profile_privileges
before update on public.profiles
for each row execute function public.protect_profile_privileges();

-- Owners may read their billing row; only service role (webhooks/admin) may write.
drop policy if exists "subscription_profiles owner insert" on public.subscription_profiles;
drop policy if exists "subscription_profiles owner update" on public.subscription_profiles;
drop policy if exists "subscription_profiles owner delete" on public.subscription_profiles;

revoke insert, update, delete on public.subscription_profiles from authenticated;
grant select on public.subscription_profiles to authenticated;
