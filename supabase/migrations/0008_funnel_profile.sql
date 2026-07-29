-- ============================================================================
-- Talkii — SCR-010 Funnel: extiende `funnels` (migración 0001) y `agents`
-- (0001+0006) con los campos del spec. FN-02 ("el Agent solo referencia un
-- Funnel") se modela como FK simple en agents.funnel_id, no como tabla N:N.
-- ============================================================================

alter table public.funnels
  add column if not exists description text,
  add column if not exists template_id uuid,
  add column if not exists ads_attribution boolean not null default false,
  add column if not exists status text not null default 'draft'
    check (status in ('draft', 'active', 'archived'));

create unique index if not exists funnels_tenant_name_key on public.funnels(tenant_id, name);
create index if not exists funnels_status_idx on public.funnels(status);

alter table public.agents
  add column if not exists funnel_id uuid references public.funnels(id) on delete set null;
create index if not exists agents_funnel_id_idx on public.agents(funnel_id);
