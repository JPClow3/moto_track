-- Keep the rider's stated history independent from later logged services. A
-- deleted/corrected receipt must never leave a service milestone behind.
alter table public.maintenance_plan_items
  add column baseline_history_status text not null default 'unknown'
    check (baseline_history_status in ('confirmed_done', 'not_done', 'unknown')),
  add column baseline_last_done_km integer
    check (baseline_last_done_km is null or baseline_last_done_km >= 0),
  add column baseline_last_done_date date;

update public.maintenance_plan_items
set baseline_history_status = initial_history_status,
    baseline_last_done_km = case when initial_history_status = 'confirmed_done' then last_done_km end,
    baseline_last_done_date = case when initial_history_status = 'confirmed_done' then last_done_date end;

alter table public.reminders
  add column snoozed_until_date date,
  add column snoozed_until_km integer
    check (snoozed_until_km is null or snoozed_until_km >= 0),
  add column completion_version integer not null default 0
    check (completion_version >= 0);

create index maintenance_records_plan_history_idx
  on public.maintenance_records(owner_id, motorcycle_id, lower(btrim(maintenance_type)), date desc, odometer_km desc);

create or replace function public.resolve_maintenance_plan_history()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare
  service public.maintenance_records%rowtype;
begin
  -- New plans still accept the established initial-history input contract.
  if tg_op = 'INSERT' then
    new.baseline_history_status := new.initial_history_status;
    new.baseline_last_done_km := new.last_done_km;
    new.baseline_last_done_date := new.last_done_date;
  end if;
  if new.baseline_history_status <> 'confirmed_done' then
    new.baseline_last_done_km := null;
    new.baseline_last_done_date := null;
  end if;
  new.initial_history_status := new.baseline_history_status;
  new.last_done_km := new.baseline_last_done_km;
  new.last_done_date := new.baseline_last_done_date;

  select r.* into service from public.maintenance_records r
    where r.owner_id = new.owner_id and r.motorcycle_id = new.motorcycle_id
      and lower(btrim(r.maintenance_type)) = lower(btrim(new.maintenance_type))
    order by r.date desc, r.odometer_km desc, r.created_at desc, r.id desc
    limit 1;
  if found and (
      new.baseline_history_status <> 'confirmed_done'
      or (new.baseline_last_done_date is not null and service.date > new.baseline_last_done_date)
      or (new.baseline_last_done_date is not null and service.date = new.baseline_last_done_date
          and (new.baseline_last_done_km is null or service.odometer_km >= new.baseline_last_done_km))
      or (new.baseline_last_done_date is null
          and (new.baseline_last_done_km is null or service.odometer_km >= new.baseline_last_done_km))
    ) then
    new.initial_history_status := 'confirmed_done';
    new.last_done_km := service.odometer_km;
    new.last_done_date := service.date;
  end if;
  return new;
end;
$$;

create trigger resolve_maintenance_plan_history
before insert or update on public.maintenance_plan_items
for each row execute function public.resolve_maintenance_plan_history();

create or replace function public.refresh_maintenance_record_plans()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if tg_op <> 'INSERT' then
    update public.maintenance_plan_items p set updated_at = now()
      where p.owner_id = old.owner_id and p.motorcycle_id = old.motorcycle_id
        and lower(btrim(p.maintenance_type)) = lower(btrim(old.maintenance_type));
  end if;
  if tg_op <> 'DELETE' then
    update public.maintenance_plan_items p set updated_at = now()
      where p.owner_id = new.owner_id and p.motorcycle_id = new.motorcycle_id
        and lower(btrim(p.maintenance_type)) = lower(btrim(new.maintenance_type));
  end if;
  return null;
end;
$$;

create trigger refresh_maintenance_record_plans
after insert or update or delete on public.maintenance_records
for each row execute function public.refresh_maintenance_record_plans();

create or replace function public.refresh_maintenance_plan_reminders()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare changed boolean;
begin
  if tg_op = 'DELETE' then
    update public.reminders set is_active = false, updated_at = now()
      where owner_id = old.owner_id and linked_plan_item_id = old.id;
    return old;
  end if;
  changed := new.last_done_km is distinct from old.last_done_km
    or new.last_done_date is distinct from old.last_done_date
    or new.initial_history_status is distinct from old.initial_history_status
    or new.interval_km is distinct from old.interval_km
    or new.interval_days is distinct from old.interval_days;
  update public.reminders r set
    motorcycle_id = new.motorcycle_id,
    title = 'Plano: ' || new.maintenance_type,
    trigger_type = (case when new.interval_km is not null and new.interval_days is not null then 'by_interval'
      when new.interval_km is not null then 'by_km' else 'by_date' end)::public.reminder_trigger_type,
    trigger_value_km = new.interval_km, trigger_value_days = new.interval_days,
    reference_km = new.last_done_km, reference_date = new.last_done_date,
    is_recurring = true,
    is_active = case when not new.is_active then false else r.is_active end,
    snoozed_until_date = case when changed then null else r.snoozed_until_date end,
    snoozed_until_km = case when changed then null else r.snoozed_until_km end,
    last_notified_at = case when changed then null else r.last_notified_at end,
    last_email_notified_at = case when changed then null else r.last_email_notified_at end,
    last_push_notified_at = case when changed then null else r.last_push_notified_at end,
    updated_at = now()
    where r.owner_id = new.owner_id and r.linked_plan_item_id = new.id;
  return new;
end;
$$;

create trigger refresh_maintenance_plan_reminders
after update on public.maintenance_plan_items
for each row execute function public.refresh_maintenance_plan_reminders();
create trigger retire_maintenance_plan_reminders
before delete on public.maintenance_plan_items
for each row execute function public.refresh_maintenance_plan_reminders();

-- Reconcile existing receipts too. The baseline copied above is retained.
update public.maintenance_plan_items set updated_at = now();
