# WhatsApp Cloud API Adapter — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar el loop conversacional real: webhook de WhatsApp → `IngestEvent` → `MakeDecision` → envío de la respuesta por Graph API.

**Architecture:** Clean Architecture existente (`domain → application → infrastructure → app`). El webhook (Next route handler) valida firma, responde 200 y procesa en `after()` con el use-case orquestador `HandleInboundMessage`, que usa el resolver de `channel_bindings` para mapear `phone_number_id` → tenant/agent. `ExecuteDecision` materializa el plan de Actions vía el puerto `MessageSender` (implementado con fetch nativo a Graph API).

**Tech Stack:** Next.js 16 App Router (`after` de `next/server`), TypeScript strict, Supabase (RLS + service role en webhook), Vitest, fetch nativo (sin dependencias nuevas).

**Spec:** `docs/superpowers/specs/2026-07-15-whatsapp-adapter-design.md`

## Global Constraints

- CERO dependencias npm nuevas (Graph API con fetch nativo, HMAC con `node:crypto`).
- `domain/` no importa nada externo; `application/` no conoce Next ni Supabase; regla de imports `app/infrastructure → application → domain`.
- Alias de paths: `@/` = `src/` (ya configurado en tsconfig y vitest).
- Comentarios y mensajes en español, siguiendo el estilo existente (referencias al SSOT donde aplique).
- Env nuevas: `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_GRAPH_VERSION` (default `v23.0`).
- Verificación por tarea: `npx vitest run` y `npx tsc --noEmit` en `C:\Users\nicol\Talkii`. Tarea final: `npm run build`.
- Commits frecuentes, mensajes convencionales en español + `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: Dominio — `Event.externalId` + passthrough en `IngestEvent`

**Files:**
- Modify: `src/domain/execution/event.ts`
- Modify: `src/application/use-cases/ingest-event.ts`
- Test: `tests/domain/event-external-id.test.ts` (nuevo)

**Interfaces:**
- Consumes: `Event`, `Identity`, `IngestEvent` existentes.
- Produces: `EventProps.externalId?: string` + getter `event.externalId: string | undefined`; `IngestEventInput.externalId?: string`.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/domain/event-external-id.test.ts
import { describe, expect, it } from "vitest";
import { Event, Identity } from "@/domain";

describe("Event · externalId (identidad del hecho en el sistema origen)", () => {
  it("conserva el externalId cuando se provee", () => {
    const e = Event.create(Identity.of("e1"), {
      sessionId: Identity.of("s1"),
      type: "message.received",
      occurredAt: new Date("2026-07-15T12:00:00.000Z"),
      payload: { text: "hola" },
      externalId: "wamid.ABC123",
    });
    expect(e.externalId).toBe("wamid.ABC123");
  });

  it("es undefined cuando no se provee (hechos internos)", () => {
    const e = Event.create(Identity.of("e2"), {
      sessionId: Identity.of("s1"),
      type: "message.sent",
      occurredAt: new Date("2026-07-15T12:00:01.000Z"),
      payload: {},
    });
    expect(e.externalId).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/domain/event-external-id.test.ts`
Expected: FAIL — `externalId` no existe en `EventProps` (error de compilación TS).

- [ ] **Step 3: Write minimal implementation**

En `src/domain/execution/event.ts`, dentro de `EventProps` añadir tras `payload`:

```typescript
  /**
   * Identidad del hecho en el sistema de origen (p. ej. el `wamid` de Meta).
   * Opcional: los hechos internos no la tienen. Fundamento de la idempotencia
   * ante reintentos del canal externo.
   */
  externalId?: string;
```

Y en la clase `Event`, tras el getter `payload`:

```typescript
  get externalId(): string | undefined {
    return this.props.externalId;
  }
```

En `src/application/use-cases/ingest-event.ts`:
- A `IngestEventInput` añadir: `externalId?: string;`
- En `Event.create(...)` añadir la propiedad: `externalId: input.externalId,`

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS (27 tests: 25 existentes + 2 nuevos), tsc sin errores.

- [ ] **Step 5: Commit**

```powershell
git add src/domain/execution/event.ts src/application/use-cases/ingest-event.ts tests/domain/event-external-id.test.ts
git commit -m @'
feat(domain): Event.externalId para idempotencia de hechos de origen externo

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
'@
```

---

### Task 2: Migración 0002 + persistencia de `externalId` + error de duplicado

**Files:**
- Create: `supabase/migrations/0002_whatsapp_channel.sql`
- Modify: `src/application/ports/repositories.ts` (clase `DuplicateExternalEventError`)
- Modify: `src/application/ports/index.ts`
- Modify: `src/infrastructure/supabase/mappers.ts` (`EventRow.external_id`)
- Modify: `src/infrastructure/supabase/repositories.ts` (`SupabaseEventRepository.append`)
- Modify: `tests/fakes.ts` (`InMemoryEvents` con dedupe)
- Test: `tests/infrastructure/mappers.test.ts` (caso nuevo)

**Interfaces:**
- Consumes: `Event.externalId` (Task 1).
- Produces: `DuplicateExternalEventError` (exportada desde `@/application/ports`); `EventRow.external_id: string | null`; `InMemoryEvents.append` y `SupabaseEventRepository.append` lanzan `DuplicateExternalEventError` ante duplicado; tabla `channel_bindings` en la BD.

- [ ] **Step 1: Write the failing test (round-trip del externalId)**

Añadir a `tests/infrastructure/mappers.test.ts`, dentro del `describe` existente:

```typescript
  it("Event conserva external_id en el round-trip", () => {
    const e = Event.create(id("e9"), {
      sessionId: id("s1"),
      type: "message.received",
      occurredAt: new Date("2026-07-15T12:00:00.000Z"),
      payload: { text: "hola" },
      externalId: "wamid.XYZ",
    });
    const row = eventToRow(e);
    expect(row.external_id).toBe("wamid.XYZ");
    const back = rowToEvent(row);
    expect(back.externalId).toBe("wamid.XYZ");
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/infrastructure/mappers.test.ts`
Expected: FAIL — `external_id` no existe en `EventRow`.

- [ ] **Step 3: Implement mappers + error + repos**

En `src/infrastructure/supabase/mappers.ts`, `EventRow` queda:

```typescript
export interface EventRow {
  id: string;
  session_id: string;
  type: string;
  occurred_at: string;
  payload: Record<string, unknown>;
  external_id: string | null;
}
```

`eventToRow` añade: `external_id: event.externalId ?? null,`
`rowToEvent` añade en `Event.create`: `externalId: row.external_id ?? undefined,`

En `src/application/ports/repositories.ts`, tras los imports:

```typescript
/**
 * Un Event con `externalId` ya ingerido: el canal externo reintentó la entrega
 * (p. ej. reintentos del webhook de Meta). El caso de uso lo trata como
 * idempotencia, no como fallo.
 */
export class DuplicateExternalEventError extends Error {
  constructor(externalId: string) {
    super(`Event duplicado: external_id=${externalId} ya fue ingerido`);
    this.name = "DuplicateExternalEventError";
  }
}
```

En `src/application/ports/index.ts` añadir (export de VALOR, no `export type`):

```typescript
export { DuplicateExternalEventError } from "./repositories";
```

En `src/infrastructure/supabase/repositories.ts`, importar `DuplicateExternalEventError` desde `@/application/ports` y reescribir `SupabaseEventRepository.append`:

```typescript
  /** Los Events son hechos consumados: solo se anexan, nunca se mutan. */
  async append(event: Event): Promise<void> {
    const { error } = await this.db.from("events").insert(eventToRow(event));
    if (error) {
      // 23505 = unique_violation (índice único parcial sobre external_id).
      if (error.code === "23505" && event.externalId) {
        throw new DuplicateExternalEventError(event.externalId);
      }
      fail("events.insert", error);
    }
  }
```

En `tests/fakes.ts`, importar `DuplicateExternalEventError` desde `@/application/ports` (import de valor, separado del `import type`) y reescribir `InMemoryEvents.append`:

