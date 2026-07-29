-- ============================================================================
-- Talkii — SCR-008 Agentes IA: extiende `agents` (migración 0001) con los
-- campos de persona/negocio/mensajes de las pestañas General/Mensajes/
-- Captura de Datos. Deliberadamente NO incluye columnas de proveedor de IA
-- (model/api_provider/api_key/temperature/max_tokens) — eso vive a nivel de
-- infraestructura (reasoningProfile ya es la referencia abstracta, AA-02).
-- Todas las columnas nuevas son opcionales para no romper filas existentes.
-- ============================================================================

alter table public.agents
  add column if not exists status text not null default 'active'
    check (status in ('draft', 'active', 'disabled', 'archived')),
  add column if not exists role text,
  add column if not exists personality text,
  add column if not exists language text,
  add column if not exists tone text,
  add column if not exists business_name text,
  add column if not exists business_description text,
  add column if not exists products_services text,
  add column if not exists business_type text,
  add column if not exists welcome_message text,
  add column if not exists fallback_message text,
  add column if not exists transfer_keywords jsonb not null default '[]'::jsonb,
  add column if not exists capture_fields jsonb not null default '[]'::jsonb;

-- Nombre único por Tenant (SCR-008 BK-02).
create unique index if not exists agents_tenant_name_key on public.agents(tenant_id, name);
create index if not exists agents_status_idx on public.agents(status);
