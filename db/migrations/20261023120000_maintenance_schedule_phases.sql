-- Fixed manufacturer milestones use age from ORIGINAL entry into service,
-- never the used-bike purchase date or a guessed date from current mileage.
alter table public.motorcycles add column in_service_date date;
alter table public.motorcycle_template_maintenance_items
  add column schedule_milestones jsonb not null default '[]'::jsonb
    check (jsonb_typeof(schedule_milestones) = 'array'),
  add column recurrence_km integer check (recurrence_km is null or recurrence_km > 0),
  add column recurrence_months integer check (recurrence_months is null or recurrence_months > 0);
alter table public.maintenance_plan_items
  add column schedule_milestones jsonb not null default '[]'::jsonb
    check (jsonb_typeof(schedule_milestones) = 'array'),
  add column recurrence_km integer check (recurrence_km is null or recurrence_km > 0),
  add column recurrence_months integer check (recurrence_months is null or recurrence_months > 0),
  add column baseline_completed_milestone integer check (baseline_completed_milestone is null or baseline_completed_milestone >= 0),
  add column last_completed_milestone integer check (last_completed_milestone is null or last_completed_milestone >= 0);
alter table public.maintenance_records
  add column maintenance_plan_item_id uuid references public.maintenance_plan_items(id) on delete set null,
  add column completed_milestone integer check (completed_milestone is null or completed_milestone >= 1);

create or replace function public.maintenance_schedule_target(stages jsonb, repeat_km integer, repeat_months integer, completed integer)
returns table (next_milestone integer, due_km integer, due_months integer)
language sql immutable set search_path = public, pg_temp as $$
  select completed + 1,
    case when completed < jsonb_array_length(stages) then (stages -> completed ->> 'km')::integer
      when repeat_km is not null then (stages -> -1 ->> 'km')::integer
        + (completed + 1 - jsonb_array_length(stages)) * repeat_km end,
    case when completed < jsonb_array_length(stages) then (stages -> completed ->> 'months')::integer
      when repeat_months is not null then (stages -> -1 ->> 'months')::integer
        + (completed + 1 - jsonb_array_length(stages)) * repeat_months end
  where completed is not null and completed >= 0 and jsonb_array_length(stages) > 0;
$$;

create or replace function public.resolve_maintenance_plan_history()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare
  service public.maintenance_records%rowtype;
  recorded_phase integer;
begin
  if tg_op = 'INSERT' then
    new.baseline_history_status := new.initial_history_status;
    new.baseline_last_done_km := new.last_done_km;
    new.baseline_last_done_date := new.last_done_date;
    new.baseline_completed_milestone := new.last_completed_milestone;
  end if;
  if new.baseline_history_status <> 'confirmed_done' then
    new.baseline_last_done_km := null;
    new.baseline_last_done_date := null;
    new.baseline_completed_milestone := case when new.baseline_history_status = 'not_done' then 0 else null end;
  end if;
  new.initial_history_status := new.baseline_history_status;
  new.last_done_km := new.baseline_last_done_km;
  new.last_done_date := new.baseline_last_done_date;
  new.last_completed_milestone := new.baseline_completed_milestone;
  select r.* into service from public.maintenance_records r
    where r.owner_id = new.owner_id and r.motorcycle_id = new.motorcycle_id
      and lower(btrim(r.maintenance_type)) = lower(btrim(new.maintenance_type))
    order by r.date desc, r.odometer_km desc, r.created_at desc, r.id desc limit 1;
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
  -- Only explicitly identified reviews establish a phase. Mileage alone cannot
  -- distinguish an early age-based review from an overdue first review.
  select max(r.completed_milestone) into recorded_phase from public.maintenance_records r
    where r.owner_id = new.owner_id and r.motorcycle_id = new.motorcycle_id
      and r.maintenance_plan_item_id = new.id;
  new.last_completed_milestone := greatest(new.baseline_completed_milestone, recorded_phase);
  return new;
end;
$$;

create or replace function public.validate_maintenance_record_phase()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if new.maintenance_plan_item_id is not null and not exists (
    select 1 from public.maintenance_plan_items p where p.id = new.maintenance_plan_item_id
      and p.owner_id = new.owner_id and p.motorcycle_id = new.motorcycle_id
      and lower(btrim(p.maintenance_type)) = lower(btrim(new.maintenance_type))
  ) then raise exception 'Maintenance review must belong to this owner, motorcycle and service type'; end if;
  return new;
end;
$$;
create trigger validate_maintenance_record_phase
before insert or update on public.maintenance_records
for each row execute function public.validate_maintenance_record_phase();

create or replace function public.refresh_maintenance_plan_reminders()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare
  changed boolean;
  phase record;
  target_km integer;
  target_date date;
  phased boolean;
begin
  if tg_op = 'DELETE' then
    update public.reminders set is_active = false, updated_at = now()
      where owner_id = old.owner_id and linked_plan_item_id = old.id;
    return old;
  end if;
  phased := jsonb_array_length(new.schedule_milestones) > 0;
  if phased then
    select * into phase from public.maintenance_schedule_target(new.schedule_milestones,
      new.recurrence_km, new.recurrence_months, new.last_completed_milestone);
    target_km := phase.due_km;
    select (m.in_service_date + make_interval(months => phase.due_months))::date into target_date
      from public.motorcycles m where m.id = new.motorcycle_id and m.owner_id = new.owner_id;
  else
    target_km := case when new.last_done_km is not null then new.last_done_km + new.interval_km end;
    target_date := new.last_done_date + new.interval_days;
  end if;
  changed := new.last_done_km is distinct from old.last_done_km
    or new.last_done_date is distinct from old.last_done_date
    or new.initial_history_status is distinct from old.initial_history_status
    or new.interval_km is distinct from old.interval_km
    or new.interval_days is distinct from old.interval_days
    or new.last_completed_milestone is distinct from old.last_completed_milestone
    or new.schedule_milestones is distinct from old.schedule_milestones
    or new.recurrence_km is distinct from old.recurrence_km
    or new.recurrence_months is distinct from old.recurrence_months;
  update public.reminders r set
    motorcycle_id = new.motorcycle_id, title = 'Plano: ' || new.maintenance_type,
    trigger_type = (case when phased then 'by_interval'
      when new.interval_km is not null and new.interval_days is not null then 'by_interval'
      when new.interval_km is not null then 'by_km' else 'by_date' end)::public.reminder_trigger_type,
    trigger_value_km = case when phased then target_km else new.interval_km end,
    trigger_value_days = case when phased then 0 else new.interval_days end,
    reference_km = case when phased and target_km is not null then 0 when phased then null else new.last_done_km end,
    reference_date = case when phased then target_date else new.last_done_date end,
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

create or replace function public.refresh_in_service_schedules()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if new.in_service_date is distinct from old.in_service_date then
    update public.maintenance_plan_items set updated_at = now()
      where owner_id = new.owner_id and motorcycle_id = new.id and jsonb_array_length(schedule_milestones) > 0;
  end if;
  return new;
end;
$$;
create trigger refresh_in_service_schedules after update of in_service_date on public.motorcycles
for each row execute function public.refresh_in_service_schedules();
