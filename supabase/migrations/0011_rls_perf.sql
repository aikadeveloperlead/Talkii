-- ============================================================================
-- Talkii — RLS perf (hallazgo crítico de auditoría, 2026-07-29)
--
-- Las 22 políticas RLS creadas en 0001-0010 llaman public.current_tenant_id()
-- sin envolver en (select ...). Aunque la función es STABLE, sin el (select)
-- Postgres la re-evalúa fila por fila en vez de una sola vez por query (el
-- optimizador solo la trata como InitPlan cacheable cuando aparece dentro de
-- un subselect) — patrón documentado por Supabase para RLS a escala.
--
-- No se editan las migraciones ya aplicadas (regla del proyecto): se
-- reemplaza cada política por una equivalente, drop + create, solo con esa
-- envoltura — la lógica de aislamiento no cambia.
-- ============================================================================

-- ── 0001: núcleo (tenants, agents, funnels, conversations, sessions, events, decisions) ──

drop policy if exists tenants_isolation on public.tenants;
create policy tenants_isolation on public.tenants
  for all to authenticated
  using (id = (select public.current_tenant_id()))
  with check (id = (select public.current_tenant_id()));

drop policy if exists agents_isolation on public.agents;
create policy agents_isolation on public.agents
  for all to authenticated
  using (tenant_id = (select public.current_tenant_id()))
  with check (tenant_id = (select public.current_tenant_id()));

drop policy if exists funnels_isolation on public.funnels;
create policy funnels_isolation on public.funnels
  for all to authenticated
  using (tenant_id = (select public.current_tenant_id()))
  with check (tenant_id = (select public.current_tenant_id()));

drop policy if exists conversations_isolation on public.conversations;
create policy conversations_isolation on public.conversations
  for all to authenticated
  using (tenant_id = (select public.current_tenant_id()))
  with check (tenant_id = (select public.current_tenant_id()));

drop policy if exists sessions_isolation on public.sessions;
create policy sessions_isolation on public.sessions
  for all to authenticated
  using (exists (
    select 1 from public.conversations c
    where c.id = conversation_id and c.tenant_id = (select public.current_tenant_id())
  ))
  with check (exists (
    select 1 from public.conversations c
    where c.id = conversation_id and c.tenant_id = (select public.current_tenant_id())
  ));

drop policy if exists events_isolation on public.events;
create policy events_isolation on public.events
  for all to authenticated
  using (exists (
    select 1 from public.sessions s
    join public.conversations c on c.id = s.conversation_id
    where s.id = session_id and c.tenant_id = (select public.current_tenant_id())
  ))
  with check (exists (
    select 1 from public.sessions s
    join public.conversations c on c.id = s.conversation_id
    where s.id = session_id and c.tenant_id = (select public.current_tenant_id())
  ));

drop policy if exists decisions_isolation on public.decisions;
create policy decisions_isolation on public.decisions
  for all to authenticated
  using (exists (
    select 1 from public.sessions s
    join public.conversations c on c.id = s.conversation_id
    where s.id = session_id and c.tenant_id = (select public.current_tenant_id())
  ))
  with check (exists (
    select 1 from public.sessions s
    join public.conversations c on c.id = s.conversation_id
    where s.id = session_id and c.tenant_id = (select public.current_tenant_id())
  ));

-- ── 0002: channel_bindings ───────────────────────────────────────────────────

drop policy if exists channel_bindings_isolation on public.channel_bindings;
create policy channel_bindings_isolation on public.channel_bindings
  for all to authenticated
  using (tenant_id = (select public.current_tenant_id()))
  with check (tenant_id = (select public.current_tenant_id()));

-- ── 0003: CRM (customers, leads, customer_timeline) ─────────────────────────

drop policy if exists customers_isolation on public.customers;
create policy customers_isolation on public.customers
  for all to authenticated
  using (tenant_id = (select public.current_tenant_id()))
  with check (tenant_id = (select public.current_tenant_id()));

drop policy if exists leads_isolation on public.leads;
create policy leads_isolation on public.leads
  for all to authenticated
  using (exists (
    select 1 from public.customers c
    where c.id = customer_id and c.tenant_id = (select public.current_tenant_id())
  ))
  with check (exists (
    select 1 from public.customers c
    where c.id = customer_id and c.tenant_id = (select public.current_tenant_id())
  ));