```typescript
  async append(event: Event): Promise<void> {
    if (
      event.externalId &&
      [...this.store.values()].some((e) => e.externalId === event.externalId)
    ) {
      throw new DuplicateExternalEventError(event.externalId);
    }
    this.store.set(event.id.toString(), event);
  }
```

- [ ] **Step 4: Create the migration**

```sql
-- supabase/migrations/0002_whatsapp_channel.sql
-- ============================================================================
-- Talkii — Canal WhatsApp Cloud API
--   1. channel_bindings: mapea el número de WhatsApp (phone_number_id de Meta)
--      al Tenant/Agent que lo atiende. Recurso de configuración del Tenant
--      (capacidad, no entidad del núcleo — SSOT Cap. 7 cierra las 7 entidades).
--   2. events.external_id: identidad del hecho en el sistema origen (wamid).
--      Índice único parcial → idempotencia ante reintentos del webhook.
--   3. Índice GIN sobre conversations.participants para find-by-handle.
-- ============================================================================

-- ── 1. channel_bindings ─────────────────────────────────────────────────────
create table if not exists public.channel_bindings (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  channel      text not null check (channel in ('whatsapp')),
  external_id  text not null,  -- phone_number_id de Meta
  agent_id     uuid not null references public.agents(id) on delete cascade,
  funnel_id    uuid references public.funnels(id) on delete set null,
  access_token text,           -- si es null, se usa WHATSAPP_ACCESS_TOKEN global
  created_at   timestamptz not null default now(),
  unique (channel, external_id)
);
create index if not exists channel_bindings_tenant_id_idx
  on public.channel_bindings(tenant_id);

alter table public.channel_bindings enable row level security;

-- El usuario gestiona solo los bindings de su tenant. El webhook accede con
-- service role (salta RLS): el aislamiento allí lo da la resolución
-- binding → tenant, no la política.
create policy channel_bindings_isolation on public.channel_bindings
  for all to authenticated
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- ── 2. events.external_id ──────────────────────────────────────────────────
alter table public.events add column if not exists external_id text;
create unique index if not exists events_external_id_key
  on public.events(external_id)
  where external_id is not null;

-- ── 3. Búsqueda de Conversation por participante ────────────────────────────
create index if not exists conversations_participants_gin
  on public.conversations using gin (participants jsonb_path_ops);
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS (28 tests), tsc sin errores.

- [ ] **Step 6: Commit**

```powershell
git add supabase/migrations/0002_whatsapp_channel.sql src/application/ports/repositories.ts src/application/ports/index.ts src/infrastructure/supabase/mappers.ts src/infrastructure/supabase/repositories.ts tests/fakes.ts tests/infrastructure/mappers.test.ts
git commit -m @'
feat(persistence): migración canal WhatsApp + idempotencia por external_id

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
'@
```

---

### Task 3: Extensión de puertos de repositorio + implementaciones

**Files:**
- Modify: `src/application/ports/repositories.ts`
- Modify: `src/infrastructure/supabase/repositories.ts`
- Modify: `tests/fakes.ts`

**Interfaces:**
- Consumes: puertos existentes, `Channel` de `@/domain`.
- Produces (firmas exactas que usan Tasks 4–5):
  - `ConversationRepository.findByParticipant(tenantId: Identity, channel: Channel, handle: string): Promise<Conversation | null>`
  - `SessionRepository.findActiveByConversation(conversationId: Identity): Promise<Session | null>`
  - `DecisionRepository.findById(id: Identity): Promise<Decision | null>`
  - Fakes actualizados: `InMemoryConversations`, `InMemorySessions`, `InMemoryDecisions`.

- [ ] **Step 1: Extend the ports**

En `src/application/ports/repositories.ts`, importar `type Channel` desde `@/domain` y ampliar:

```typescript
export interface ConversationRepository {
  save(conversation: Conversation): Promise<void>;
  findById(id: Identity): Promise<Conversation | null>;
  /** Relación existente con un participante en un canal (p. ej. wa_id). */
  findByParticipant(
    tenantId: Identity,
    channel: Channel,
    handle: string,
  ): Promise<Conversation | null>;
}

export interface SessionRepository {
  save(session: Session): Promise<void>;
  findById(id: Identity): Promise<Session | null>;
  /** Session activa más reciente de la Conversation, o null si no hay. */
  findActiveByConversation(conversationId: Identity): Promise<Session | null>;
}

export interface DecisionRepository {
  save(decision: Decision): Promise<void>;
  findById(id: Identity): Promise<Decision | null>;
  findBySession(sessionId: Identity): Promise<Decision[]>;
}
```

- [ ] **Step 2: Update the in-memory fakes**

En `tests/fakes.ts`, importar `type Channel` desde `@/domain` y reemplazar las tres clases:

```typescript
export class InMemoryConversations implements ConversationRepository {
  private repo = makeMapRepo<Conversation>();
  save = this.repo.save;
  findById = this.repo.findById;
  async findByParticipant(
    tenantId: Identity,
    channel: Channel,
    handle: string,
  ): Promise<Conversation | null> {
    return (
      [...this.repo.store.values()].find(
        (c) =>
          c.tenantId.equals(tenantId) &&
          c.channel === channel &&
          c.participants.some((p) => p.channelHandle === handle),
      ) ?? null
    );
  }
}

export class InMemorySessions implements SessionRepository {
  private repo = makeMapRepo<Session>();
  save = this.repo.save;
  findById = this.repo.findById;
  async findActiveByConversation(
    conversationId: Identity,
  ): Promise<Session | null> {
    return (
      [...this.repo.store.values()].find(
        (s) => s.conversationId.equals(conversationId) && s.isActive,
      ) ?? null
    );
  }
}

export class InMemoryDecisions implements DecisionRepository {
  store = new Map<string, Decision>();
  async save(decision: Decision): Promise<void> {
    this.store.set(decision.id.toString(), decision);
  }
  async findById(id: Identity): Promise<Decision | null> {
    return this.store.get(id.toString()) ?? null;
  }
  async findBySession(sessionId: Identity): Promise<Decision[]> {
    return [...this.store.values()].filter((d) =>
      d.sessionId.equals(sessionId),
    );
  }
}
```

- [ ] **Step 3: Implement the Supabase methods**

En `src/infrastructure/supabase/repositories.ts`, importar `type Channel` desde `@/domain` y añadir:

A `SupabaseConversationRepository`:

```typescript
  async findByParticipant(
    tenantId: Identity,
    channel: Channel,
    handle: string,
  ): Promise<Conversation | null> {
    const { data, error } = await this.db
      .from("conversations")
      .select("*")
      .eq("tenant_id", tenantId.toString())
      .eq("channel", channel)
      .contains("participants", JSON.stringify([{ channelHandle: handle }]))
      .limit(1)
      .maybeSingle();
    if (error) fail("conversations.select", error);
    return data ? rowToConversation(data as ConversationRow) : null;
  }
```

A `SupabaseSessionRepository`:

```typescript
  async findActiveByConversation(
    conversationId: Identity,
  ): Promise<Session | null> {
    const { data, error } = await this.db
      .from("sessions")
      .select("*")
      .eq("conversation_id", conversationId.toString())
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) fail("sessions.select", error);
    return data ? rowToSession(data as SessionRow) : null;
  }
```

A `SupabaseDecisionRepository`:

```typescript
  async findById(id: Identity): Promise<Decision | null> {
    const { data, error } = await this.db
      .from("decisions")
      .select("*")
      .eq("id", id.toString())
      .maybeSingle();
    if (error) fail("decisions.select", error);
    return data ? rowToDecision(data as DecisionRow) : null;
  }
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS (28 tests), tsc sin errores (si tsc falla, es porque algún fake o repo no implementa la interfaz ampliada — corregir).

- [ ] **Step 5: Commit**

```powershell
git add src/application/ports/repositories.ts src/infrastructure/supabase/repositories.ts tests/fakes.ts
git commit -m @'
feat(ports): findByParticipant, findActiveByConversation y Decision.findById

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
'@
```

---

### Task 4: Puertos `ChannelBinding`/`MessageSender` + use-case `ExecuteDecision`

