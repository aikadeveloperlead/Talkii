-- Cierre del hallazgo HIGH que 0025 dejo explicitamente pendiente: el patron
-- de grants por-defecto de Supabase sin revocar existia en las 21 tablas
-- restantes, no solo en `tenants` y `channel_bindings`.
--
-- 0025 no lo hizo en bloque a proposito, porque revocar INSERT/UPDATE si
-- rompe la app: la mayoria de las escrituras legitimas corren con el cliente
-- por-request (rol `authenticated`) y usan `upsert`, que es
-- `INSERT ... ON CONFLICT` y exige INSERT aunque termine actualizando. (Ese
-- mismo detalle causo una regresion real en UpdateWorkspace, corregida aparte.)
--
-- DELETE es distinto: se auditaron los 9 repositorios y SOLO dos caminos
-- hacen un borrado fisico —
--     knowledge-repositories.ts:54   DeleteCategory      -> knowledge_categories
--     knowledge-repositories.ts:102  UnlinkAgentKnowledge -> agent_knowledge
-- Todo el resto del dominio usa soft-delete (archived_at / deleted_at /
-- status) o es append-only (events, decisions, *_timeline, webhook_deliveries).
--
-- Sin este revoke, cualquier usuario autenticado podia borrar fisicamente sus
-- propias filas por PostgREST directo (RLS solo valida QUE la fila sea suya,
-- no la operacion), saltandose el modelo de soft-delete del producto y
-- disparando los ON DELETE CASCADE del schema. La escalada maxima ya se cerro
-- en 0025 (tenants), esto cierra el resto de la superficie.
--
-- `anon` ademas no necesita NINGUNA escritura: todo endpoint autenticado
-- corre como `authenticated`, y los caminos previos a la sesion (registro,
-- rate limiting, webhook de WhatsApp) usan service-role, que ignora estos
-- grants.

-- ── 1. Sin escrituras para anon en ninguna tabla ────────────────────────────
revoke insert, update, delete on all tables in schema public from anon;

-- ── 2. Sin borrado fisico para authenticated ────────────────────────────────
revoke delete on all tables in schema public from authenticated;

-- ── 3. Excepciones: los 2 unicos borrados fisicos reales de la app ──────────
grant delete on public.knowledge_categories to authenticated;
grant delete on public.agent_knowledge to authenticated;

-- ── 4. Mismo criterio para tablas futuras ───────────────────────────────────
alter default privileges in schema public
  revoke insert, update, delete on tables from anon;
alter default privileges in schema public
  revoke delete on tables from authenticated;
