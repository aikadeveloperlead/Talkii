# Arquitectura de Talkii

Documento de referencia del **Architecture Validation Gate (AA-03)**. Toda
implementación funcional debe validarse contra estas reglas antes de escribirse.
La fuente de verdad conceptual es el SSOT en `Downloads/Talkii/single source of true/`.

## Capas (Clean Architecture · Ports & Adapters)

```
src/
  domain/          Núcleo. TypeScript puro, CERO dependencias externas.
                   Entidades, objetos de valor e invariantes del negocio.
  application/     Casos de uso + puertos (interfaces). Orquesta el dominio.
    ports/         Interfaces: IReasoningProvider, IDecisionEngine, repositorios.
    use-cases/     Un caso de uso por responsabilidad del negocio.
  infrastructure/  Adapters concretos: Supabase, WhatsApp Cloud API, proveedores
                   de razonamiento (OpenAI/Anthropic/Google). Implementan puertos.
  app/             Next.js App Router: UI (CSS Modules) + API routes.
  styles/          Design system (tokens + globals).
```

## Regla de dependencias (SSOT Regla 12 — dependencias hacia el dominio)

Las dependencias **siempre apuntan hacia dentro**:

```
app / infrastructure  ──►  application  ──►  domain
```

- `domain/` no importa NADA de `application`, `infrastructure`, `app`, Next,
  React, Supabase, ni ninguna librería externa.
- `application/` importa `domain`; define puertos (interfaces) que
  `infrastructure` implementa. No conoce Next ni Supabase.
- `infrastructure/` implementa los puertos de `application` usando tecnología
  concreta.
- `app/` (Next.js) es el punto de entrada; compone casos de uso e infraestructura.

## Dominio — entidades fundamentales (SSOT Cap. 7)

Núcleo estable de 7 entidades. No se agrega ninguna sin ADR.

| Entidad | Naturaleza | Contexto (carpeta) |
|---|---|---|
| **Tenant** | Raíz | `domain/identity-access` |
| **Agent** | Estratégica | `domain/agent-strategy` |
| **Funnel** | Estratégica | `domain/conversational-strategy` |
| **Conversation** | Relacional | `domain/conversation` |
| **Session** | Operativa | `domain/execution` |
| **Event** | Dominio | `domain/execution` |
| **Decision** | Dominio | `domain/execution` |

**Excluidos como entidades** (objetos de valor / dimensiones / capacidades):
`State`, `Memory`, `Context`, `Timeline` (dimensiones de Session), `Policy`
(capacidad de Agent), `Knowledge`, `Tool` (capacidades del Tenant/Agent),
`Action` (producto de Decision).

## Principios permanentes (Constitución de ingeniería)

- **AA-01 — Domain Before Persistence:** toda estructura de persistencia
  justifica su entidad de dominio y caso de uso. Flujo: Domain → Entities →
  Use Cases → Persistence Model → Physical Model. Nunca al revés.
- **AA-02 — Decision Engine Independence:** el motor de decisiones abstrae todo
  origen de decisión (reglas, políticas, workflows, humanos, IA, clasificadores).
  El LLM es solo un mecanismo detrás de un puerto; el dominio nunca depende de él.
- **AA-03 — Architecture Validation Gate:** antes de implementar, validar
  separación de capas, bounded contexts, dependencias, reglas de import y
  coherencia con el SSOT.

## Modelo de ejecución (SSOT Cap. 6)

```
Event → Context → (Policy) → Decision → Action Plan → Actions → New State → Persistence
```

La **Decision** es el centro del comportamiento; deriva de un único **Event** y
produce un plan de **Actions** que modifican el dominio al ejecutarse.

## Multi-tenant

Toda entidad operativa pertenece a exactamente un `Tenant` (invariante SSOT §4).
En persistencia, cada tabla llevará `tenant_id` con RLS de Supabase.