**Files:**
- Create: `src/application/ports/channel-binding.ts`
- Create: `src/application/ports/message-sender.ts`
- Create: `src/application/use-cases/execute-decision.ts`
- Modify: `src/application/ports/index.ts`
- Modify: `src/application/use-cases/index.ts`
- Modify: `tests/fakes.ts` (añadir `FakeMessageSender`)
- Test: `tests/application/execute-decision.test.ts` (nuevo)

**Interfaces:**
- Consumes: `DecisionRepository.findById` (Task 3), `Event.externalId` (Task 1), `Clock`, `IdGenerator`, `EventRepository`.
- Produces (firmas exactas que usa Task 5):
  - `ChannelBinding = { tenantId: string; channel: Channel; externalId: string; agentId: string; funnelId?: string; accessToken?: string }`
  - `ChannelBindingResolver.findByChannelIdentity(channel: Channel, externalId: string): Promise<ChannelBinding | null>`
  - `MessageSender.send(message: OutboundMessage): Promise<MessageSendResult>` con `OutboundMessage = { binding: ChannelBinding; to: string; text: string }` y `MessageSendResult = { externalMessageId: string }`
  - `ExecuteDecision.execute({ decisionId: string; binding: ChannelBinding; to: string }): Promise<{ executedActions: number }>`
  - `FakeMessageSender` en fakes con `sent: OutboundMessage[]`.

- [ ] **Step 1: Create the ports**

```typescript
// src/application/ports/channel-binding.ts
import type { Channel } from "@/domain";

/**
 * ChannelBinding — recurso de configuración del Tenant (capacidad, NO entidad
 * del núcleo: el SSOT Cap. 7 cierra las 7 entidades). Vincula la identidad de
 * un canal externo (p. ej. el phone_number_id de Meta) con el Tenant que lo
 * posee y el Agent que lo atiende.
 */
export interface ChannelBinding {
  readonly tenantId: string;
  readonly channel: Channel;
  /** Identidad del canal en el proveedor (WhatsApp: phone_number_id). */
  readonly externalId: string;
  readonly agentId: string;
  readonly funnelId?: string;
  /** Credencial propia del binding; si falta, se usa la global de plataforma. */
  readonly accessToken?: string;
}

/** Puerto: resuelve qué Tenant/Agent atiende una identidad de canal. */
export interface ChannelBindingResolver {
  findByChannelIdentity(
    channel: Channel,
    externalId: string,
  ): Promise<ChannelBinding | null>;
}
```

```typescript
// src/application/ports/message-sender.ts
import type { ChannelBinding } from "./channel-binding";

/**
 * Puerto: envío de mensajes salientes por un canal (AA-02 aplicado a la
 * ejecución — el proveedor concreto es un detalle de infraestructura).
 */
export interface OutboundMessage {
  readonly binding: ChannelBinding;
  /** Handle del destinatario en el canal (WhatsApp: wa_id). */
  readonly to: string;
  readonly text: string;
}

export interface MessageSendResult {
  /** Identidad del mensaje en el proveedor (WhatsApp: wamid saliente). */
  readonly externalMessageId: string;
}

export interface MessageSender {
  send(message: OutboundMessage): Promise<MessageSendResult>;
}
```

En `src/application/ports/index.ts` añadir:

```typescript
export type { ChannelBinding, ChannelBindingResolver } from "./channel-binding";
export type {
  MessageSender,
  OutboundMessage,
  MessageSendResult,
} from "./message-sender";
```

- [ ] **Step 2: Add `FakeMessageSender` to fakes**

En `tests/fakes.ts` (añadir `MessageSender`, `OutboundMessage`, `MessageSendResult` al `import type` de `@/application/ports`):

```typescript
/** MessageSender falso: registra los envíos y devuelve wamids sintéticos. */
export class FakeMessageSender implements MessageSender {
  sent: OutboundMessage[] = [];
  async send(message: OutboundMessage): Promise<MessageSendResult> {
    this.sent.push(message);
    return { externalMessageId: `wamid.out-${this.sent.length}` };
  }
}
```

- [ ] **Step 3: Write the failing test**

```typescript
// tests/application/execute-decision.test.ts
import { describe, expect, it } from "vitest";
import { Decision, Identity } from "@/domain";
import { ExecuteDecision } from "@/application/use-cases";
import type { ChannelBinding } from "@/application/ports";
import {
  FakeMessageSender,
  FixedClock,
  InMemoryDecisions,
  InMemoryEvents,
  SequentialIds,
} from "../fakes";

const binding: ChannelBinding = {
  tenantId: "t1",
  channel: "whatsapp",
  externalId: "123456",
  agentId: "a1",
};

function setup() {
  const decisions = new InMemoryDecisions();
  const events = new InMemoryEvents();
  const sender = new FakeMessageSender();
  const useCase = new ExecuteDecision(
    new SequentialIds(),
    new FixedClock(),
    decisions,
    events,
    sender,
  );
  return { decisions, events, sender, useCase };
}

describe("ExecuteDecision (SSOT Cap. 11 §14 — materializa el plan, no decide)", () => {
  it("ejecuta message.send por el puerto y registra Event message.sent", async () => {
    const { decisions, events, sender, useCase } = setup();
    await decisions.save(
      Decision.create(Identity.of("d1"), {
        sessionId: Identity.of("s1"),
        eventId: Identity.of("e1"),
        source: "ai-model",
        rationale: "responder al cliente",
        actions: [{ type: "message.send", params: { text: "¡Hola!" } }],
      }),
    );

    const result = await useCase.execute({
      decisionId: "d1",
      binding,
      to: "573001112233",
    });

    expect(result.executedActions).toBe(1);
    expect(sender.sent).toHaveLength(1);
    expect(sender.sent[0].to).toBe("573001112233");
    expect(sender.sent[0].text).toBe("¡Hola!");
    const sessionEvents = await events.findBySession(Identity.of("s1"));
    expect(sessionEvents).toHaveLength(1);
    expect(sessionEvents[0].type).toBe("message.sent");
    expect(sessionEvents[0].payload.externalMessageId).toBe("wamid.out-1");
  });

  it("omite actions de tipo desconocido sin fallar", async () => {
    const { decisions, sender, useCase } = setup();
    await decisions.save(
      Decision.create(Identity.of("d2"), {
        sessionId: Identity.of("s1"),
        eventId: Identity.of("e1"),
        source: "ai-model",
        rationale: "plan mixto",
        actions: [
          { type: "crm.update", params: {} },
          { type: "message.send", params: { text: "ok" } },
        ],
      }),
    );

    const result = await useCase.execute({ decisionId: "d2", binding, to: "57300" });

    expect(result.executedActions).toBe(1);
    expect(sender.sent).toHaveLength(1);
  });

  it("falla si la Decision no existe", async () => {
    const { useCase } = setup();
    await expect(
      useCase.execute({ decisionId: "nope", binding, to: "57300" }),
    ).rejects.toThrow("ExecuteDecision: la Decision no existe");
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npx vitest run tests/application/execute-decision.test.ts`
Expected: FAIL — `ExecuteDecision` no existe.

- [ ] **Step 5: Write the implementation**

