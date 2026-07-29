-- ============================================================================
-- Talkii — SCR-012 Configuración: extiende `tenants` (migración 0001,
-- "Workspace" en la UI) y agrega companies/preferences (1:1 con Tenant).
-- Users/Roles quedan explícitamente fuera (ver comentario en
-- src/domain/identity-access/tenant.ts): la arquitectura de auth actual es
-- 1 usuario Supabase ↔ 1 tenant_id, sin invitaciones ni roles.
-- ============================================================================

alter table public.tenants
  add column if not exists description text,
  add column if not exists logo text,
  add column if not exists status text not null default 'active'
    check (status in ('active', 'suspended', 'archived'));

create table if not exists public.companies (
  id            uuid primary key,
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  business_name text not null check (length(trim(business_name)) > 0),
  legal_name    text,
  tax_id        text,
  email         text,
  phone         text,
  website       text,
  created_at    timestamptz not null default now()
);
create unique index if not exists companies_tenant_id_key on public.companies(tenant_id);

create table if not exists public.preferences (
  id          uuid primary key,
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  language    text not null default 'es',
  timezone    text not null default 'UTC',
  currency    text not null default 'USD',
  date_format text not null default 'DD/MM/YYYY',
  created_at  timestamptz not null default now()
);
create unique index if not exists preferences_tenant_id_key on public.preferences(tenant_id);

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.companies   enable row level security;
alter table public.preferences enable row level security;

create policy companies_isolation on public.companies
  for all to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy preferences_isolation on public.preferences
  for all to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());
