-- ============================================================================
-- Talkii — EXCLUDE constraint contra citas solapadas (item 10 de la
-- auditoría, sub-item 4/5, 2026-07-30). Hallazgo ALTO: "sin EXCLUDE
-- constraint contra citas duplicadas" — `findOverlapping` (application) hace
-- check-then-insert, con ventana de carrera entre dos requests concurrentes
-- sobre el mismo Calendar. El fix vive a nivel de base de datos: única forma
-- de cerrar la ventana de carrera de verdad (un check en application nunca
-- es atómico contra otra transacción concurrente).
--
-- Mismos criterios que Appointment.overlaps() (domain, rango semiabierto
-- [starts_at, ends_at)) y SupabaseAppointmentRepository.findOverlapping()
-- (application/infra): mismo Calendar, no cancelada, no borrada (soft
-- delete). starts_at/ends_at son timestamptz → tstzrange (no tsrange), sin
-- bounds explícitos ya es `[)` por defecto en Postgres — coincide exactamente.
-- ============================================================================

create extension if not exists "btree_gist";

alter table public.appointments
  add constraint appointments_no_overlap
  exclude using gist (
    calendar_id with =,
    tstzrange(starts_at, ends_at) with &&
  )
  where (status <> 'cancelled' and deleted_at is null);
