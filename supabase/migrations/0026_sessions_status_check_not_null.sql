-- Hallazgo MEDIUM de la auditoria adversarial santa-loop: el CHECK que
-- 0018_sessions_status_check.sql agrego para impedir que `sessions.status`
-- diverja de `dimensions.state.status` es NULL-permisivo, asi que NO cubre
-- el caso que la propia migracion decia querer cerrar ("una migracion de
-- datos a mano, un script").
--
-- Verificado empiricamente contra el proyecto remoto antes de escribir este
-- fix:
--   select ('active' = ('{}'::jsonb -> 'state' ->> 'status')) is null;  --> true
-- Con `dimensions = '{}'` (que es el DEFAULT de la columna en 0001_init.sql)
-- el lado derecho es NULL, el predicado entero evalua a NULL, y Postgres
-- considera SATISFECHO cualquier CHECK que no evalue explicitamente a FALSE.
-- Un INSERT directo con el default pasaba sin objecion.
--
-- `is not distinct from` compara tratando NULL como un valor mas (NULL vs
-- 'active' -> false, no NULL), y el `is not null` explicito rechaza que
-- dimensions.state.status falte del todo.

alter table public.sessions
  drop constraint if exists sessions_status_matches_dimensions;

alter table public.sessions
  add constraint sessions_status_matches_dimensions
  check (
    dimensions -> 'state' ->> 'status' is not null
    and status is not distinct from (dimensions -> 'state' ->> 'status')
  );
