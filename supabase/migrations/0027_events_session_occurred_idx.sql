-- Hallazgo HIGH de la auditoria adversarial santa-loop: `MakeDecision.buildHistory`
-- y `ListConversationMessages` ahora piden el bloque MAS RECIENTE de Events
-- (`where session_id in (...) order by occurred_at desc limit N`) en vez de
-- traerse el historial entero para descartarlo en JS.
--
-- Ese patron necesita un indice compuesto: `events_session_id_idx` (0001) cubre
-- solo la igualdad de session_id, dejando el ORDER BY como un sort explicito
-- sobre todas las filas que matcheen. Con (session_id, occurred_at desc) el
-- planner puede recorrer el indice y cortar en LIMIT sin ordenar nada.
--
-- El indice viejo de una sola columna queda cubierto por el prefijo de este
-- (session_id es la primera columna), pero no se elimina: `unused_index` del
-- advisor lo señalara cuando haya trafico real y ahi se decide con datos.

create index if not exists events_session_occurred_idx
  on public.events(session_id, occurred_at desc);
