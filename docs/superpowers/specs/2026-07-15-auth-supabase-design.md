# Auth + Middleware Supabase — Diseño

**Fecha:** 2026-07-15 · **Estado:** aprobado por el usuario
**Objetivo:** autenticación real (Google OAuth + email/contraseña), refresco de
sesión en middleware, aprovisionamiento self-service de Tenant con claim
`tenant_id` en el JWT (`app_metadata`) para que las políticas RLS existentes
funcionen, y protección de rutas. Respeta AA-01/02/03.

## Decisiones tomadas con el usuario

1. **Alta de tenant:** signup self-service — cada registro crea su propia
   organización (modelo SaaS).
2. **Métodos de auth:** Google OAuth **y** email/contraseña.
3. **Aprovisionamiento:** onboarding post-login unificado (enfoque A): tras la
   primera autenticación, si el JWT no trae `tenant_id`, el middleware manda a
   `/onboarding`, donde el usuario nombra su organización. Mismo flujo para
   ambos métodos; idempotente.

## 1. Alcance

Incluye: página `/login` (botón Google + form email/contraseña), `/register`
(email/contraseña), route handler `/auth/callback` (OAuth code exchange),
`/onboarding` (crear organización), `/dashboard` placeholder (nombre del
tenant + logout), `src/middleware.ts` (refresco de sesión + protección),
use-case `ProvisionTenant` + puerto `AuthGateway`.

Excluye: recuperación de contraseña, confirmación de email (desactivada en
Supabase Auth en esta fase, documentado), invitar usuarios a un tenant
existente, gestión de perfil, OAuth providers adicionales.

## 2. Application

- **Puerto `AuthGateway`** (`application/ports/auth-gateway.ts`):
  `assignTenantToUser(userId: string, tenantId: string): Promise<void>`.
  Abstrae el mecanismo de identidad; la capa no conoce Supabase.
- **Use-case `ProvisionTenant`** (`application/use-cases/provision-tenant.ts`):
  entrada `{ userId: string; organizationName: string }` → crea `Tenant`
  (entidad existente, `TenantRepository.save`) → `AuthGateway.assignTenantToUser`
  → devuelve `{ tenantId }`. Sin lógica condicional de idempotencia dentro (la
  garantiza la capa app: si ya hay claim no se llega aquí).

## 3. Infraestructura

- **`SupabaseAuthGateway`** (`infrastructure/supabase/auth-gateway.ts`):
  implementa el puerto con la admin API — `db.auth.admin.updateUserById(userId,
  { app_metadata: { tenant_id: tenantId } })`. Requiere el **service client**
  (`createServiceClient()` existente). Error de la API → throw (sin tragar).

## 4. App (Next.js)

- **`src/middleware.ts`** — patrón oficial `@supabase/ssr`: crea el server
  client con cookies de la request, `getUser()` refresca la sesión y reescribe
  cookies en la response. Decisión de rutas delegada en un helper puro
  **`resolveRedirect(pathname, session)`** (testeable sin Next):
  - Sin usuario y ruta protegida → `/login`.
  - Con usuario sin claim `tenant_id` y ruta ≠ `/onboarding` → `/onboarding`.
  - Con usuario y claim en `/login`, `/register` u `/onboarding` → `/dashboard`.
  - Públicas siempre: `/login`, `/register`, `/auth/*`, `/api/whatsapp/webhook`,
    `/api/health`, `/` (landing), estáticos (`_next`, favicon).
- **Páginas** (CSS Modules desde cero sobre `tokens.css`): `/login`,
  `/register`, `/onboarding`, `/dashboard` (muestra nombre del tenant leído
  con el container por RLS — primera lectura real con el claim — y botón
  logout).
- **`/auth/callback/route.ts`**: `exchangeCodeForSession(code)` y redirect a
  `/dashboard` (el middleware reencamina a `/onboarding` si falta claim).
  OAuth cancelado/fallido → `/login?error=oauth`.
- **Server Actions** (`src/app/_lib/auth-actions.ts`): `signInWithPassword`,
  `signUpWithPassword`, `signInWithGoogle` (redirect a URL de Supabase),
  `signOut`, `provisionTenant` (usa `ProvisionTenant` con service client y
  luego `refreshSession()` para que el JWT recoja el claim).
- **Env nueva:** `NEXT_PUBLIC_SITE_URL` (base para el redirect OAuth).
  Configuración de Google Cloud + Supabase Auth provider documentada en
  `docs/DEPLOY.md`.

## 5. Errores y casos borde

| Caso | Comportamiento |
|---|---|
| Credenciales inválidas / email ya registrado | mensaje genérico en el form (no filtra qué falló) |
| OAuth cancelado o error en callback | redirect `/login?error=oauth` con aviso |
| Autenticado sin tenant (cualquier ruta protegida) | middleware → `/onboarding` |
| Doble submit de onboarding / ya tiene claim | middleware redirige a `/dashboard` sin crear otro tenant |
| Falla `assignTenantToUser` tras crear Tenant | error visible en el form; reintentar onboarding no duplica usuario (sí puede quedar un tenant huérfano — aceptado en esta fase, se loguea) |
| Claim no aparece tras aprovisionar | la action fuerza `refreshSession()` antes del redirect |

## 6. Tests (Vitest, patrones del repo)

- `ProvisionTenant` con `TenantRepository` en memoria y `AuthGateway` falso:
  crea el tenant, asigna el claim, propaga el fallo del gateway.
- `resolveRedirect` (helper puro): tabla de casos ruta×sesión (anónimo,
  autenticado sin claim, autenticado con claim; rutas públicas/protegidas).
- Páginas y actions quedan finas; verificación por `next build` + prueba
  manual del flujo completo.
