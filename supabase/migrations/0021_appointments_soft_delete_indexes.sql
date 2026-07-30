-- Item BAJO #11 de la auditoria: la unica tabla con soft-delete
-- (appointments.deleted_at, 0004_scheduling.sql) no tenia indices
-- parciales que cubrieran los 2 patrones de consulta reales que filtran
-- "solo filas activas" (scheduling-repositories.ts: findOverlapping por
-- calendar_id, search por tenant_id) — ambos ya tenian un indice completo
-- (no parcial), asi que el planner escaneaba filas soft-deleted de mas.

create index if not exists appointments_calendar_id_active_idx
  on public.appointments(calendar_id)
  where deleted_at is null;

create index if not exists appointments_tenant_id_active_idx
  on public.appointments(tenant_id)
  where deleted_at is null;
