-- ============================================================================
-- Talkii — Knowledge (SCR-009). tenant_id directo en categories/documents.
-- agent_knowledge: tabla de relación N:N (BK-05), aislamiento vía Agent.
-- Sin motor de embeddings (spec: "pertenece al documento de n8n", removido de
-- la arquitectura de Talkii) — status nunca llega a 'synced' por esta vía.
-- ============================================================================

create table if not exists public.knowledge_categories (
  id         uuid primary key,
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  name       text not null check (length(trim(name)) > 0),
  color      text,
  created_at timestamptz not null default now()
);
create index if not exists knowledge_categories_tenant_id_idx on public.knowledge_categories(tenant_id);

create table if not exists public.knowledge_documents (
  id          uuid primary key,
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  title       text not null check (length(trim(title)) > 0),
  category_id uuid references public.knowledge_categories(id) on delete set null,
  content     text not null check (length(trim(content)) > 0),
  source_type text not null check (source_type in ('text', 'file', 'url')),
  source_file text,
  status      text not null check (status in ('draft', 'pending', 'processing', 'synced', 'error', 'archived')),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists knowledge_documents_tenant_id_idx on public.knowledge_documents(tenant_id);
create index if not exists knowledge_documents_status_idx on public.knowledge_documents(status);
create index if not exists knowledge_documents_category_id_idx on public.knowledge_documents(category_id);

create table if not exists public.agent_knowledge (
  agent_id     uuid not null references public.agents(id) on delete cascade,
  knowledge_id uuid not null references public.knowledge_documents(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (agent_id, knowledge_id)
);

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.knowledge_categories enable row level security;
alter table public.knowledge_documents  enable row level security;
alter table public.agent_knowledge      enable row level security;

create policy knowledge_categories_isolation on public.knowledge_categories
  for all to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy knowledge_documents_isolation on public.knowledge_documents
  for all to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy agent_knowledge_isolation on public.agent_knowledge
  for all to authenticated
  using (exists (
    select 1 from public.agents a
    where a.id = agent_id and a.tenant_id = public.current_tenant_id()
  ))
  with check (exists (
    select 1 from public.agents a
    where a.id = agent_id and a.tenant_id = public.current_tenant_id()
  ));