```typescript
// src/application/use-cases/execute-decision.ts
import { DomainError, Event, Identity } from "@/domain";
import { Clock } from "../ports/clock";
import { IdGenerator } from "../ports/id-generator";
import type { ChannelBinding } from "../ports/channel-binding";
import type { MessageSender } from "../ports/message-sender";
import { DecisionRepository, EventRepository } from "../ports/repositories";

/**
 * ExecuteDecision — materializa el plan de Actions de una Decision (SSOT
 * Cap. 11 §14: decidir y ejecutar son responsabilidades separadas).
 *
 * En esta fase ejecuta `message.send` vía el puerto MessageSender; cada envío
 * queda registrado como Event `message.sent` (hecho consumado, trazable en el
 * timeline de la Session). Actions de tipo desconocido se omiten: el plan
 * puede contener cursos de acción que aún no tienen ejecutor.
 */
export interface ExecuteDecisionInput {
  decisionId: string;
  binding: ChannelBinding;
  /** Handle del destinatario en el canal (WhatsApp: wa_id del cliente). */
  to: string;
}

export interface ExecuteDecisionResult {
  executedActions: number;
}

export class ExecuteDecision {
  constructor(
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly decisions: DecisionRepository,
    private readonly events: EventRepository,
    private readonly sender: MessageSender,
  ) {}

  async execute(input: ExecuteDecisionInput): Promise<ExecuteDecisionResult> {
    const decision = await this.decisions.findById(Identity.of(input.decisionId));
    if (!decision) {
      throw new DomainError("ExecuteDecision: la Decision no existe");
    }

    let executed = 0;
    for (const action of decision.actions) {
      if (action.type !== "message.send") continue;
      const text = typeof action.params.text === "string" ? action.params.text : "";
      if (!text) continue;

      const result = await this.sender.send({
        binding: input.binding,
        to: input.to,
        text,
      });

      await this.events.append(
        Event.create(this.ids.next(), {
          sessionId: decision.sessionId,
          type: "message.sent",
          occurredAt: this.clock.now(),
          payload: {
            decisionId: decision.id.toString(),
            to: input.to,
            text,
            externalMessageId: result.externalMessageId,
          },
        }),
      );
      executed += 1;
    }

    return { executedActions: executed };
  }
}
```

En `src/application/use-cases/index.ts` añadir:

```typescript
export { ExecuteDecision } from "./execute-decision";
export type {
  ExecuteDecisionInput,
  ExecuteDecisionResult,
} from "./execute-decision";
```

- [ ] **Step 6: Run tests**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS (31 tests), tsc sin errores.

- [ ] **Step 7: Commit**

```powershell
git add src/application/ports/channel-binding.ts src/application/ports/message-sender.ts src/application/ports/index.ts src/application/use-cases/execute-decision.ts src/application/use-cases/index.ts tests/fakes.ts tests/application/execute-decision.test.ts
git commit -m @'
feat(application): puertos de canal + ExecuteDecision (separación decidir/ejecutar)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
'@
```

---

### Task 5: Use-case orquestador `HandleInboundMessage`

**Files:**
- Create: `src/application/use-cases/handle-inbound-message.ts`
- Modify: `src/application/use-cases/index.ts`
- Modify: `tests/fakes.ts` (añadir `InMemoryChannelBindings`)
- Test: `tests/application/handle-inbound-message.test.ts` (nuevo)

**Interfaces:**
- Consumes: `ChannelBindingResolver`, `ChannelBinding`, `DuplicateExternalEventError`, `ConversationRepository.findByParticipant`, `SessionRepository.findActiveByConversation`, `StartConversation`, `IngestEvent` (con `externalId`), `MakeDecision`, `ExecuteDecision` — todo de Tasks 1–4.
- Produces (lo que usa Task 8):
  - `HandleInboundMessage.execute(input: InboundMessageInput): Promise<HandleInboundMessageResult>`
  - `InboundMessageInput = { channel: Channel; channelExternalId: string; externalMessageId: string; from: string; displayName?: string; text: string; timestamp: Date }`
  - `HandleInboundMessageResult = { status: "processed"; decisionId: string } | { status: "duplicate" } | { status: "unbound" }`
  - `InMemoryChannelBindings` en fakes con constructor `(bindings: ChannelBinding[])`.

- [ ] **Step 1: Add `InMemoryChannelBindings` to fakes**

En `tests/fakes.ts` (añadir `ChannelBinding`, `ChannelBindingResolver` al `import type`, y `Channel` ya está desde Task 3):

```typescript
/** Resolver de bindings en memoria, precargado por el test. */
export class InMemoryChannelBindings implements ChannelBindingResolver {
  constructor(private readonly bindings: ChannelBinding[] = []) {}
  async findByChannelIdentity(
    channel: Channel,
    externalId: string,
  ): Promise<ChannelBinding | null> {
    return (
      this.bindings.find(
        (b) => b.channel === channel && b.externalId === externalId,
      ) ?? null
    );
  }
}
```

- [ ] **Step 2: Write the failing test**

```typescript
// tests/application/handle-inbound-message.test.ts
import { describe, expect, it } from "vitest";
import { Agent, Decision, Identity } from "@/domain";
import {
  ExecuteDecision,
  HandleInboundMessage,
  IngestEvent,
  MakeDecision,
  StartConversation,
} from "@/application/use-cases";
import type {
  ChannelBinding,
  ExecutionContext,
  IDecisionEngine,
  IdGenerator,
} from "@/application/ports";
import {
  FakeMessageSender,
  FixedClock,
  InMemoryAgents,
  InMemoryChannelBindings,
  InMemoryConversations,
  InMemoryDecisions,
  InMemoryEvents,
  InMemoryFunnels,
  InMemorySessions,
  SequentialIds,
} from "../fakes";

/** Engine determinista que produce un plan message.send (para ver el loop entero). */
class SendReplyEngine implements IDecisionEngine {
  constructor(private readonly ids: IdGenerator) {}
  async decide(context: ExecutionContext): Promise<Decision> {
    return Decision.create(this.ids.next(), {
      sessionId: context.session.id,
      eventId: context.event.id,
      source: "deterministic-engine",
      rationale: "responder al mensaje entrante",
      actions: [{ type: "message.send", params: { text: "respuesta" } }],
    });
  }
}

const binding: ChannelBinding = {
  tenantId: "11111111-1111-1111-1111-111111111111",
  channel: "whatsapp",
  externalId: "phone-123",
  agentId: "a1",
};

function setup() {
  const ids = new SequentialIds();
  const clock = new FixedClock();
  const agents = new InMemoryAgents();
  const funnels = new InMemoryFunnels();
  const conversations = new InMemoryConversations();
  const sessions = new InMemorySessions();
  const events = new InMemoryEvents();
  const decisions = new InMemoryDecisions();
  const sender = new FakeMessageSender();

  const useCase = new HandleInboundMessage(
    new InMemoryChannelBindings([binding]),
    conversations,
    sessions,
    ids,
    clock,
    new StartConversation(ids, clock, conversations, sessions),
    new IngestEvent(ids, clock, sessions, events),
    new MakeDecision(
      new SendReplyEngine(ids),
      events,
      sessions,
      agents,
      funnels,
      decisions,
    ),
    new ExecuteDecision(ids, clock, decisions, events, sender),
  );

  return { agents, conversations, sessions, events, decisions, sender, useCase };
}

async function seedAgent(agents: InMemoryAgents) {
  await agents.save(
    Agent.create(Identity.of("a1"), {
      tenantId: Identity.of(binding.tenantId),
      name: "Vendedor",
      objective: "vender",
      permanentPrompt: "sé amable",
      policies: [],
      reasoningProfile: "balanced",
    }),
  );
}

const inbound = {
  channel: "whatsapp" as const,
  channelExternalId: "phone-123",
  externalMessageId: "wamid.IN-1",
  from: "573001112233",
  displayName: "Nicolás",
  text: "hola, quiero info",
  timestamp: new Date("2026-07-15T12:00:00.000Z"),
};

describe("HandleInboundMessage (webhook → ingest → decide → ejecuta)", () => {
  it("crea Conversation+Session nuevas y responde por el sender", async () => {
    const { agents, conversations, sender, useCase } = setup();
    await seedAgent(agents);

    const result = await useCase.execute(inbound);

    expect(result.status).toBe("processed");
    const conv = await conversations.findByParticipant(
      Identity.of(binding.tenantId),
      "whatsapp",
      "573001112233",
    );
    expect(conv).not.toBeNull();
    expect(sender.sent).toHaveLength(1);
    expect(sender.sent[0].to).toBe("573001112233");
  });

  it("reutiliza la Conversation existente del mismo participante", async () => {
    const { agents, conversations, useCase } = setup();
    await seedAgent(agents);

    await useCase.execute(inbound);
    await useCase.execute({ ...inbound, externalMessageId: "wamid.IN-2" });

    // Sigue habiendo UNA conversación para ese handle.
    const conv = await conversations.findByParticipant(
      Identity.of(binding.tenantId),
      "whatsapp",
      "573001112233",
    );
    expect(conv).not.toBeNull();
  });

  it("es idempotente ante reintentos (mismo wamid → duplicate)", async () => {
    const { agents, sender, useCase } = setup();
    await seedAgent(agents);

    const first = await useCase.execute(inbound);
    const retry = await useCase.execute(inbound);

    expect(first.status).toBe("processed");
    expect(retry.status).toBe("duplicate");
    expect(sender.sent).toHaveLength(1); // no se reenvía nada
  });

  it("devuelve unbound si el phone_number_id no está registrado", async () => {
    const { useCase } = setup();
    const result = await useCase.execute({
      ...inbound,
      channelExternalId: "phone-desconocido",
    });
    expect(result.status).toBe("unbound");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/application/handle-inbound-message.test.ts`
