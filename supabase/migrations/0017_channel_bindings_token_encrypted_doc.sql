-- ============================================================================
-- Talkii — documenta que channel_bindings.access_token ahora guarda texto
-- cifrado (hallazgo MEDIO de auditoría: "Token de WhatsApp por tenant en
-- texto plano"). Sin cambio de schema (sigue siendo `text`) — el cifrado
-- vive en la capa de aplicación (src/infrastructure/security/token-cipher.ts,
-- AES-256-GCM vía node:crypto, clave ENCRYPTION_KEY). 0 filas existentes en
-- esta tabla al momento del fix (verificado), sin necesidad de migrar datos.
-- ============================================================================

comment on column public.channel_bindings.access_token is
  'Cifrado con token-cipher.ts (AES-256-GCM, ENCRYPTION_KEY). Nunca texto plano — cualquier inserción manual debe pre-cifrarlo con encryptToken().';
