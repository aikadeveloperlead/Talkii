-- ============================================================================
-- Talkii — Templates (SCR-006 Plantillas WhatsApp/Meta). tenant_id directo
-- (RLS directa, igual que agents/funnels). Solo ciclo Draft local; los
-- estados sincronizados desde Meta (approved/rejected/paused/disabled) y la
-- sincronización en sí quedan fuera de esta pasada (sin credenciales/spec).
-- ============================================================================

create table if not exists public.whatsapp_templates (
  id             uuid primary key,
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  name           text not null check (length(trim(name)) > 0),
  language       text not null,
  category       text not null check (category in ('MARKETING', 'UTILITY', 'AUTHENTICATION')),
  header_type    text,
  header_content text,
  body           text not null check (length(trim(body)) > 0),
  footer         text,
  buttons        jsonb not null default '[]'::jsonb,
  status         text not null check (status in ('draft', 'pending_review', 'approved', 'rejected', 'paused', 'disabled')),
  quality_rating text,
  version        integer not null default 1 check (version >= 1),
  archived_at    timestamptz,
  created_at     timestamptz not null default now()
);
create index if not exists whatsapp_templates_tenant_id_idx on public.whatsapp_templates(tenant_id);

alter table public.whatsapp_templates enable row level security;

create policy whatsapp_templates_isolation on public.whatsapp_templates
  for all to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());
