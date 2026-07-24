-- NOTE (Neon migration): the original migration enabled RLS on
-- legacy_id_map/site_settings/motorcycle_templates/motorcycle_template_specs/
-- billing_events and added "authenticated read" policies on the template
-- tables. No RLS on Neon (app-layer owner filtering replaces it), so those
-- ALTER TABLE ... ENABLE ROW LEVEL SECURITY and CREATE POLICY statements
-- were dropped. Read access to the template tables is unrestricted at the
-- SQL layer here; the app queries them directly without an owner filter,
-- same as the old "authenticated read" policies allowed for any logged-in
-- user.
--
-- It also revoked EXECUTE on `handle_new_user()` from public/anon/authenticated
-- and pinned `search_path` on `set_updated_at()` and
-- `adjust_maintenance_part_stock()`. `handle_new_user()` and
-- `adjust_maintenance_part_stock()` no longer exist (dropped earlier in this
-- translated migration set — see 20260715001617_initial_schema.sql and
-- 20260715001723_parity_workflows.sql), so the revokes/alters targeting them
-- were dropped too (they'd error against a missing function). The
-- search_path pin on `set_updated_at()`, which we keep, is preserved below.

alter function public.set_updated_at() set search_path = public;
