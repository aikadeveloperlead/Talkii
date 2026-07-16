# Talkii

Plataforma SaaS para ejecutar **estrategias conversacionales con agentes de IA sobre WhatsApp**. El núcleo es el _Agent Runtime_ — no es un chatbot, ni un CRM, ni un sistema de mensajería.

## Stack

- **Frontend:** Next.js (App Router) + TypeScript + CSS Modules (sin Tailwind ni shadcn/ui)
- **Backend:** Next.js API Routes + Supabase (PostgreSQL · RLS · Auth · Realtime · Storage · Edge Functions)
- **Estado:** TanStack Query + React Context
- **WhatsApp:** Meta Cloud API nativa (sin n8n ni middleware)
- **Razonamiento:** `IReasoningProvider` abstracto (OpenAI / Anthropic / Google intercambiables)
- **Multi-tenant:** RLS de Supabase; cada tabla lleva `tenant_id`
- **Dominio:** TypeScript puro, cero dependencias externas, Ports & Adapters
- **Deploy:** VPS propio

## Constitución de ingeniería

- **AA-01 — Domain Before Persistence:** toda estructura de persistencia justifica su entidad de dominio y caso de uso. Flujo: Domain → Entities → Use Cases → Persistence Model → Physical Model.
- **AA-02 — Decision Engine Independence:** el motor de decisiones abstrae todo origen de decisión; el LLM es solo un mecanismo. El dominio nunca depende directamente de un LLM.
- **AA-03 — Architecture Validation Gate:** antes de implementar funcionalidad, validar separación de capas, bounded contexts, dependencias y coherencia con el SSOT.

## Desarrollo

```bash
npm run dev    # servidor de desarrollo en http://localhost:3000
npm run build  # build de producción
npm run lint   # linter
```