Expected: FAIL — `HandleInboundMessage` no existe.

- [ ] **Step 4: Write the implementation**

```typescript
// src/application/use-cases/handle-inbound-message.ts
import { Channel, Identity, Session } from "@/domain";
import { Clock } from "../ports/clock";
import { IdGenerator } from "../ports/id-generator";
import type { ChannelBindingResolver } from "../ports/channel-binding";
import {
  ConversationRepository,
  DuplicateExternalEventError,
  SessionRepository,
} from "../ports/repositories";
import { StartConversation } from "./start-conversation";
import { IngestEvent } from "./ingest-event";
import { MakeDecision } from "./make-decision";
import { ExecuteDecision } from "./execute-decision";

/**
 * HandleInboundMessage — orquestador del ciclo completo para un mensaje
 * entrante de un canal externo (SSOT Cap. 6: Event → Context → Decision →
 * Action Plan → Actions).
 *
 * Resuelve qué Tenant/Agent atiende el número receptor (ChannelBinding),
 * localiza o abre la Conversation/Session del participante, registra el hecho
 * (IngestEvent), decide (MakeDecision) y materializa el plan (ExecuteDecision).
 *
 * Idempotencia: si el hecho ya fue ingerido (mismo externalId — reintento del
 * webhook), corta con status "duplicate" sin decidir ni reenviar.
 */
export interface InboundMessageInput {
  channel: Channel;
  /** Identidad del canal receptor en el proveedor (phone_number_id). */
  channelExternalId: string;
  /** Identidad del mensaje en el proveedor (wamid). */
  externalMessageId: string;
  /** Handle del remitente (wa_id del cliente). */
  from: string;
  displayName?: string;
  text: string;
  timestamp: Date;
}

export type HandleInboundMessageResult =
  | { status: "processed"; decisionId: string }
  | { status: "duplicate" }
  | { status: "unbound" };

export class HandleInboundMessage {
  constructor(
    private readonly bindings: ChannelBindingResolver,
    private readonly conversations: ConversationRepository,
    private readonly sessions: SessionRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly startConversation: StartConversation,
    private readonly ingestEvent: IngestEvent,
    private readonly makeDecision: MakeDecision,
    private readonly executeDecision: ExecuteDecision,
  ) {}

  async execute(
    input: InboundMessageInput,
  ): Promise<HandleInboundMessageResult> {
    const binding = await this.bindings.findByChannelIdentity(
      input.channel,
      input.channelExternalId,
    );
    if (!binding) return { status: "unbound" };

    const sessionId = await this.resolveActiveSession(binding.tenantId, input);

    let eventId: string;
    try {
      const ingested = await this.ingestEvent.execute({
        sessionId,
        type: "message.received",
        externalId: input.externalMessageId,
        payload: {
          wamid: input.externalMessageId,
          from: input.from,
          text: input.text,
          timestamp: input.timestamp.toISOString(),
        },
      });
      eventId = ingested.eventId;
    } catch (error) {
      if (error instanceof DuplicateExternalEventError) {
        return { status: "duplicate" };
      }
      throw error;
    }

    const { decisionId } = await this.makeDecision.execute({
      eventId,
      agentId: binding.agentId,
      funnelId: binding.funnelId,
    });

    await this.executeDecision.execute({
      decisionId,
      binding,
      to: input.from,
    });

    return { status: "processed", decisionId };
  }

  /** Conversation existente (o nueva) del participante, con Session activa. */
  private async resolveActiveSession(
    tenantId: string,
    input: InboundMessageInput,
  ): Promise<string> {
    const conversation = await this.conversations.findByParticipant(
      Identity.of(tenantId),
      input.channel,
      input.from,
    );

    if (!conversation) {
      const started = await this.startConversation.execute({
        tenantId,
        channel: input.channel,
        participant: {
          channelHandle: input.from,
          displayName: input.displayName,
        },
      });
      return started.sessionId;
    }

    const active = await this.sessions.findActiveByConversation(conversation.id);
    if (active) return active.id.toString();

    // La relación existe pero todas sus Sessions están cerradas: se abre una
    // nueva unidad operativa sobre la misma Conversation (SSOT Cap. 7 §6: el
    // cierre de una Session no cierra la Conversation).
    const session = Session.create(this.ids.next(), {
      conversationId: conversation.id,
      dimensions: {
        state: { status: "active" },
        memory: {},
        context: {},
        timeline: [{ at: this.clock.now(), kind: "session.started" }],
        variables: {},
        metadata: {},
      },
    });
    await this.sessions.save(session);
    return session.id.toString();
  }
}
```

En `src/application/use-cases/index.ts` añadir:

```typescript
export { HandleInboundMessage } from "./handle-inbound-message";
export type {
  InboundMessageInput,
  HandleInboundMessageResult,
} from "./handle-inbound-message";
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS (35 tests), tsc sin errores.

- [ ] **Step 6: Commit**

```powershell
git add src/application/use-cases/handle-inbound-message.ts src/application/use-cases/index.ts tests/fakes.ts tests/application/handle-inbound-message.test.ts
git commit -m @'
feat(application): HandleInboundMessage — orquestador del ciclo inbound completo

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
'@
```

---

### Task 6: Infraestructura WhatsApp — firma y parseo del webhook

**Files:**
- Create: `src/infrastructure/whatsapp/verify-signature.ts`
- Create: `src/infrastructure/whatsapp/parse-webhook.ts`
- Modify: `src/infrastructure/index.ts`
- Test: `tests/infrastructure/whatsapp-webhook.test.ts` (nuevo)

**Interfaces:**
- Consumes: nada del resto del sistema (funciones puras + `node:crypto`).
- Produces (lo que usa Task 8):
  - `verifyWebhookSignature(rawBody: string, signatureHeader: string | null, appSecret: string): boolean`
  - `parseWebhookPayload(payload: unknown): ParsedInboundMessage[]` con `ParsedInboundMessage = { phoneNumberId: string; wamid: string; from: string; displayName?: string; text: string; timestamp: Date }`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/infrastructure/whatsapp-webhook.test.ts
import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyWebhookSignature } from "@/infrastructure/whatsapp/verify-signature";
import { parseWebhookPayload } from "@/infrastructure/whatsapp/parse-webhook";

const SECRET = "app-secret-de-prueba";

function sign(body: string): string {
  return "sha256=" + createHmac("sha256", SECRET).update(body, "utf8").digest("hex");
}

describe("verifyWebhookSignature (X-Hub-Signature-256)", () => {
  it("acepta una firma HMAC-SHA256 válida", () => {
    const body = '{"object":"whatsapp_business_account"}';
    expect(verifyWebhookSignature(body, sign(body), SECRET)).toBe(true);
  });

  it("rechaza una firma corrupta", () => {
    const body = '{"object":"whatsapp_business_account"}';
    const bad = sign(body).slice(0, -4) + "0000";
    expect(verifyWebhookSignature(body, bad, SECRET)).toBe(false);
  });

  it("rechaza header ausente o sin prefijo sha256=", () => {
    expect(verifyWebhookSignature("{}", null, SECRET)).toBe(false);
    expect(verifyWebhookSignature("{}", "md5=abc", SECRET)).toBe(false);
  });

  it("rechaza si el body fue alterado tras firmar", () => {
    const signature = sign('{"a":1}');
    expect(verifyWebhookSignature('{"a":2}', signature, SECRET)).toBe(false);
  });
});

// Payload real (recortado) de la Cloud API de Meta para un mensaje de texto.
const metaTextPayload = {
  object: "whatsapp_business_account",
  entry: [
    {
      id: "WABA-ID",
      changes: [
        {
          field: "messages",
          value: {
            messaging_product: "whatsapp",
            metadata: {
              display_phone_number: "15550001111",
              phone_number_id: "phone-123",
            },
            contacts: [
              { profile: { name: "Nicolás" }, wa_id: "573001112233" },
            ],
            messages: [
              {
                from: "573001112233",
                id: "wamid.IN-1",
                timestamp: "1784548800",
                type: "text",
                text: { body: "hola, quiero info" },
              },
            ],
          },
        },
      ],
    },
  ],
};

// Notificación de status (delivered/read): no contiene mensajes.
const metaStatusPayload = {
  object: "whatsapp_business_account",
  entry: [
    {
      id: "WABA-ID",
      changes: [
        {
          field: "messages",
          value: {
            messaging_product: "whatsapp",
            metadata: { display_phone_number: "1555", phone_number_id: "phone-123" },
            statuses: [{ id: "wamid.OUT-1", status: "delivered" }],
          },
        },
      ],
    },
  ],
};

describe("parseWebhookPayload (Cloud API de Meta)", () => {
  it("extrae los mensajes de texto con su metadata", () => {
    const messages = parseWebhookPayload(metaTextPayload);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      phoneNumberId: "phone-123",
      wamid: "wamid.IN-1",
      from: "573001112233",
      displayName: "Nicolás",
      text: "hola, quiero info",
    });
    expect(messages[0].timestamp.toISOString()).toBe("2026-07-20T12:00:00.000Z");
  });

  it("ignora notificaciones de status", () => {
    expect(parseWebhookPayload(metaStatusPayload)).toHaveLength(0);
  });

  it("ignora mensajes que no son de texto", () => {
    const withImage = structuredClone(metaTextPayload);
    withImage.entry[0].changes[0].value.messages[0] = {
      from: "573001112233",
      id: "wamid.IN-2",
      timestamp: "1784548800",
      type: "image",
      image: { id: "media-1" },
    } as never;
    expect(parseWebhookPayload(withImage)).toHaveLength(0);
  });

  it("tolera payloads malformados sin lanzar", () => {
    expect(parseWebhookPayload(null)).toHaveLength(0);
    expect(parseWebhookPayload({})).toHaveLength(0);
    expect(parseWebhookPayload({ entry: "no-array" })).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/infrastructure/whatsapp-webhook.test.ts`
