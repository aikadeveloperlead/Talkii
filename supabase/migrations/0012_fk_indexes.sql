-- ============================================================================
-- Talkii — Índices de cobertura para FKs sin índice (item 7 del orden de
-- corrección de la auditoría, 2026-07-30). `get_advisors` performance tras el
-- fix RLS (0011) reporta 5 `unindexed_foreign_keys` (INFO) exactas:
--   agent_knowledge.knowledge_id, appointments.conversation_id,
--   channel_bindings.agent_id, channel_bindings.funnel_id,
--   decisions.event_id.
-- No se editan migraciones ya aplicadas (regla del proyecto): índices nuevos.
-- ============================================================================

create index if not exists agent_knowledge_knowledge_id_idx
  on public.agent_knowledge(knowledge_id);

create index if not exists appointments_conversation_id_idx
  on public.appointments(conversation_id);

create index if not exists channel_bindings_agent_id_idx
  on public.channel_bindings(agent_id);

create index if not exists channel_bindings_funnel_id_idx
  on public.channel_bindings(funnel_id);

create index if not exists decisions_event_id_idx
  on public.decisions(event_id);
