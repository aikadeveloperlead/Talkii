-- ============================================================================
-- Talkii — a lo sumo una Session activa por Conversation (item 10 de la
-- auditoría, sub-item 5/5, 2026-07-30). Hallazgo ALTO: "condición de carrera
-- puede duplicar Sessions activas". Root cause: resolveActiveSession
-- (HandleInboundMessage) hace check-then-insert — `findActiveByConversation`
-- seguido de `sessions.save(Session.open(...))` sin ninguna garantía atómica
-- contra otra request concurrente sobre la misma Conversation (dos mensajes
-- casi simultáneos, o un reintento del webhook de Meta llegando en paralelo
-- al procesamiento normal). Mismo patrón que appointments_no_overlap
-- (0013): el check en application nunca es atómico, el fix real vive en DB.
--
-- Índice único parcial (no EXCLUDE — es igualdad simple, no solape de
-- rangos): a lo sumo una fila con status='active' por conversation_id.
-- ============================================================================

create unique index if not exists sessions_one_active_per_conversation
  on public.sessions(conversation_id)
  where status = 'active';