Expected: FAIL — módulos inexistentes.

- [ ] **Step 3: Write the implementations**

```typescript
// src/infrastructure/whatsapp/verify-signature.ts
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verifica la firma `X-Hub-Signature-256` de los webhooks de Meta:
 * HMAC-SHA256 del RAW body con el App Secret, en comparación de tiempo
 * constante. Debe calcularse sobre los bytes exactos recibidos (no sobre el
 * JSON re-serializado).
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string,
): boolean {
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) return false;

  const expected = createHmac("sha256", appSecret)
    .update(rawBody, "utf8")
    .digest();
  const given = Buffer.from(signatureHeader.slice("sha256=".length), "hex");

  return given.length === expected.length && timingSafeEqual(given, expected);
}
```

```typescript
// src/infrastructure/whatsapp/parse-webhook.ts
/**
 * Parseo del payload de webhooks de la WhatsApp Cloud API (Meta).
 *
 * Funciones puras y defensivas: Meta puede enviar mensajes, statuses de
 * entrega y otros cambios en el mismo POST; aquí solo se extraen los mensajes
 * de TEXTO (alcance de esta fase). Un payload malformado produce lista vacía,
 * nunca una excepción (el webhook siempre debe responder 200).
 */
export interface ParsedInboundMessage {
  /** phone_number_id del número receptor (clave del ChannelBinding). */
  phoneNumberId: string;
  /** Identidad del mensaje en Meta (idempotencia). */
  wamid: string;
  /** wa_id del remitente. */
  from: string;
  displayName?: string;
  text: string;
  timestamp: Date;
}

interface MetaContact {
  wa_id?: string;
  profile?: { name?: string };
}

interface MetaMessage {
  from?: string;
  id?: string;
  timestamp?: string;
  type?: string;
  text?: { body?: string };
}

interface MetaChangeValue {
  metadata?: { phone_number_id?: string };
  contacts?: MetaContact[];
  messages?: MetaMessage[];
}

export function parseWebhookPayload(payload: unknown): ParsedInboundMessage[] {
  const result: ParsedInboundMessage[] = [];
  if (typeof payload !== "object" || payload === null) return result;

  const entries = (payload as { entry?: unknown }).entry;
  if (!Array.isArray(entries)) return result;

  for (const entry of entries) {
    const changes = (entry as { changes?: unknown })?.changes;
    if (!Array.isArray(changes)) continue;

    for (const change of changes) {
      const value = (change as { value?: MetaChangeValue })?.value;
      const phoneNumberId = value?.metadata?.phone_number_id;
      const messages = value?.messages;
      if (!phoneNumberId || !Array.isArray(messages)) continue;

      for (const message of messages) {
        if (message?.type !== "text") continue;
        const wamid = message.id;
        const from = message.from;
        const text = message.text?.body;
        if (!wamid || !from || typeof text !== "string") continue;

        const contact = value?.contacts?.find((c) => c.wa_id === from);
        const seconds = Number(message.timestamp);
        result.push({
          phoneNumberId,
          wamid,
          from,
          displayName: contact?.profile?.name,
          text,
          timestamp: Number.isFinite(seconds)
            ? new Date(seconds * 1000)
            : new Date(),
        });
      }
    }
  }

  return result;
}
```

En `src/infrastructure/index.ts` añadir al final:

```typescript
// ── WhatsApp Cloud API ──
export { verifyWebhookSignature } from "./whatsapp/verify-signature";
export {
  parseWebhookPayload,
  type ParsedInboundMessage,
} from "./whatsapp/parse-webhook";
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS (43 tests), tsc sin errores.
Nota: el timestamp esperado es fijo y no depende de zona horaria: `new Date(1784548800 * 1000).toISOString()` = `2026-07-20T12:00:00.000Z`.

- [ ] **Step 5: Commit**

```powershell
git add src/infrastructure/whatsapp/verify-signature.ts src/infrastructure/whatsapp/parse-webhook.ts src/infrastructure/index.ts tests/infrastructure/whatsapp-webhook.test.ts
git commit -m @'
feat(whatsapp): verificación de firma y parseo del webhook de la Cloud API

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
'@
```

---

### Task 7: `WhatsAppMessageSender` + `SupabaseChannelBindingResolver`

**Files:**
- Create: `src/infrastructure/whatsapp/whatsapp-message-sender.ts`
- Create: `src/infrastructure/supabase/channel-binding-resolver.ts`
- Modify: `src/infrastructure/index.ts`
- Test: `tests/infrastructure/whatsapp-sender.test.ts` (nuevo)

**Interfaces:**
- Consumes: `MessageSender`, `OutboundMessage`, `MessageSendResult`, `ChannelBinding`, `ChannelBindingResolver` (Task 4).
- Produces (lo que usa Task 8):
  - `WhatsAppMessageSender` (implements `MessageSender`), constructor `(options?: WhatsAppSenderOptions)` con `WhatsAppSenderOptions = { accessToken?: string; graphVersion?: string; fetchFn?: typeof fetch }`.
  - `SupabaseChannelBindingResolver` (implements `ChannelBindingResolver`), constructor `(db: SupabaseClient)`.

- [ ] **Step 1: Write the failing test (sender)**

```typescript
// tests/infrastructure/whatsapp-sender.test.ts
import { describe, expect, it } from "vitest";
import { WhatsAppMessageSender } from "@/infrastructure/whatsapp/whatsapp-message-sender";
import type { ChannelBinding } from "@/application/ports";

