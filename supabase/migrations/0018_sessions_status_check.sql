-- ============================================================================
-- Talkii — CHECK constraint que garantiza que sessions.status (columna,
-- usada por el índice de findActiveByConversation) y
-- dimensions.state.status (jsonb, fuente que lee la reconstrucción de
-- dominio) nunca puedan divergir (hallazgo MEDIO de auditoría:
-- "Divergencia de fuente de verdad en sessions.status" — hoy el mapper
-- (sessionToRow) siempre escribe ambos juntos, pero nada en el schema lo
-- garantizaba; cualquier escritura futura que no pase por el mapper —una
-- migración de datos a mano, un script— podría desincronizarlas en
-- silencio). Se refuerza a nivel de base de datos en vez de confiar en que
-- "hoy solo hay un código que escribe".
-- ============================================================================

alter table public.sessions
  add constraint sessions_status_matches_dimensions
  check (status = (dimensions -> 'state' ->> 'status'));
