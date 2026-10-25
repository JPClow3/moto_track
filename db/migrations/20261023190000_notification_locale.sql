alter table public.profiles
  add column preferred_locale text not null default 'pt-BR'
    check (preferred_locale in ('pt-BR', 'en'));
