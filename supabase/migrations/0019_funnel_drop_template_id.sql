-- ============================================================================
-- Talkii — elimina funnels.template_id (hallazgo MEDIO de auditoría:
-- "Funnel.templateId apunta a una entidad que no existe"). Sin FK, sin tabla
-- funnel_templates en ninguna migración, y ningún caso de uso lo setea
-- jamás — solo viajaba ida y vuelta por el mapper. AA-01 (Domain Before
-- Persistence): ninguna estructura de persistencia sin entidad/caso de uso
-- que la justifique. Verificado 0 filas en funnels con template_id no nulo
-- antes de eliminar.
-- ============================================================================

alter table public.funnels
  drop column if exists template_id;
