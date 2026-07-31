-- Hallazgo MEDIUM de la auditoria adversarial santa-loop: dos carreras
-- check-then-act quedaron sin backstop en la base, a diferencia de las otras
-- dos del proyecto que SI se cerraron ahi (0013 EXCLUDE de citas solapadas,
-- 0015 indice unico parcial de Session activa).
--
-- ── 1. Conversation duplicada ───────────────────────────────────────────────
-- HandleInboundMessage.resolveActiveSession hace findByParticipant -> si no
-- existe, startConversation. Dos mensajes casi simultaneos del mismo cliente
-- (o un reintento de Meta en paralelo) hacen que ambas invocaciones vean null
-- y creen su propia Conversation. El historial del cliente queda partido en
-- dos relaciones y `findByParticipant` (que tiene .limit(1)) devuelve una
-- arbitraria a partir de ahi.
--
-- El indice es sobre el PRIMER participante porque en el MVP una Conversation
-- se crea siempre con exactamente uno (StartConversation) — si en el futuro
-- se soportan grupos, este indice hay que repensarlo junto con el modelo.
create unique index if not exists conversations_one_per_participant
  on public.conversations(tenant_id, channel, (participants -> 0 ->> 'channelHandle'));

-- ── 2. Tenant huerfano en el onboarding ─────────────────────────────────────
-- auth-actions.provisionTenant lee `app_metadata.tenant_id`, y si falta llama
-- a ProvisionTenant, que crea el Tenant y DESPUES asigna el claim. Un doble
-- submit del formulario (o un reintento por red lenta) hace que ambos
-- requests lean "sin tenant" y creen uno cada uno: el primero queda huerfano
-- PARA SIEMPRE — nada en el schema ligaba un usuario de auth con su tenant
-- salvo el propio claim, asi que ningun usuario puede alcanzarlo y ninguna
-- query puede encontrarlo.
--
-- `owner_user_id` hace la relacion explicita y el indice unico hace la
-- operacion idempotente a nivel de base: el segundo intento choca con 23505
-- en vez de crear basura invisible. Nullable porque los tenants existentes
-- (y cualquier alta futura por otra via) no lo tienen.
alter table public.tenants
  add column if not exists owner_user_id uuid;

create unique index if not exists tenants_owner_user_id_key
  on public.tenants(owner_user_id)
  where owner_user_id is not null;