drop policy if exists customer_timeline_isolation on public.customer_timeline;
create policy customer_timeline_isolation on public.customer_timeline
  for all to authenticated
  using (exists (
    select 1 from public.customers c
    where c.id = customer_id and c.tenant_id = (select public.current_tenant_id())
  ))
  with check (exists (
    select 1 from public.customers c
    where c.id = customer_id and c.tenant_id = (select public.current_tenant_id())
  ));

-- ── 0004: Scheduling (calendars, appointments, appointment_timeline) ────────

drop policy if exists calendars_isolation on public.calendars;
create policy calendars_isolation on public.calendars
  for all to authenticated
  using (tenant_id = (select public.current_tenant_id()))
  with check (tenant_id = (select public.current_tenant_id()));

drop policy if exists appointments_isolation on public.appointments;
create policy appointments_isolation on public.appointments
  for all to authenticated
  using (tenant_id = (select public.current_tenant_id()))
  with check (tenant_id = (select public.current_tenant_id()));

drop policy if exists appointment_timeline_isolation on public.appointment_timeline;
create policy appointment_timeline_isolation on public.appointment_timeline
  for all to authenticated
  using (exists (
    select 1 from public.appointments a
    where a.id = appointment_id and a.tenant_id = (select public.current_tenant_id())
  ))
  with check (exists (
    select 1 from public.appointments a
    where a.id = appointment_id and a.tenant_id = (select public.current_tenant_id())
  ));

-- ── 0005: whatsapp_templates ─────────────────────────────────────────────────

drop policy if exists whatsapp_templates_isolation on public.whatsapp_templates;
create policy whatsapp_templates_isolation on public.whatsapp_templates
  for all to authenticated
  using (tenant_id = (select public.current_tenant_id()))
  with check (tenant_id = (select public.current_tenant_id()));

-- ── 0007: Knowledge (categories, documents, agent_knowledge) ────────────────

drop policy if exists knowledge_categories_isolation on public.knowledge_categories;
create policy knowledge_categories_isolation on public.knowledge_categories
  for all to authenticated
  using (tenant_id = (select public.current_tenant_id()))
  with check (tenant_id = (select public.current_tenant_id()));

drop policy if exists knowledge_documents_isolation on public.knowledge_documents;
create policy knowledge_documents_isolation on public.knowledge_documents
  for all to authenticated
  using (tenant_id = (select public.current_tenant_id()))
  with check (tenant_id = (select public.current_tenant_id()));

drop policy if exists agent_knowledge_isolation on public.agent_knowledge;
create policy agent_knowledge_isolation on public.agent_knowledge
  for all to authenticated
  using (exists (
    select 1 from public.agents a
    where a.id = agent_id and a.tenant_id = (select public.current_tenant_id())
  ))
  with check (exists (
    select 1 from public.agents a
    where a.id = agent_id and a.tenant_id = (select public.current_tenant_id())
  ));

-- ── 0009: Webhooks (webhooks, webhook_deliveries) ────────────────────────────

drop policy if exists webhooks_isolation on public.webhooks;
create policy webhooks_isolation on public.webhooks
  for all to authenticated
  using (tenant_id = (select public.current_tenant_id()))
  with check (tenant_id = (select public.current_tenant_id()));

drop policy if exists webhook_deliveries_isolation on public.webhook_deliveries;
create policy webhook_deliveries_isolation on public.webhook_deliveries
  for all to authenticated
  using (exists (
    select 1 from public.webhooks w
    where w.id = webhook_id and w.tenant_id = (select public.current_tenant_id())
  ))
  with check (exists (
    select 1 from public.webhooks w
    where w.id = webhook_id and w.tenant_id = (select public.current_tenant_id())
  ));

-- ── 0010: Administration (companies, preferences) ────────────────────────────

drop policy if exists companies_isolation on public.companies;
create policy companies_isolation on public.companies
  for all to authenticated
  using (tenant_id = (select public.current_tenant_id()))
  with check (tenant_id = (select public.current_tenant_id()));

drop policy if exists preferences_isolation on public.preferences;
create policy preferences_isolation on public.preferences
  for all to authenticated
  using (tenant_id = (select public.current_tenant_id()))
  with check (tenant_id = (select public.current_tenant_id()));
