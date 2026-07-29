-- ============================================================================
-- Talkii — Webhooks & Integraciones (SCR-011). webhooks: tenant_id directo.
-- webhook_deliveries: transitivo vía Webhook. Sin retries/colas (spec §1.3).
-- ============================================================================

create table if not exists public.webhooks (
  id         uuid primary key,
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  name       text not null check (length(trim(name)) > 0),
  url        text not null check (url like 'https://%'),
  secret     text,
  events     jsonb not null default '[]'::jsonb,
  status     text not null check (status in ('active', 'disabled', 'archived')),
  created_at timestamptz not null default now()
);
create index if not exists webhooks_tenant_id_idx on public.webhooks(tenant_id);
create unique index if not exists webhooks_tenant_name_key on public.webhooks(tenant_id, name);
create index if not exists webhooks_status_idx on public.webhooks(status);

create table if not exists public.webhook_deliveries (
  id               uuid primary key,
  webhook_id       uuid not null references public.webhooks(id) on delete cascade,
  event_name       text not null,
  payload          jsonb not null default '{}'::jsonb,
  status           text not null check (status in ('pending', 'delivered', 'failed')),
  response_status  integer,
  response_time_ms integer,
  occurred_at      timestamptz not null,
  created_at       timestamptz not null default now()
);
create index if not exists webhook_deliveries_webhook_id_idx on public.webhook_deliveries(webhook_id);
create index if not exists webhook_deliveries_event_name_idx on public.webhook_deliveries(event_name);
create index if not exists webhook_deliveries_status_idx on public.webhook_deliveries(status);

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.webhooks           enable row level security;
alter table public.webhook_deliveries enable row level security;

create policy webhooks_isolation on public.webhooks
  for all to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy webhook_deliveries_isolation on public.webhook_deliveries
  for all to authenticated
  using (exists (
    select 1 from public.webhooks w
    where w.id = webhook_id and w.tenant_id = public.current_tenant_id()
  ))
  with check (exists (
    select 1 from public.webhooks w
    where w.id = webhook_id and w.tenant_id = public.current_tenant_id()
  ));
