-- Hallazgo BAJO de la auditoría (function_search_path_mutable): current_tenant_id()
-- no tenía search_path explícito. Una función SECURITY DEFINER/usada en políticas
-- RLS sin search_path fijo puede resolver identificadores contra un schema
-- distinto si alguien manipula el search_path de la sesión — hardening estándar
-- recomendado por el linter de Supabase.
alter function public.current_tenant_id() set search_path = public;
