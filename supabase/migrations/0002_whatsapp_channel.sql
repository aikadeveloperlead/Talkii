-- ============================================================================
-- Talkii — Canal WhatsApp Cloud API
--   1. channel_bindings: mapea el número de WhatsApp (phone_number_id de Meta)
--      al Tenant/Agent que lo atiende. Recurso de configuración del Tenant
--      (capacidad, no entidad del núcleo — SSOT Cap. 7 cierra las 7 entidades).
--   2. events.external_id: identidad del hecho en el sistema origen (wamid).
--      Índice único parcial → idempotencia ante reintentos del webhook.
--   3. Índice GIN sobre conversations.participants para find-by-handle.
-- ============================================================================

-- ── 1. channel_bindings ─────────────────────────────────────────────────────
create table if not exists public.channel_bindings (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  channel      text not null check (channel in ('whatsapp')),
  external_id  text not null,  -- phone_number_id de Meta
  agent_id     uuid not null references public.agents(id) on delete cascade,
  funnel_id    uuid references public.funnels(id) on delete set null,
  access_token text,           -- si es null, se usa WHATSAPP_ACCESS_TOKEN global
  created_at   timestamptz not null default now(),
  unique (channel, external_id)
);
create index if not exists channel_bindings_tenant_id_idx
  on public.channel_bindings(tenant_id);

alter table public.channel_bindings enable row level security;

-- El usuario gestiona solo los bindings de su tenant. El webhook accede con
-- service role (salta RLS): el aislamiento allí lo da la resolución
-- binding → tenant, no la política.
create policy channel_bindings_isolation on public.channel_bindings
  for all to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- ── 2. events.external_id ──────────────────────────────────────────────────
alter table public.events add column if not exists external_id text;
create unique index if not exists events_external_id_key
  on public.events(external_id)
  where external_id is not null;

-- ── 3. Búsqueda de Conversation por participante ────────────────────────────
create index if not exists conversations_participants_gin
  on public.conversations using gin (participants jsonb_path_ops);