const binding: ChannelBinding = {
  tenantId: "t1",
  channel: "whatsapp",
  externalId: "phone-123",
  agentId: "a1",
};

interface CapturedCall {
  url: string;
  init: RequestInit;
}

function makeFetchFake(response: {
  ok: boolean;
  status?: number;
  json?: unknown;
  text?: string;
}) {
  const calls: CapturedCall[] = [];
  const fetchFn = (async (url: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return {
      ok: response.ok,
      status: response.status ?? (response.ok ? 200 : 500),
      json: async () => response.json ?? {},
      text: async () => response.text ?? "",
    } as Response;
  }) as typeof fetch;
  return { calls, fetchFn };
}

describe("WhatsAppMessageSender (Graph API)", () => {
  it("envía el mensaje con URL, headers y body correctos", async () => {
    const { calls, fetchFn } = makeFetchFake({
      ok: true,
      json: { messages: [{ id: "wamid.OUT-9" }] },
    });
    const sender = new WhatsAppMessageSender({
      accessToken: "token-global",
      graphVersion: "v23.0",
      fetchFn,
    });

    const result = await sender.send({ binding, to: "573001112233", text: "¡Hola!" });

    expect(result.externalMessageId).toBe("wamid.OUT-9");
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(
      "https://graph.facebook.com/v23.0/phone-123/messages",
    );
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer token-global");
    expect(headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(String(calls[0].init.body))).toEqual({
      messaging_product: "whatsapp",
      to: "573001112233",
      type: "text",
      text: { body: "¡Hola!" },
    });
  });

  it("prioriza el accessToken del binding sobre el global", async () => {
    const { calls, fetchFn } = makeFetchFake({ ok: true, json: { messages: [] } });
    const sender = new WhatsAppMessageSender({ accessToken: "token-global", fetchFn });

    await sender.send({
      binding: { ...binding, accessToken: "token-del-binding" },
      to: "57300",
      text: "hola",
    });

    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer token-del-binding");
  });

  it("lanza ante respuesta HTTP de error", async () => {
    const { fetchFn } = makeFetchFake({ ok: false, status: 401, text: "invalid token" });
    const sender = new WhatsAppMessageSender({ accessToken: "x", fetchFn });

    await expect(
      sender.send({ binding, to: "57300", text: "hola" }),
    ).rejects.toThrow("WhatsApp send: HTTP 401");
  });

  it("lanza si no hay ningún access token disponible", async () => {
    const { fetchFn } = makeFetchFake({ ok: true });
    const sender = new WhatsAppMessageSender({ fetchFn });
    delete process.env.WHATSAPP_ACCESS_TOKEN;

    await expect(
      sender.send({ binding, to: "57300", text: "hola" }),
    ).rejects.toThrow("WHATSAPP_ACCESS_TOKEN");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/infrastructure/whatsapp-sender.test.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Write the sender implementation**

```typescript
// src/infrastructure/whatsapp/whatsapp-message-sender.ts
import type {
  MessageSender,
  MessageSendResult,
  OutboundMessage,
} from "@/application/ports";

/**
 * Adapter concreto del puerto MessageSender sobre la WhatsApp Cloud API
 * (Graph API de Meta), con fetch nativo — sin dependencias nuevas.
 *
 * Credenciales: prioridad `binding.accessToken` (BYO-número por tenant) →
 * `options.accessToken` → env `WHATSAPP_ACCESS_TOKEN` (token de plataforma).
 */
export interface WhatsAppSenderOptions {
  accessToken?: string;
  graphVersion?: string;
  /** Inyectable en tests; por defecto el fetch global de Node. */
  fetchFn?: typeof fetch;
}

interface GraphSendResponse {
  messages?: Array<{ id?: string }>;
}

export class WhatsAppMessageSender implements MessageSender {
  constructor(private readonly options: WhatsAppSenderOptions = {}) {}

  async send(message: OutboundMessage): Promise<MessageSendResult> {
    const token =
      message.binding.accessToken ??
      this.options.accessToken ??
      process.env.WHATSAPP_ACCESS_TOKEN;
    if (!token) {
      throw new Error(
        "WhatsApp: falta el access token (binding.accessToken o WHATSAPP_ACCESS_TOKEN).",
      );
    }

    const version =
      this.options.graphVersion ?? process.env.WHATSAPP_GRAPH_VERSION ?? "v23.0";
    const fetchFn = this.options.fetchFn ?? fetch;

    const response = await fetchFn(
      `https://graph.facebook.com/${version}/${message.binding.externalId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: message.to,
          type: "text",
          text: { body: message.text },
        }),
      },
    );

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`WhatsApp send: HTTP ${response.status} — ${detail}`);
    }

    const json = (await response.json()) as GraphSendResponse;
    return { externalMessageId: json.messages?.[0]?.id ?? "" };
  }
}
```

- [ ] **Step 4: Write the binding resolver**

```typescript
// src/infrastructure/supabase/channel-binding-resolver.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Channel } from "@/domain";
import type {
  ChannelBinding,
  ChannelBindingResolver,
} from "@/application/ports";

/** Fila de public.channel_bindings (migración 0002). */
interface ChannelBindingRow {
  tenant_id: string;
  channel: Channel;
  external_id: string;
  agent_id: string;
  funnel_id: string | null;
  access_token: string | null;
}

function rowToBinding(row: ChannelBindingRow): ChannelBinding {
  return {
    tenantId: row.tenant_id,
    channel: row.channel,
    externalId: row.external_id,
    agentId: row.agent_id,
    funnelId: row.funnel_id ?? undefined,
    accessToken: row.access_token ?? undefined,
  };
}

export class SupabaseChannelBindingResolver implements ChannelBindingResolver {
  constructor(private readonly db: SupabaseClient) {}

  async findByChannelIdentity(
    channel: Channel,
    externalId: string,
  ): Promise<ChannelBinding | null> {
    const { data, error } = await this.db
      .from("channel_bindings")
      .select("*")
      .eq("channel", channel)
      .eq("external_id", externalId)
      .maybeSingle();
    if (error) {
      throw new Error(`Supabase channel_bindings.select: ${error.message}`);
    }
    return data ? rowToBinding(data as ChannelBindingRow) : null;
  }
}
```

En `src/infrastructure/index.ts` añadir:

```typescript
export { WhatsAppMessageSender, type WhatsAppSenderOptions } from "./whatsapp/whatsapp-message-sender";
export { SupabaseChannelBindingResolver } from "./supabase/channel-binding-resolver";
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS (47 tests), tsc sin errores.

- [ ] **Step 6: Commit**

```powershell
git add src/infrastructure/whatsapp/whatsapp-message-sender.ts src/infrastructure/supabase/channel-binding-resolver.ts src/infrastructure/index.ts tests/infrastructure/whatsapp-sender.test.ts
git commit -m @'
feat(whatsapp): sender por Graph API + resolver de channel_bindings

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
'@
```

---

### Task 8: Route handler del webhook + wiring del container + docs

**Files:**
- Create: `src/app/api/whatsapp/webhook/route.ts`
- Modify: `src/app/_lib/container.ts`
- Modify: `.env.example`
- Modify: `docs/DEPLOY.md` (sección nueva)
- Modify: `ARCHITECTURE.md` (nota ChannelBinding)

**Interfaces:**
- Consumes: `HandleInboundMessage` (Task 5), `verifyWebhookSignature`/`parseWebhookPayload` (Task 6), `WhatsAppMessageSender`/`SupabaseChannelBindingResolver` (Task 7), `createServiceClient`, `after` de `next/server`.
- Produces: endpoints `GET/POST /api/whatsapp/webhook`; `Container.executeDecision` y `Container.handleInboundMessage`; `ContainerOptions.messageSender?: MessageSender`.

- [ ] **Step 1: Wire the container**

En `src/app/_lib/container.ts`:

Imports — añadir `SupabaseChannelBindingResolver` y `WhatsAppMessageSender` al import de `@/infrastructure`; añadir `ExecuteDecision` y `HandleInboundMessage` al import de `@/application/use-cases`; añadir `MessageSender` al import type de `@/application/ports`.

Interfaces:

