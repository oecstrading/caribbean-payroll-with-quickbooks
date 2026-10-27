create table public.paymaster_settings (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  enabled boolean not null default true,
  pay_day integer not null default 25 check (pay_day between 1 and 28),
  lead_days integer not null default 3 check (lead_days between 1 and 14),
  paused_reason text,
  lock_until timestamptz,
  last_run_at timestamptz,
  updated_at timestamptz not null default now()
);
create table public.paymaster_drafts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  pay_date date not null,
  status text not null default 'awaiting_review' check (status in ('awaiting_review','approved')),
  employee_count integer not null default 0,
  projected_gross numeric not null default 0,
  last_gross numeric,
  change_pct numeric,
  missing_punches integer not null default 0,
  pending_shifts integer not null default 0,
  active_loans integer not null default 0,
  loan_repayments numeric not null default 0,
  flags jsonb not null default '[]'::jsonb,
  suggestions jsonb not null default '[]'::jsonb,
  summary text,
  reminder_count integer not null default 0,
  last_reminded_at timestamptz,
  acknowledged_at timestamptz,
  approved_run_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, period_start, period_end)
);
alter table public.paymaster_settings enable row level security;
alter table public.paymaster_drafts enable row level security;
grant select, insert, update on public.paymaster_settings to authenticated;
grant select, update on public.paymaster_drafts to authenticated;
grant all on public.paymaster_settings, public.paymaster_drafts to service_role;
create policy "Payroll staff read paymaster settings" on public.paymaster_settings for select to authenticated
  using (org_id = public.current_org_id() and public.has_workspace_access(auth.uid(), 'payroll'));
create policy "Admins manage paymaster settings" on public.paymaster_settings for insert to authenticated
  with check (org_id = public.current_org_id() and public.has_role(auth.uid(), 'admin'));
create policy "Admins update paymaster settings" on public.paymaster_settings for update to authenticated
  using (org_id = public.current_org_id() and public.has_role(auth.uid(), 'admin'))
  with check (org_id = public.current_org_id() and public.has_role(auth.uid(), 'admin'));
create policy "Payroll staff read paymaster drafts" on public.paymaster_drafts for select to authenticated
  using (org_id = public.current_org_id() and public.has_workspace_access(auth.uid(), 'payroll') and public.is_admin_or_manager(auth.uid()));
create policy "Payroll managers acknowledge drafts" on public.paymaster_drafts for update to authenticated
  using (org_id = public.current_org_id() and public.has_workspace_access(auth.uid(), 'payroll') and public.is_admin_or_manager(auth.uid()))
  with check (org_id = public.current_org_id());
create or replace function public.protect_paymaster_draft() returns trigger language plpgsql set search_path = public as $$
begin
  if current_setting('request.jwt.claim.role', true) = 'service_role' or auth.uid() is null then return new; end if;
  -- browser users may only record that they have seen the reminder
  if row(new.status, new.projected_gross, new.flags, new.suggestions, new.summary, new.approved_run_id, new.org_id, new.reminder_count)
     is distinct from row(old.status, old.projected_gross, old.flags, old.suggestions, old.summary, old.approved_run_id, old.org_id, old.reminder_count) then
    raise exception 'Only the AI Paymaster can change draft figures; approve payroll on the Payroll page';
  end if;
  return new;
end $$;
create trigger protect_paymaster_draft before update on public.paymaster_drafts for each row execute function public.protect_paymaster_draft();