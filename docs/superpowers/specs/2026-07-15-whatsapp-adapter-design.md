# Adapter WhatsApp Cloud API — Diseño

**Fecha:** 2026-07-15 · **Estado:** aprobado por el usuario
**Objetivo:** cerrar el loop conversacional real: mensaje entrante de WhatsApp →
`IngestEvent` → `MakeDecision` → ejecución de `message.send` por Graph API.
Respeta AA-01 (Domain Before Persistence), AA-02 (Decision Engine Independence)
y AA-03 (Architecture Validation Gate).

## Decisiones tomadas con el usuario

1. **Multi-tenant:** tabla `channel_bindings` mapea `phone_number_id` de Meta →
   `tenant_id` + `agent_id` (+ `funnel_id` opcional).
2. **Credenciales:** `WHATSAPP_ACCESS_TOKEN` global en env como token de
   plataforma; columna `access_token` NULLABLE en `channel_bindings` que, si
   existe, tiene prioridad (camino a BYO-número sin retrabajo).
3. **Procesamiento:** el POST del webhook valida firma, responde 200 de
   inmediato y ejecuta el pipeline en `after()` de `next/server` (Node
   self-hosted lo soporta). Evita reintentos duplicados de Meta sin cola.

## 1. Alcance de la fase

Incluye: webhook GET (verify) + POST (mensajes de **texto**), resolución de
binding, encontrar-o-crear Conversation/Session, `IngestEvent(message.received)`,
`MakeDecision`, `ExecuteDecision` (envío real), `Event(message.sent)`.

Excluye: medios (imagen/audio/documento), statuses de entrega (se responden 200
y se ignoran), plantillas HSM, Embedded Signup, UI.

## 2. Dominio (toque mínimo)

- **`ChannelBinding` NO es entidad del núcleo.** El SSOT Cap. 7 cierra las 7
  entidades; el binding se modela como **recurso de configuración del Tenant**
  (interfaz plana definida en `application`, análoga a Knowledge/Tool:
  capacidad, no entidad). Se documenta en `ARCHITECTURE.md`.
- **`Event` gana `externalId?` opcional**: identidad del hecho en el sistema
  origen (el `wamid` de Meta). Fundamento de la idempotencia ante reintentos.
  Es el único cambio a `domain/`.

## 3. Application

**Puertos nuevos** (`application/ports/`):

- `ChannelBindingResolver.findByChannelIdentity(channel, externalId)` →
  `ChannelBinding | null` con `{ tenantId, channel, externalId, agentId,
  funnelId?, accessToken? }`.
- `MessageSender.send({ binding, to, text })` → `{ externalMessageId }`.
  Agnóstico de proveedor (AA-02 aplicado a la ejecución).

**Métodos nuevos en puertos existentes:**

- `ConversationRepository.findByParticipant(tenantId, channel, handle)`.
- `SessionRepository.findActiveByConversation(conversationId)`.

**Use-cases nuevos** (`application/use-cases/`):

- `HandleInboundMessage` — orquestador del inbound: resuelve binding →
  encuentra Conversation por participante o la abre vía `StartConversation` →
  `IngestEvent` (type `message.received`, payload `{ wamid, from, text,
  timestamp }`, `externalId = wamid`) → `MakeDecision(agentId, funnelId?)` →
  `ExecuteDecision`. Si el `wamid` ya fue ingerido, corta (idempotencia).
- `ExecuteDecision` — carga la Decision, recorre su plan de Actions y despacha
  `message.send` al puerto `MessageSender`; registra `Event(message.sent)` con
  el id externo devuelto. Actions de tipo desconocido: se omiten con log.
  Mantiene la separación decidir/ejecutar (SSOT Cap. 11 §14).

## 4. Infraestructura

`infrastructure/whatsapp/`:

- `verify-signature.ts` — HMAC-SHA256 del **raw body** con
  `WHATSAPP_APP_SECRET`, comparación constante contra `X-Hub-Signature-256`.
- `parse-webhook.ts` — funciones puras: payload de Meta → lista de
  `{ phoneNumberId, wamid, from, text, timestamp }` (solo `type: "text"`).
- `whatsapp-message-sender.ts` — implementa `MessageSender` con fetch nativo a
  `https://graph.facebook.com/{WHATSAPP_GRAPH_VERSION}/{phoneNumberId}/messages`;
  usa `binding.accessToken ?? WHATSAPP_ACCESS_TOKEN`.

`infrastructure/supabase/`:

- `SupabaseChannelBindingResolver` + mapper fila↔binding.
- `findByParticipant` con `participants @> [{"channelHandle": ...}]` (GIN).
- `findActiveByConversation` (`status = 'active'`, más reciente).
- `events.append` propaga `external_id`; el conflicto de unicidad se traduce a
  «duplicado» detectable por el use-case.

**Migración `0002_whatsapp_channel.sql`:**

- Tabla `channel_bindings` (`id`, `tenant_id` FK, `channel` check `whatsapp`,
  `external_id`, `agent_id` FK, `funnel_id` FK nullable, `access_token`
  nullable, `created_at`) + `unique(channel, external_id)` + RLS por
  `tenant_id` (los webhooks acceden con service role, que la salta).
- `events.external_id text` + índice único parcial (`where external_id is not null`).
- Índice GIN sobre `conversations.participants`.

## 5. App (Next.js)

`src/app/api/whatsapp/webhook/route.ts`:

- **GET:** si `hub.verify_token === WHATSAPP_VERIFY_TOKEN` → 200 con
  `hub.challenge`; si no → 403.
- **POST:** lee raw body → verifica firma (401 si falla) → parsea → responde
  200 → `after()` ejecuta `HandleInboundMessage` por cada mensaje usando
  `createServiceClient()` (el webhook no trae JWT; el aislamiento lo da
  binding→tenant, no RLS).

**Env nuevas:** `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`,
`WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_GRAPH_VERSION` (default `v23.0`).
Actualizar `.env.example` y `docs/DEPLOY.md` (alta del webhook en Meta).

## 6. Errores y casos borde

| Caso | Respuesta |
|---|---|
| Firma inválida / ausente | 401, no se procesa |
| Payload sin mensajes de texto (statuses, medios) | 200, skip |
| Binding desconocido (`phone_number_id` no registrado) | 200 + log, skip (evita reintentos) |
| `wamid` duplicado (reintento de Meta) | skip silencioso (índice único) |
| Fallo del LLM o del envío dentro de `after()` | log estructurado; sin reintento propio en esta fase |
| Session cerrada al ingerir | `DomainError` existente; se loguea y se corta |

## 7. Tests (Vitest, patrones actuales del repo)

- `verify-signature`: vector HMAC conocido, firma corrupta, header ausente.
- `parse-webhook`: payload real de Meta (texto), payload de status, payload sin `entry`.
- `HandleInboundMessage` con fakes: crea Conversation nueva; reutiliza la
  existente por handle; corta en `wamid` duplicado; corta si no hay binding.
- `ExecuteDecision` con `MessageSender` falso: ejecuta `message.send`, registra
  `message.sent`, omite actions desconocidas.
- `whatsapp-message-sender` contra fetch falso: URL/headers/body correctos,
  prioridad `binding.accessToken` sobre env, error HTTP → excepción.
