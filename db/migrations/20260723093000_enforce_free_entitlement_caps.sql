-- Enforce Free plan caps at the database as a backstop for the app-layer
-- entitlement guards (src/lib/server/domain/entitlement-guards.ts), so a
-- direct SQL write can't bypass the marketed Free limits. These triggers only
-- ever read/compare owner_id-scoped rows — no auth.uid()/auth.role() — so
-- they port to Neon unchanged from the original Supabase migration.

create or replace function public.owner_has_pro_access(p_owner uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.subscription_profiles sp
    where sp.owner_id = p_owner
      and sp.plan = 'pro'
      and (
        sp.stripe_subscription_status in ('active', 'trialing')
        or (sp.grace_until is not null and sp.grace_until >= now())
      )
  );
$$;

-- No authenticated/service_role grant here (those roles don't exist on
-- Neon); the app's own DB role already has EXECUTE by default ownership.
revoke all on function public.owner_has_pro_access(uuid) from public;

create or replace function public.enforce_free_reminder_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_active is distinct from true then
    return new;
  end if;
  if tg_op = 'UPDATE'
     and old.is_active is true
     and new.is_active is true then
    return new;
  end if;
  if public.owner_has_pro_access(new.owner_id) then
    return new;
  end if;
  if (
    select count(*)::int
    from public.reminders
    where owner_id = new.owner_id
      and is_active = true
      and id is distinct from new.id
  ) >= 3 then
    raise exception 'Free plan allows at most 3 active reminders';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_free_reminder_limit on public.reminders;
create trigger enforce_free_reminder_limit
before insert or update on public.reminders
for each row execute function public.enforce_free_reminder_limit();

create or replace function public.enforce_free_work_session_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  month_start date := date_trunc('month', coalesce(new.work_date, current_date))::date;
begin
  if public.owner_has_pro_access(new.owner_id) then
    return new;
  end if;
  if (
    select count(*)::int
    from public.work_sessions
    where owner_id = new.owner_id
      and work_date >= month_start
      and id is distinct from new.id
  ) >= 3 then
    raise exception 'Free plan allows at most 3 work sessions per month';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_free_work_session_limit on public.work_sessions;
create trigger enforce_free_work_session_limit
before insert on public.work_sessions
for each row execute function public.enforce_free_work_session_limit();

create or replace function public.enforce_free_upload_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.owner_has_pro_access(new.owner_id) then
    return new;
  end if;
  if (
    select count(*)::int
    from public.object_files
    where owner_id = new.owner_id
      and id is distinct from new.id
  ) >= 3 then
    raise exception 'Free plan allows at most 3 uploads';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_free_upload_limit on public.object_files;
create trigger enforce_free_upload_limit
before insert on public.object_files
for each row execute function public.enforce_free_upload_limit();

create or replace function public.enforce_free_active_motorcycle_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_active is distinct from true or new.deleted_at is not null then
    return new;
  end if;
  if public.owner_has_pro_access(new.owner_id) then
    return new;
  end if;
  if (
    select count(*)::int
    from public.motorcycles
    where owner_id = new.owner_id
      and is_active = true
      and deleted_at is null
      and id is distinct from new.id
  ) >= 1 then
    raise exception 'Free plan allows at most 1 active motorcycle';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_free_active_motorcycle_limit on public.motorcycles;
create trigger enforce_free_active_motorcycle_limit
before insert or update on public.motorcycles
for each row execute function public.enforce_free_active_motorcycle_limit();
