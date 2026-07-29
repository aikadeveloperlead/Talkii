-- ============================================================================
-- Talkii — CRM (SCR-003): implementación propietaria de la Tool UpdateCustomer
-- (Documento Maestro del Dominio: "CRM propietario" es una implementación
-- válida de la capability "gestionar clientes", junto a HubSpot/Salesforce/
-- Zoho — el dominio depende de la Tool abstracta, nunca de estas tablas).
--
-- customers: tenant_id directo (RLS directa, igual que agents/funnels).
-- leads / customer_timeline: sin tenant_id propio, aislamiento transitivo vía
-- Customer (mismo patrón que sessions/events -> conversations).
-- ============================================================================

create table if not exists public.customers (
  id          uuid primary key,
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  first_name  text not null check (length(trim(first_name)) > 0),
  last_name   text,
  phone       text,
  email       text,
  company     text,
  position    text,
  city        text,
  country     text,
  tags        jsonb not null default '[]'::jsonb,
  archived_at timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists customers_tenant_id_idx on public.customers(tenant_id);
-- Teléfono único por Tenant (SCR-003 §7 Validaciones), solo para filas con teléfono.
create unique index if not exists customers_tenant_phone_key
  on public.customers(tenant_id, phone)
  where phone is not null;

create table if not exists public.leads (
  id          uuid primary key,
  customer_id uuid not null references public.customers(id) on delete cascade,
  status      text not null check (status in ('new', 'contacted', 'qualified', 'won', 'lost')),
  score       numeric not null default 0 check (score >= 0),
  priority    text,
  owner_id    uuid,
  created_at  timestamptz not null default now()
);
-- Un Customer tiene a lo sumo un Lead (SCR-003: alta 1:1 vía Trigger 2).
create unique index if not exists leads_customer_id_key on public.leads(customer_id);

create table if not exists public.customer_timeline (
  id          uuid primary key,
  customer_id uuid not null references public.customers(id) on delete cascade,
  type        text not null,
  payload     jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null,
  created_at  timestamptz not null default now()
);
create index if not exists customer_timeline_customer_id_idx
  on public.customer_timeline(customer_id);

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.customers        enable row level security;
alter table public.leads            enable row level security;
alter table public.customer_timeline enable row level security;

create policy customers_isolation on public.customers
  for all to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy leads_isolation on public.leads
  for all to authenticated
  using (exists (
    select 1 from public.customers c
    where c.id = customer_id and c.tenant_id = public.current_tenant_id()
  ))
  with check (exists (
    select 1 from public.customers c
    where c.id = customer_id and c.tenant_id = public.current_tenant_id()
  ));

create policy customer_timeline_isolation on public.customer_timeline
  for all to authenticated
  using (exists (
    select 1 from public.customers c
    where c.id = customer_id and c.tenant_id = public.current_tenant_id()
  ))
  with check (exists (
    select 1 from public.customers c
    where c.id = customer_id and c.tenant_id = public.current_tenant_id()
  ));
