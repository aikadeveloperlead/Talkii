-- ============================================================================
-- Talkii — mueve la extensión btree_gist (agregada en 0013) al schema
-- `extensions`, mismo lugar donde ya vive `pgcrypto` (0001_init.sql, gestión
-- por defecto de Supabase) — corrige el WARN `extension_in_public` que
-- 0013_appointments_no_overlap.sql dejó al no especificar schema. No se edita
-- 0013 (regla del proyecto: migraciones ya aplicadas no se tocan).
-- ============================================================================

alter extension btree_gist set schema extensions;
