-- Production entitlements must never be granted by test-mode subscriptions.
-- A disposable test database may explicitly set this singleton to test_mode.
-- Application bindings and the stored provider environment must both agree
-- with this policy. User-facing routes never write this configuration.
create table if not exists public.billing_configuration (
  id integer primary key default 1 check (id = 1),
  environment text not null default 'live_mode'
    check (environment in ('test_mode', 'live_mode'))
);
insert into public.billing_configuration (id) values (1) on conflict do nothing;

create or replace function public.owner_has_pro_access(p_owner uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.subscription_profiles sp
    join public.billing_configuration configuration on configuration.id = 1
    where sp.owner_id = p_owner and sp.plan = 'pro'
      and (
        (sp.billing_provider = 'dodo'
          and sp.billing_environment = configuration.environment
          and (
            sp.billing_subscription_status in ('active', 'trialing')
            or (sp.grace_until is not null and sp.grace_until >= now())
          ))
        or (sp.billing_provider = 'legacy'
          and sp.grace_until is not null and sp.grace_until >= now())
      )
  );
$$;
revoke all on function public.owner_has_pro_access(uuid) from public;
