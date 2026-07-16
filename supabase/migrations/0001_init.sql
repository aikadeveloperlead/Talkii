-- ============================================================================
-- Talkii — Esquema inicial (SSOT Cap. 7: 7 entidades fundamentales)
-- PostgreSQL + Row Level Security (RLS) para aislamiento multi-tenant.
--
-- Modelo de aislamiento:
--   • Entidades que exponen tenant_id en el dominio (tenants, agents, funnels,
--     conversations) → columna tenant_id + RLS directa `tenant_id = current`.
--   • Entidades operativas (sessions, events, decisions) que NO exponen
--     tenant_id → RLS transitiva vía cadena EXISTS hacia la Conversation dueña.
--
-- El tenant activo se obtiene del JWT del usuario (claim app_metadata.tenant_id).
-- ============================================================================

-- Extensión para gen_random_uuid() (por si se generan IDs en la BD).
create extension if not exists "pgcrypto";

-- ── Helper: tenant activo desde el JWT ──────────────────────────────────────
-- Lee el claim `tenant_id` de app_metadata del JWT emitido por Supabase Auth.
create or replace function public.current_tenant_id()
returns uuid
language sql
stable
as $$
  select nullif(
    coalesce(
      current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id',
      current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id'
    ),
    ''
  )::uuid;
$$;

-- ── 1. Tenant (entidad raíz) ────────────────────────────────────────────────
create table if not exists public.tenants (
  id         uuid primary key,
  name       text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now()
);

-- ── 2. Agent (entidad estratégica) ──────────────────────────────────────────
create table if not exists public.agents (
  id               uuid primary key,
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  name             text not null,
  objective        text not null,
  permanent_prompt text not null,
  policies         jsonb not null default '[]'::jsonb,
  reasoning_profile text not null,
  created_at       timestamptz not null default now()
);
create index if not exists agents_tenant_id_idx on public.agents(tenant_id);

-- ── 3. Funnel (entidad estratégica) ─────────────────────────────────────────
create table if not exists public.funnels (
  id         uuid primary key,
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  name       text not null,
  stages     jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists funnels_tenant_id_idx on public.funnels(tenant_id);

-- ── 4. Conversation (entidad relacional) ────────────────────────────────────
create table if not exists public.conversations (
  id           uuid primary key,
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  channel      text not null check (channel in ('whatsapp')),
  participants jsonb not null default '[]'::jsonb,
  created_at   timestamptz not null default now()
);
create index if not exists conversations_tenant_id_idx on public.conversations(tenant_id);

-- ── 5. Session (entidad operativa) ──────────────────────────────────────────
create table if not exists public.sessions (
  id              uuid primary key,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  status          text not null check (status in ('active', 'closed')),
  dimensions      jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);
create index if not exists sessions_conversation_id_idx on public.sessions(conversation_id);

-- ── 6. Event (hecho consumado) ──────────────────────────────────────────────
create table if not exists public.events (
  id          uuid primary key,
  session_id  uuid not null references public.sessions(id) on delete cascade,
  type        text not null,
  occurred_at timestamptz not null,
  payload     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists events_session_id_idx on public.events(session_id);

-- ── 7. Decision (entidad de dominio) ────────────────────────────────────────
create table if not exists public.decisions (
  id         uuid primary key,
  session_id uuid not null references public.sessions(id) on delete cascade,
  event_id   uuid not null references public.events(id) on delete cascade,
  source     text not null,
  rationale  text not null,
  actions    jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists decisions_session_id_idx on public.decisions(session_id);

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.tenants       enable row level security;
alter table public.agents        enable row level security;
alter table public.funnels       enable row level security;
alter table public.conversations enable row level security;
alter table public.sessions      enable row level security;
alter table public.events        enable row level security;
alter table public.decisions     enable row level security;

-- Tenant: el usuario solo ve/gestiona su propio tenant.
create policy tenants_isolation on public.tenants
  for all to authenticated
  using (id = public.current_tenant_id())
  with check (id = public.current_tenant_id());

-- Agents / Funnels / Conversations: aislamiento directo por tenant_id.
create policy agents_isolation on public.agents
  for all to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy funnels_isolation on public.funnels
  for all to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy conversations_isolation on public.conversations
  for all to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- Sessions: aislamiento transitivo vía la Conversation dueña.
create policy sessions_isolation on public.sessions
  for all to authenticated
  using (exists (
    select 1 from public.conversations c
    where c.id = conversation_id and c.tenant_id = public.current_tenant_id()
  ))
  with check (exists (
    select 1 from public.conversations c
    where c.id = conversation_id and c.tenant_id = public.current_tenant_id()
  ));

-- Events: aislamiento transitivo vía Session → Conversation.
create policy events_isolation on public.events
  for all to authenticated
  using (exists (
    select 1 from public.sessions s
    join public.conversations c on c.id = s.conversation_id
    where s.id = session_id and c.tenant_id = public.current_tenant_id()
  ))
  with check (exists (
    select 1 from public.sessions s
    join public.conversations c on c.id = s.conversation_id
    where s.id = session_id and c.tenant_id = public.current_tenant_id()
  ));

-- Decisions: aislamiento transitivo vía Session → Conversation.
create policy decisions_isolation on public.decisions
  for all to authenticated
  using (exists (
    select 1 from public.sessions s
    join public.conversations c on c.id = s.conversation_id
    where s.id = session_id and c.tenant_id = public.current_tenant_id()
  ))
  with check (exists (
    select 1 from public.sessions s
    join public.conversations c on c.id = s.conversation_id
    where s.id = session_id and c.tenant_id = public.current_tenant_id()
  ));
