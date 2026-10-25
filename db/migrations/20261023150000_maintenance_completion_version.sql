-- A rendered completion must not advance a review after another service changes its plan.
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
    select case when new.calendar_anchor_mode = 'last_service' and new.last_completed_milestone > 0
        then (new.last_done_date + make_interval(months => new.recurrence_months))::date
        else (m.in_service_date + make_interval(months => phase.due_months))::date end into target_date
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
    or new.recurrence_months is distinct from old.recurrence_months
    or new.calendar_anchor_mode is distinct from old.calendar_anchor_mode;
  if phased then
    changed := changed or exists (
      select 1 from public.reminders r where r.owner_id = new.owner_id and r.linked_plan_item_id = new.id
        and (r.reference_date is distinct from target_date or r.trigger_value_km is distinct from target_km)
    );
  end if;
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
    completion_version = case when changed then r.completion_version + 1 else r.completion_version end,
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

