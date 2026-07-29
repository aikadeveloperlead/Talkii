-- ============================================================================
-- Talkii — Scheduling (SCR-004 Agenda). calendars/appointments: tenant_id
-- directo (RLS directa). appointment_timeline: transitivo vía Appointment.
-- ============================================================================

create table if not exists public.calendars (
  id         uuid primary key,
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  name       text not null check (length(trim(name)) > 0),
  timezone   text not null,
  color      text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists calendars_tenant_id_idx on public.calendars(tenant_id);

create table if not exists public.appointments (
  id              uuid primary key,
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  calendar_id     uuid not null references public.calendars(id) on delete cascade,
  customer_id     uuid references public.customers(id) on delete set null,
  conversation_id uuid references public.conversations(id) on delete set null,
  title           text not null check (length(trim(title)) > 0),
  description     text,
  status          text not null check (status in ('scheduled', 'confirmed', 'cancelled', 'completed')),
  timezone        text not null,
  starts_at       timestamptz not null,
  ends_at         timestamptz not null check (ends_at > starts_at),
  deleted_at      timestamptz,
  created_at      timestamptz not null default now()
);
create index if not exists appointments_tenant_id_idx on public.appointments(tenant_id);
create index if not exists appointments_calendar_id_idx on public.appointments(calendar_id);
create index if not exists appointments_customer_id_idx on public.appointments(customer_id);
create index if not exists appointments_starts_at_idx on public.appointments(starts_at);

create table if not exists public.appointment_timeline (
  id             uuid primary key,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  type           text not null,
  payload        jsonb not null default '{}'::jsonb,
  occurred_at    timestamptz not null,
  created_at     timestamptz not null default now()
);
create index if not exists appointment_timeline_appointment_id_idx
  on public.appointment_timeline(appointment_id);

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.calendars           enable row level security;
alter table public.appointments        enable row level security;
alter table public.appointment_timeline enable row level security;

create policy calendars_isolation on public.calendars
  for all to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy appointments_isolation on public.appointments
  for all to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy appointment_timeline_isolation on public.appointment_timeline
  for all to authenticated
  using (exists (
    select 1 from public.appointments a
    where a.id = appointment_id and a.tenant_id = public.current_tenant_id()
  ))
  with check (exists (
    select 1 from public.appointments a
    where a.id = appointment_id and a.tenant_id = public.current_tenant_id()
  ));
