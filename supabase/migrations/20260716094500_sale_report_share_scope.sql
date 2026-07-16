alter table public.sale_report_shares
  add column scope text not null default 'sale'
    check (scope in ('sale', 'maintenance'));
