-- ============================================================================
-- Talkii — errorDetail en WebhookDelivery (hallazgo ALTO de la auditoría,
-- 2026-07-30, no incluido en la lista original de 5 sub-items de item 10 —
-- se había perdido en el resumen de memoria de la sesión anterior).
--
-- DispatchWebhookEvent tenía un catch {} vacío: cuando el envío fallaba, la
-- entrega quedaba registrada como "failed" pero sin ningún motivo — un
-- tenant veía "failed" sin ninguna pista de por qué.
-- ============================================================================

alter table public.webhook_deliveries
  add column if not exists error_detail text;
