-- Calendar subscription clients do not share the owner's browser locale.
-- Capture the language selected by the owner when issuing the bearer feed.
-- Existing feeds retain the previously published Portuguese descriptions.
alter table public.calendar_feeds
  add column if not exists locale text not null default 'pt-BR'
    check (locale in ('pt-BR', 'en'));