```typescript
export interface Container {
  startConversation: StartConversation;
  ingestEvent: IngestEvent;
  makeDecision: MakeDecision;
  executeDecision: ExecuteDecision;
  handleInboundMessage: HandleInboundMessage;
}

export interface ContainerOptions {
  decisionEngine?: IDecisionEngine;
  /** Permite inyectar un sender falso en tests; por defecto WhatsApp Cloud API. */
  messageSender?: MessageSender;
}
```

Cuerpo de `createContainer` — tras crear `engine`, reemplazar el `return` por:

```typescript
  const bindings = new SupabaseChannelBindingResolver(db);
  const sender = options.messageSender ?? new WhatsAppMessageSender();

  const startConversation = new StartConversation(ids, clock, conversations, sessions);
  const ingestEvent = new IngestEvent(ids, clock, sessions, events);
  const makeDecision = new MakeDecision(engine, events, sessions, agents, funnels, decisions);
  const executeDecision = new ExecuteDecision(ids, clock, decisions, events, sender);

  return {
    startConversation,
    ingestEvent,
    makeDecision,
    executeDecision,
    handleInboundMessage: new HandleInboundMessage(
      bindings,
      conversations,
      sessions,
      ids,
      clock,
      startConversation,
      ingestEvent,
      makeDecision,
      executeDecision,
    ),
  };
```

- [ ] **Step 2: Create the route handler**

```typescript
// src/app/api/whatsapp/webhook/route.ts
import { after } from "next/server";
import {
  createServiceClient,
  parseWebhookPayload,
  verifyWebhookSignature,
  type ParsedInboundMessage,
} from "@/infrastructure";
import { createContainer } from "@/app/_lib/container";

/**
 * Webhook de la WhatsApp Cloud API (Meta).
 *
 * GET  — verificación de alta: Meta manda hub.verify_token y espera de vuelta
 *        hub.challenge en texto plano.
 * POST — notificaciones. Se valida la firma sobre el RAW body, se responde 200
 *        de inmediato y el pipeline (HandleInboundMessage) corre en `after()`
 *        para no provocar reintentos de Meta mientras decide el LLM.
 *
 * Seguridad: el webhook no trae JWT de usuario → usa el service client (salta
 * RLS). El aislamiento multi-tenant lo garantiza la resolución
 * channel_binding → tenant dentro del use-case.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  const expected = process.env.WHATSAPP_VERIFY_TOKEN;
  if (mode === "subscribe" && expected && token === expected) {
    return new Response(challenge ?? "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

export async function POST(request: Request) {
  const rawBody = await request.text();

  const appSecret = process.env.WHATSAPP_APP_SECRET;
  const signature = request.headers.get("x-hub-signature-256");
  if (!appSecret || !verifyWebhookSignature(rawBody, signature, appSecret)) {
    return new Response("Invalid signature", { status: 401 });
  }

  let messages: ParsedInboundMessage[] = [];
  try {
    messages = parseWebhookPayload(JSON.parse(rawBody));
  } catch {
    // Body no-JSON: firmado pero malformado; se ignora con 200.
  }

  if (messages.length > 0) {
    after(async () => {
      const container = createContainer(createServiceClient());
      for (const message of messages) {
        try {
          const result = await container.handleInboundMessage.execute({
            channel: "whatsapp",
            channelExternalId: message.phoneNumberId,
            externalMessageId: message.wamid,
            from: message.from,
            displayName: message.displayName,
            text: message.text,
            timestamp: message.timestamp,
          });
          console.log(
            JSON.stringify({
              scope: "whatsapp.webhook",
              wamid: message.wamid,
              ...result,
            }),
          );
        } catch (error) {
          console.error(
            JSON.stringify({
              scope: "whatsapp.webhook",
              wamid: message.wamid,
              error: error instanceof Error ? error.message : String(error),
            }),
          );
        }
      }
    });
  }

  // Meta solo necesita saber que recibimos la notificación.
  return new Response("EVENT_RECEIVED", { status: 200 });
}
```

- [ ] **Step 3: Update `.env.example`**

Añadir al final:

```
# ── WhatsApp Cloud API (Meta) ──
# Token que TÚ defines al dar de alta el webhook en Meta (GET de verificación).
WHATSAPP_VERIFY_TOKEN=un-secreto-que-tu-eliges
# App Secret de la app de Meta (App Settings → Basic). Firma los webhooks.
WHATSAPP_APP_SECRET=xxxxxxxxxxxxxxxx
# Token de plataforma (system user) para enviar mensajes por Graph API.
# Un binding puede traer su propio token (channel_bindings.access_token).
WHATSAPP_ACCESS_TOKEN=EAAG...
# Versión de la Graph API (opcional; default v23.0).
WHATSAPP_GRAPH_VERSION=v23.0
```

- [ ] **Step 4: Document (DEPLOY + ARCHITECTURE)**

En `docs/DEPLOY.md`, añadir sección al final:

```markdown
## WhatsApp Cloud API — alta del webhook

1. Aplica la migración `supabase/migrations/0002_whatsapp_channel.sql`.
2. Registra el binding del número (con service role o SQL directo):
   ```sql
   insert into public.channel_bindings (tenant_id, channel, external_id, agent_id)
   values ('<tenant-uuid>', 'whatsapp', '<phone_number_id>', '<agent-uuid>');
   ```
3. Define en `.env.local` (o el entorno del VPS): `WHATSAPP_VERIFY_TOKEN`,
   `WHATSAPP_APP_SECRET`, `WHATSAPP_ACCESS_TOKEN` (ver `.env.example`).
4. En Meta for Developers → tu app → WhatsApp → Configuration:
   - Callback URL: `https://<tu-dominio>/api/whatsapp/webhook`
   - Verify token: el mismo valor de `WHATSAPP_VERIFY_TOKEN`
   - Suscríbete al campo `messages`.
5. Prueba: envía un WhatsApp al número; en los logs de PM2 debe aparecer
   `{"scope":"whatsapp.webhook", ..., "status":"processed"}` y llegar la
   respuesta del agente.

Notas:
- Reintentos de Meta no duplican: la idempotencia la da `events.external_id`.
- Un `phone_number_id` sin binding responde 200 y se loguea como `unbound`.
```

En `ARCHITECTURE.md`, añadir al final de la sección «Dominio — entidades fundamentales»:

```markdown
**ChannelBinding** no es una entidad del núcleo: es un **recurso de
configuración del Tenant** (capacidad, como Knowledge/Tool) que vincula la
identidad de un canal externo (p. ej. `phone_number_id` de Meta) con el
Tenant/Agent que lo atiende. Vive como puerto en `application/ports` y tabla
`channel_bindings` en persistencia.
```

- [ ] **Step 5: Verify everything**

Run: `npx vitest run && npx tsc --noEmit && npm run build`
Expected: 47 tests PASS, tsc limpio, build OK con `/api/whatsapp/webhook` listado como ruta dinámica (ƒ).

- [ ] **Step 6: Apply migration 0002 to Supabase**

Aplicar `supabase/migrations/0002_whatsapp_channel.sql` al proyecto Supabase (vía MCP `apply_migration` o `psql` con `DIRECT_URL` — recordar el gotcha SSL: `rejectUnauthorized:false`, sin `?sslmode=require`). Verificar con `list_tables` que existe `channel_bindings` y que `events` tiene `external_id`.

- [ ] **Step 7: Commit**

```powershell
git add src/app/api/whatsapp/webhook/route.ts src/app/_lib/container.ts .env.example docs/DEPLOY.md ARCHITECTURE.md
git commit -m @'
feat(app): webhook WhatsApp (verify + inbound con after()) y wiring del container

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
'@
```

---

## Verificación final de la fase

- [ ] `npx vitest run` → 47/47 PASS
- [ ] `npx tsc --noEmit` → sin errores
- [ ] `npm run build` → OK, `/api/whatsapp/webhook` = ƒ
- [ ] Migración 0002 aplicada en Supabase
- [ ] `git push` a `origin/main`
- [ ] Actualizar checkpoint en memoria (`talkii-nextjs-migration.md`)
