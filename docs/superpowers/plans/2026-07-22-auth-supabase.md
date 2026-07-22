# Auth + Middleware Supabase — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship real authentication (Google OAuth + email/password), session refresh at the edge, self-service Tenant onboarding that stamps `app_metadata.tenant_id` on the user's JWT, and route protection — so the existing RLS policies (which read that claim) start working for real users instead of only service-role calls.

**Architecture:** New `AuthGateway` port (application) abstracts identity-provider claim assignment; `SupabaseAuthGateway` (infrastructure) implements it via the Supabase admin API. New `ProvisionTenant` use-case creates the `Tenant` entity and calls the gateway — no Next.js types below the `app` layer (AA-01/AA-02 respected: this is domain/app orchestration, not a framework feature). The `app` layer wires Server Actions, four new pages, an OAuth callback Route Handler, and a `proxy.ts` (Next 16's renamed `middleware.ts`) that refreshes the Supabase session cookie and redirects based on a pure, unit-tested helper `resolveRedirect`.

**Tech Stack:** Next.js 16.2.10 (App Router) + React 19 + TypeScript, `@supabase/ssr` (session refresh) + `@supabase/supabase-js` (admin API), CSS Modules (no Tailwind/shadcn), Vitest.

## Global Constraints

- No Tailwind, no shadcn/Radix — CSS Modules per page, built on `src/styles/tokens.css`.
- App Router only; backend as Next.js Route Handlers; Supabase as the only DB.
- AA-01 (Domain Before Persistence): `ProvisionTenant` must go through `Tenant.create()` and `TenantRepository`, never write rows directly.
- AA-02 (Decision Engine Independence): not touched by this phase — no LLM involved in auth.
- AA-03: this phase only adds `application`/`infrastructure`/`app` code that depends inward on existing ports; no dependency arrows are reversed.
- **Next.js 16 breaking change (confirmed against `node_modules/next/dist/docs`):** `middleware.ts` is deprecated and renamed to **`proxy.ts`**, exporting a function named `proxy` (not `middleware`). The approved spec (`docs/superpowers/specs/2026-07-15-auth-supabase-design.md`) says `src/middleware.ts` — this plan uses `src/proxy.ts` instead; this is a framework-version adaptation of the same design, not a scope change.
- Scope excludes: password recovery, email-confirmation flow (disabled in Supabase Auth for this phase — documented, not built), inviting users to an existing tenant, profile management, additional OAuth providers.
- Error convention (existing repo pattern): infrastructure failures throw `Error` with a prefixed message; "not found" returns `null`. Never swallow silently.
- Per `AGENTS.md`: this Next.js version has breaking changes vs. training data — every file below was checked against `node_modules/next/dist/docs` before being written (proxy, route handlers, server actions, searchParams-as-Promise all confirmed for v16).

---

## File Structure

**Application layer:**
- `src/application/ports/auth-gateway.ts` — new `AuthGateway` port.
- `src/application/ports/index.ts` — export it.
- `src/application/use-cases/provision-tenant.ts` — new `ProvisionTenant` use-case.
- `src/application/use-cases/index.ts` — export it.

**Infrastructure layer:**
- `src/infrastructure/supabase/auth-gateway.ts` — new `SupabaseAuthGateway`.
- `src/infrastructure/index.ts` — export it.

**App layer:**
- `src/app/_lib/resolve-redirect.ts` — pure routing-decision helper (no Next imports).
- `src/proxy.ts` — Next 16 Proxy (session refresh + redirect via `resolveRedirect`).
- `src/app/_lib/auth-actions.ts` — Server Actions: `signInWithPassword`, `signUpWithPassword`, `signInWithGoogle`, `signOut`, `provisionTenant`.
- `src/app/login/page.tsx` + `page.module.css`
- `src/app/register/page.tsx` + `page.module.css`
- `src/app/onboarding/page.tsx` + `page.module.css`
- `src/app/dashboard/page.tsx` + `page.module.css`
- `src/app/auth/callback/route.ts` — OAuth code exchange.

**Tests:**
- `tests/fakes.ts` — add `FakeAuthGateway`.
- `tests/application/provision-tenant.test.ts`
- `tests/app/resolve-redirect.test.ts`

**Docs/config:**
- `.env.example` — add `NEXT_PUBLIC_SITE_URL`.
- `docs/DEPLOY.md` — add Google OAuth + Supabase Auth provider setup, and the "disable email confirmations" note.

---

### Task 1: `AuthGateway` port + `ProvisionTenant` use-case (TDD)

**Files:**
- Create: `src/application/ports/auth-gateway.ts`
- Modify: `src/application/ports/index.ts`
- Create: `src/application/use-cases/provision-tenant.ts`
- Modify: `src/application/use-cases/index.ts`
- Modify: `tests/fakes.ts` (add `FakeAuthGateway`)
- Test: `tests/application/provision-tenant.test.ts`

**Interfaces:**
- Produces: `AuthGateway.assignTenantToUser(userId: string, tenantId: string): Promise<void>`.
- Produces: `ProvisionTenant` — constructor `(ids: IdGenerator, tenants: TenantRepository, authGateway: AuthGateway)`; method `execute(input: { userId: string; organizationName: string }): Promise<{ tenantId: string }>`.
- Consumes: `IdGenerator.next(): Identity`, `TenantRepository.save/findById`, `Tenant.create(id, { name })` — all existing.

- [ ] **Step 1: Create the `AuthGateway` port**

```ts
// src/application/ports/auth-gateway.ts
/**
 * Puerto: aprovisionamiento de identidad.
 *
 * Abstrae el mecanismo de identidad (Supabase Auth admin API, o cualquier
 * otro proveedor) para que la capa `application` nunca dependa de Supabase
 * directamente (AA-01/AA-03).
 */
export interface AuthGateway {
  assignTenantToUser(userId: string, tenantId: string): Promise<void>;
}
```

- [ ] **Step 2: Export the port from the barrel**

Edit `src/application/ports/index.ts`, add after the `ChannelBinding` export line:

```ts
export type { AuthGateway } from "./auth-gateway";
```

- [ ] **Step 3: Add `FakeAuthGateway` to the test doubles**

Edit `tests/fakes.ts`. Add `AuthGateway` to the `import type { ... } from "@/application/ports";` block (alphabetical, after `AgentRepository`):

```ts
  AgentRepository,
  AuthGateway,
```

Then append at the end of the file:

```ts
/** AuthGateway falso: registra las asignaciones; puede inyectarse para fallar. */
export class FakeAuthGateway implements AuthGateway {
  assignments: { userId: string; tenantId: string }[] = [];
  constructor(private readonly failWith?: Error) {}
  async assignTenantToUser(userId: string, tenantId: string): Promise<void> {
    if (this.failWith) throw this.failWith;
    this.assignments.push({ userId, tenantId });
  }
}
```

- [ ] **Step 4: Write the failing test**

```ts
// tests/application/provision-tenant.test.ts
import { describe, expect, it } from "vitest";
import { Identity } from "@/domain";
import { ProvisionTenant } from "@/application/use-cases";
import { FakeAuthGateway, InMemoryTenants, SequentialIds } from "../fakes";

describe("ProvisionTenant (fase Auth + onboarding)", () => {
  it("crea el Tenant y asigna el claim tenant_id al usuario", async () => {
    const ids = new SequentialIds();
    const tenants = new InMemoryTenants();
    const authGateway = new FakeAuthGateway();
    const useCase = new ProvisionTenant(ids, tenants, authGateway);

    const { tenantId } = await useCase.execute({
      userId: "user-1",
      organizationName: "Acme Corp",
    });

    const stored = await tenants.findById(Identity.of(tenantId));
    expect(stored?.name).toBe("Acme Corp");
    expect(authGateway.assignments).toEqual([{ userId: "user-1", tenantId }]);
  });

  it("propaga el fallo si el AuthGateway no puede asignar el claim (tenant huérfano aceptado)", async () => {
    const ids = new SequentialIds();
    const tenants = new InMemoryTenants();
    const authGateway = new FakeAuthGateway(new Error("admin API caída"));
    const useCase = new ProvisionTenant(ids, tenants, authGateway);

    await expect(
      useCase.execute({ userId: "user-1", organizationName: "Acme Corp" }),
    ).rejects.toThrow("admin API caída");

    const orphaned = await tenants.findById(Identity.of("id-1"));
    expect(orphaned?.name).toBe("Acme Corp");
  });
});
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `npx vitest run tests/application/provision-tenant.test.ts`
Expected: FAIL — `Cannot find module '@/application/use-cases'` export `ProvisionTenant` (or similar "not exported"/"not a constructor" error), since the use-case doesn't exist yet.

- [ ] **Step 6: Implement `ProvisionTenant`**

```ts
// src/application/use-cases/provision-tenant.ts
import { Tenant } from "@/domain";
import { AuthGateway } from "../ports/auth-gateway";
import { IdGenerator } from "../ports/id-generator";
import { TenantRepository } from "../ports/repositories";

/**
 * ProvisionTenant — aprovisionamiento self-service de una organización.
 *
 * Materializa la decisión de onboarding (SSOT: signup self-service, cada
 * registro crea su propia organización). Sin lógica condicional de
 * idempotencia dentro: la capa `app` garantiza que solo se invoca cuando el
 * usuario aún no tiene el claim `tenant_id`.
 */
export interface ProvisionTenantInput {
  userId: string;
  organizationName: string;
}

export interface ProvisionTenantResult {
  tenantId: string;
}

export class ProvisionTenant {
  constructor(
    private readonly ids: IdGenerator,
    private readonly tenants: TenantRepository,
    private readonly authGateway: AuthGateway,
  ) {}

  async execute(input: ProvisionTenantInput): Promise<ProvisionTenantResult> {
    const tenant = Tenant.create(this.ids.next(), {
      name: input.organizationName,
    });

    await this.tenants.save(tenant);
    await this.authGateway.assignTenantToUser(
      input.userId,
      tenant.id.toString(),
    );

    return { tenantId: tenant.id.toString() };
  }
}
```

- [ ] **Step 7: Export the use-case from the barrel**

Edit `src/application/use-cases/index.ts`, append:

```ts
export { ProvisionTenant } from "./provision-tenant";
export type {
  ProvisionTenantInput,
  ProvisionTenantResult,
} from "./provision-tenant";
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npx vitest run tests/application/provision-tenant.test.ts`
Expected: PASS (2/2).

- [ ] **Step 9: Commit**

```bash
git add src/application/ports/auth-gateway.ts src/application/ports/index.ts \
  src/application/use-cases/provision-tenant.ts src/application/use-cases/index.ts \
  tests/fakes.ts tests/application/provision-tenant.test.ts
git commit -m "feat(application): puerto AuthGateway + caso de uso ProvisionTenant"
```

---

### Task 2: `SupabaseAuthGateway` (infrastructure adapter)

**Files:**
- Create: `src/infrastructure/supabase/auth-gateway.ts`
- Modify: `src/infrastructure/index.ts`

**Interfaces:**
- Consumes: `AuthGateway` (Task 1), `SupabaseClient` from `@supabase/supabase-js`.
- Produces: `SupabaseAuthGateway` class, constructor `(db: SupabaseClient)`.

No unit test: this class's only logic is a single call to the Supabase admin API (`auth.admin.updateUserById`), which requires a live service-role client and is exercised end-to-end in the manual verification of Task 11 — this matches the existing convention in the repo where `SupabaseTenantRepository` etc. have no unit tests either (only the pure `mappers.ts` round-trips are tested; RLS/admin behavior is verified against the real DB, per the comment in `tests/infrastructure/mappers.test.ts`).

- [ ] **Step 1: Implement the adapter**

```ts
// src/infrastructure/supabase/auth-gateway.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthGateway } from "@/application/ports";

/**
 * Implementa AuthGateway con la admin API de Supabase Auth. Requiere un
 * cliente con service-role (`createServiceClient`) — `updateUserById` no está
 * disponible con el anon key. Un fallo de la API se propaga como Error (no se
 * traga), igual que el resto de adaptadores de `infrastructure/supabase`.
 */
export class SupabaseAuthGateway implements AuthGateway {
  constructor(private readonly db: SupabaseClient) {}

  async assignTenantToUser(userId: string, tenantId: string): Promise<void> {
    const { error } = await this.db.auth.admin.updateUserById(userId, {
      app_metadata: { tenant_id: tenantId },
    });
    if (error) {
      throw new Error(
        `Supabase auth.admin.updateUserById: ${error.message}`,
      );
    }
  }
}
```

- [ ] **Step 2: Export it from the infrastructure barrel**

Edit `src/infrastructure/index.ts`, add after the `SupabaseChannelBindingResolver` export:

```ts
export { SupabaseAuthGateway } from "./supabase/auth-gateway";
```

- [ ] **Step 3: Verify the project still type-checks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/infrastructure/supabase/auth-gateway.ts src/infrastructure/index.ts
git commit -m "feat(infrastructure): SupabaseAuthGateway sobre la admin API"
```

---

### Task 3: `resolveRedirect` pure helper (TDD)

**Files:**
- Create: `src/app/_lib/resolve-redirect.ts`
- Test: `tests/app/resolve-redirect.test.ts`

**Interfaces:**
- Produces: `type ProxySession = { userId: string; tenantId: string | null } | null;` and `resolveRedirect(pathname: string, session: ProxySession): string | null` (returns the path to redirect to, or `null` to let the request through).

Routing rules (from the spec's case table):
1. Authenticated **with** `tenantId`, visiting `/login`, `/register`, or `/onboarding` → `/dashboard` (covers "double submit of onboarding" — no new tenant created, per Task 1's use-case not being invoked again).
2. `/onboarding` itself: reachable iff there's a session (any session); otherwise → `/login`.
3. Public paths (`/`, `/login`, `/register`, `/api/health`, and anything under `/auth` or `/api/whatsapp/webhook`) never redirect beyond rule 1.
4. Any other path (protected): no session → `/login`; session without `tenantId` → `/onboarding`; session with `tenantId` → pass through (`null`).

- [ ] **Step 1: Write the failing test**

```ts
// tests/app/resolve-redirect.test.ts
import { describe, expect, it } from "vitest";
import { resolveRedirect, type ProxySession } from "@/app/_lib/resolve-redirect";

const anon: ProxySession = null;
const noTenant: ProxySession = { userId: "u1", tenantId: null };
const withTenant: ProxySession = { userId: "u1", tenantId: "t1" };

describe("resolveRedirect (proxy — SSOT diseño auth)", () => {
  it("anónimo en ruta protegida -> /login", () => {
    expect(resolveRedirect("/dashboard", anon)).toBe("/login");
  });

  it("anónimo en rutas públicas -> pasa (null)", () => {
    expect(resolveRedirect("/", anon)).toBeNull();
    expect(resolveRedirect("/login", anon)).toBeNull();
    expect(resolveRedirect("/register", anon)).toBeNull();
    expect(resolveRedirect("/api/health", anon)).toBeNull();
    expect(resolveRedirect("/auth/callback", anon)).toBeNull();
    expect(resolveRedirect("/api/whatsapp/webhook", anon)).toBeNull();
  });

  it("anónimo en /onboarding -> /login", () => {
    expect(resolveRedirect("/onboarding", anon)).toBe("/login");
  });

  it("autenticado sin tenant en ruta protegida -> /onboarding", () => {
    expect(resolveRedirect("/dashboard", noTenant)).toBe("/onboarding");
  });

  it("autenticado sin tenant en /onboarding -> pasa (null)", () => {
    expect(resolveRedirect("/onboarding", noTenant)).toBeNull();
  });

  it("autenticado con tenant en /login, /register u /onboarding -> /dashboard (incluye doble submit)", () => {
    expect(resolveRedirect("/login", withTenant)).toBe("/dashboard");
    expect(resolveRedirect("/register", withTenant)).toBe("/dashboard");
    expect(resolveRedirect("/onboarding", withTenant)).toBe("/dashboard");
  });

  it("autenticado con tenant en ruta protegida -> pasa (null)", () => {
    expect(resolveRedirect("/dashboard", withTenant)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/app/resolve-redirect.test.ts`
Expected: FAIL — `Cannot find module '@/app/_lib/resolve-redirect'`.

- [ ] **Step 3: Implement the helper**

```ts
// src/app/_lib/resolve-redirect.ts
/**
 * Decisión de enrutamiento del Proxy (Next 16 — antes `middleware`), sin
 * dependencias de Next.js: testeable de forma pura. Ver el diseño en
 * docs/superpowers/specs/2026-07-15-auth-supabase-design.md §4.
 */
export type ProxySession = { userId: string; tenantId: string | null } | null;

const PUBLIC_EXACT = new Set(["/", "/login", "/register", "/api/health"]);
const PUBLIC_PREFIXES = ["/auth", "/api/whatsapp/webhook"];
const AUTH_ROUTES = new Set(["/login", "/register", "/onboarding"]);

function isPublic(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true;
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function resolveRedirect(
  pathname: string,
  session: ProxySession,
): string | null {
  if (session?.tenantId && AUTH_ROUTES.has(pathname)) {
    return "/dashboard";
  }

  if (pathname === "/onboarding") {
    return session ? null : "/login";
  }

  if (isPublic(pathname)) {
    return null;
  }

  if (!session) {
    return "/login";
  }

  if (!session.tenantId) {
    return "/onboarding";
  }

  return null;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/app/resolve-redirect.test.ts`
Expected: PASS (7/7).

- [ ] **Step 5: Commit**

```bash
git add src/app/_lib/resolve-redirect.ts tests/app/resolve-redirect.test.ts
git commit -m "feat(app): resolveRedirect — helper puro de enrutamiento para el Proxy"
```

---

### Task 4: `src/proxy.ts` (Next 16 Proxy — session refresh)

**Files:**
- Create: `src/proxy.ts`

**Interfaces:**
- Consumes: `resolveRedirect`, `ProxySession` (Task 3); `createServerClient` from `@supabase/ssr`.

No unit test (Proxy needs the Next.js request/cookie runtime; `resolveRedirect`, the only branching logic, is already covered in Task 3). Verified via `next build` (Task 11) plus the manual walkthrough.

- [ ] **Step 1: Implement the Proxy**

```ts
// src/proxy.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { resolveRedirect, type ProxySession } from "@/app/_lib/resolve-redirect";

/**
 * Proxy (Next 16 — reemplaza `middleware`): refresca la sesión de Supabase en
 * cada request (patrón oficial `@supabase/ssr`) y decide redirecciones con el
 * helper puro `resolveRedirect`. No hace verificación de autorización fina —
 * eso vive en RLS y en cada Server Action/Route Handler (ver Next.js docs,
 * guía de autenticación: Proxy es un chequeo optimista, no la única defensa).
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Supabase: faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY en el entorno.",
    );
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const session: ProxySession = user
    ? {
        userId: user.id,
        tenantId:
          ((user.app_metadata as Record<string, unknown> | undefined)
            ?.tenant_id as string | undefined) ?? null,
      }
    : null;

  const target = resolveRedirect(request.nextUrl.pathname, session);
  if (target) {
    return NextResponse.redirect(new URL(target, request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/proxy.ts
git commit -m "feat(app): Proxy Next 16 — refresco de sesión Supabase + redirecciones"
```

---

### Task 5: Server Actions (`auth-actions.ts`)

**Files:**
- Create: `src/app/_lib/auth-actions.ts`

**Interfaces:**
- Consumes: `createServerSupabase` (existing), `createServiceClient`, `SupabaseTenantRepository`, `SupabaseAuthGateway`, `UuidIdGenerator` (all from `@/infrastructure`), `ProvisionTenant` (Task 1).
- Produces: `signInWithPassword`, `signUpWithPassword`, `signInWithGoogle`, `signOut`, `provisionTenant` — all `(formData?: FormData) => Promise<void>`, usable directly as a `<form action={...}>`.

No unit test: every branch ends in `redirect()` (a Next.js control-flow throw) or a call already covered by Task 1/2's tests. Verified via `next build` + the manual flow in Task 11, matching the spec's own verification plan ("Páginas y actions quedan finas; verificación por next build + prueba manual").

- [ ] **Step 1: Implement the actions**

```ts
// src/app/_lib/auth-actions.ts
"use server";

import { redirect } from "next/navigation";
import {
  createServiceClient,
  SupabaseAuthGateway,
  UuidIdGenerator,
} from "@/infrastructure";
import { SupabaseTenantRepository } from "@/infrastructure/supabase/repositories";
import { ProvisionTenant } from "@/application/use-cases";
import { createServerSupabase } from "./supabase-server";

export async function signInWithPassword(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const db = await createServerSupabase();
  const { error } = await db.auth.signInWithPassword({ email, password });
  if (error) {
    redirect("/login?error=invalid-credentials");
  }
  redirect("/dashboard");
}

export async function signUpWithPassword(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const db = await createServerSupabase();
  const { error } = await db.auth.signUp({ email, password });
  if (error) {
    redirect("/register?error=signup-failed");
  }
  redirect("/dashboard");
}

export async function signInWithGoogle(): Promise<void> {
  const db = await createServerSupabase();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const { data, error } = await db.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${siteUrl}/auth/callback` },
  });

  if (error || !data.url) {
    redirect("/login?error=oauth");
  }
  redirect(data.url);
}

export async function signOut(): Promise<void> {
  const db = await createServerSupabase();
  await db.auth.signOut();
  redirect("/login");
}

export async function provisionTenant(formData: FormData): Promise<void> {
  const organizationName = String(formData.get("organizationName") ?? "").trim();
  if (!organizationName) {
    redirect("/onboarding?error=missing-name");
  }

  const db = await createServerSupabase();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const service = createServiceClient();
  const useCase = new ProvisionTenant(
    new UuidIdGenerator(),
    new SupabaseTenantRepository(service),
    new SupabaseAuthGateway(service),
  );

  try {
    await useCase.execute({ userId: user.id, organizationName });
  } catch (err) {
    console.error("provisionTenant: fallo al aprovisionar el tenant", err);
    redirect("/onboarding?error=provision-failed");
  }

  await db.auth.refreshSession();
  redirect("/dashboard");
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/_lib/auth-actions.ts
git commit -m "feat(app): Server Actions de auth (login, signup, OAuth, logout, onboarding)"
```

---

### Task 6: `/login` page

**Files:**
- Create: `src/app/login/page.tsx`
- Create: `src/app/login/page.module.css`

**Interfaces:**
- Consumes: `signInWithPassword`, `signInWithGoogle` (Task 5).

- [ ] **Step 1: Implement the page**

```tsx
// src/app/login/page.tsx
import Link from "next/link";
import { signInWithGoogle, signInWithPassword } from "@/app/_lib/auth-actions";
import styles from "./page.module.css";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className={styles.main}>
      <section className={styles.card}>
        <h1 className={styles.title}>Iniciar sesión</h1>
        {error && (
          <p className={styles.error}>
            No pudimos iniciar tu sesión. Verifica tus datos e intenta de nuevo.
          </p>
        )}

        <form action={signInWithGoogle}>
          <button type="submit" className={styles.googleButton}>
            Continuar con Google
          </button>
        </form>

        <div className={styles.divider}>o</div>

        <form action={signInWithPassword} className={styles.form}>
          <label className={styles.label} htmlFor="email">
            Email
          </label>
          <input
            className={styles.input}
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
          />
          <label className={styles.label} htmlFor="password">
            Contraseña
          </label>
          <input
            className={styles.input}
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
          <button type="submit" className={styles.submitButton}>
            Entrar
          </button>
        </form>

        <p className={styles.footer}>
          ¿No tienes cuenta? <Link href="/register">Regístrate</Link>
        </p>
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Implement the styles**

```css
/* src/app/login/page.module.css */
.main {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-8);
  background: var(--color-body-bg);
}

.card {
  width: 100%;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-8);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
}

.title {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  text-align: center;
}

.error {
  padding: var(--space-3);
  font-size: var(--font-size-sm);
  color: var(--color-error-dark);
  background: var(--color-error-light);
  border-radius: var(--radius-md);
}

.googleButton {
  width: 100%;
  padding: var(--space-3);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: var(--transition-fast);
}

.googleButton:hover {
  background: var(--color-surface-raised);
}

.divider {
  text-align: center;
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
}

.input {
  padding: var(--space-3);
  font-size: var(--font-size-base);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.submitButton {
  padding: var(--space-3);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-white);
  background: var(--color-primary-600);
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: var(--transition-fast);
}

.submitButton:hover {
  background: var(--color-primary-700);
}

.footer {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  text-align: center;
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/login
git commit -m "feat(app): página /login (Google OAuth + email/contraseña)"
```

---

### Task 7: `/register` page

**Files:**
- Create: `src/app/register/page.tsx`
- Create: `src/app/register/page.module.css`

**Interfaces:**
- Consumes: `signUpWithPassword` (Task 5).

- [ ] **Step 1: Implement the page**

```tsx
// src/app/register/page.tsx
import Link from "next/link";
import { signUpWithPassword } from "@/app/_lib/auth-actions";
import styles from "./page.module.css";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className={styles.main}>
      <section className={styles.card}>
        <h1 className={styles.title}>Crear cuenta</h1>
        {error && (
          <p className={styles.error}>
            No pudimos crear tu cuenta. Verifica los datos e intenta de nuevo.
          </p>
        )}

        <form action={signUpWithPassword} className={styles.form}>
          <label className={styles.label} htmlFor="email">
            Email
          </label>
          <input
            className={styles.input}
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
          />
          <label className={styles.label} htmlFor="password">
            Contraseña
          </label>
          <input
            className={styles.input}
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
          <button type="submit" className={styles.submitButton}>
            Registrarme
          </button>
        </form>

        <p className={styles.footer}>
          ¿Ya tienes cuenta? <Link href="/login">Inicia sesión</Link>
        </p>
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Implement the styles**

```css
/* src/app/register/page.module.css */
.main {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-8);
  background: var(--color-body-bg);
}

.card {
  width: 100%;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-8);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
}

.title {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  text-align: center;
}

.error {
  padding: var(--space-3);
  font-size: var(--font-size-sm);
  color: var(--color-error-dark);
  background: var(--color-error-light);
  border-radius: var(--radius-md);
}

.form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
}

.input {
  padding: var(--space-3);
  font-size: var(--font-size-base);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.submitButton {
  padding: var(--space-3);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-white);
  background: var(--color-primary-600);
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: var(--transition-fast);
}

.submitButton:hover {
  background: var(--color-primary-700);
}

.footer {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  text-align: center;
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/register
git commit -m "feat(app): página /register (email/contraseña)"
```

---

### Task 8: `/onboarding` page

**Files:**
- Create: `src/app/onboarding/page.tsx`
- Create: `src/app/onboarding/page.module.css`

**Interfaces:**
- Consumes: `provisionTenant` (Task 5).

- [ ] **Step 1: Implement the page**

```tsx
// src/app/onboarding/page.tsx
import { provisionTenant } from "@/app/_lib/auth-actions";
import styles from "./page.module.css";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className={styles.main}>
      <section className={styles.card}>
        <h1 className={styles.title}>Crea tu organización</h1>
        <p className={styles.subtitle}>
          Un último paso: nombra tu organización para empezar a usar Talkii.
        </p>
        {error && (
          <p className={styles.error}>
            No pudimos crear tu organización. Intenta de nuevo.
          </p>
        )}

        <form action={provisionTenant} className={styles.form}>
          <label className={styles.label} htmlFor="organizationName">
            Nombre de la organización
          </label>
          <input
            className={styles.input}
            id="organizationName"
            name="organizationName"
            type="text"
            required
          />
          <button type="submit" className={styles.submitButton}>
            Continuar
          </button>
        </form>
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Implement the styles**

```css
/* src/app/onboarding/page.module.css */
.main {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-8);
  background: var(--color-body-bg);
}

.card {
  width: 100%;
  max-width: 420px;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-8);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
}

.title {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  text-align: center;
}

.subtitle {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  text-align: center;
}

.error {
  padding: var(--space-3);
  font-size: var(--font-size-sm);
  color: var(--color-error-dark);
  background: var(--color-error-light);
  border-radius: var(--radius-md);
}

.form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
}

.input {
  padding: var(--space-3);
  font-size: var(--font-size-base);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.submitButton {
  padding: var(--space-3);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-white);
  background: var(--color-primary-600);
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: var(--transition-fast);
}

.submitButton:hover {
  background: var(--color-primary-700);
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/onboarding
git commit -m "feat(app): página /onboarding (aprovisionamiento de organización)"
```

---

### Task 9: `/dashboard` page

**Files:**
- Create: `src/app/dashboard/page.tsx`
- Create: `src/app/dashboard/page.module.css`

**Interfaces:**
- Consumes: `createServerSupabase` (existing), `SupabaseTenantRepository` (existing infra), `Identity` (domain), `signOut` (Task 5).

- [ ] **Step 1: Implement the page**

```tsx
// src/app/dashboard/page.tsx
import { Identity } from "@/domain";
import { SupabaseTenantRepository } from "@/infrastructure/supabase/repositories";
import { signOut } from "@/app/_lib/auth-actions";
import { createServerSupabase } from "@/app/_lib/supabase-server";
import styles from "./page.module.css";

export default async function DashboardPage() {
  const db = await createServerSupabase();
  const {
    data: { user },
  } = await db.auth.getUser();

  const tenantId = (
    user?.app_metadata as Record<string, unknown> | undefined
  )?.tenant_id as string | undefined;

  const tenant = tenantId
    ? await new SupabaseTenantRepository(db).findById(Identity.of(tenantId))
    : null;

  return (
    <main className={styles.main}>
      <section className={styles.card}>
        <h1 className={styles.title}>{tenant?.name ?? "Talkii"}</h1>
        <p className={styles.subtitle}>Sesión iniciada correctamente.</p>
        <form action={signOut}>
          <button type="submit" className={styles.logoutButton}>
            Cerrar sesión
          </button>
        </form>
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Implement the styles**

```css
/* src/app/dashboard/page.module.css */
.main {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-8);
  background: var(--color-body-bg);
}

.card {
  width: 100%;
  max-width: 480px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-8);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  text-align: center;
}

.title {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
}

.subtitle {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.logoutButton {
  padding: var(--space-3) var(--space-6);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: var(--transition-fast);
}

.logoutButton:hover {
  background: var(--color-surface-raised);
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard
git commit -m "feat(app): página /dashboard (nombre del tenant vía RLS + logout)"
```

---

### Task 10: `/auth/callback` Route Handler

**Files:**
- Create: `src/app/auth/callback/route.ts`

**Interfaces:**
- Consumes: `createServerSupabase` (existing).

- [ ] **Step 1: Implement the handler**

```ts
// src/app/auth/callback/route.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerSupabase } from "@/app/_lib/supabase-server";

/**
 * GET /auth/callback — intercambio del code de OAuth (Google) por sesión.
 * El Proxy reencamina a /onboarding si el usuario aún no tiene el claim
 * tenant_id; aquí solo se decide autenticado vs. fallido.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(new URL("/login?error=oauth", request.url));
  }

  const db = await createServerSupabase();
  const { error } = await db.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL("/login?error=oauth", request.url));
  }

  return NextResponse.redirect(new URL("/dashboard", request.url));
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/auth/callback/route.ts
git commit -m "feat(app): route handler /auth/callback (exchangeCodeForSession)"
```

---

### Task 11: Env/docs wiring + full verification

**Files:**
- Modify: `.env.example`
- Modify: `docs/DEPLOY.md`

- [ ] **Step 1: Add `NEXT_PUBLIC_SITE_URL` to `.env.example`**

Edit `.env.example`, insert this block right before the `# ── WhatsApp Cloud API (Meta) ──` section:

```
# ── Auth (Google OAuth + email/contraseña) ──
# Base pública del sitio; se usa para construir el redirect de OAuth
# (${NEXT_PUBLIC_SITE_URL}/auth/callback). En local: http://localhost:3000.
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

- [ ] **Step 2: Document the manual Supabase/Google setup in `docs/DEPLOY.md`**

Edit `docs/DEPLOY.md`, append this section at the end of the file (after the existing "WhatsApp Cloud API — alta del webhook" section):

```markdown

---

## Auth — Google OAuth + Supabase

1. En [Google Cloud Console](https://console.cloud.google.com) → APIs & Services
   → Credentials, crea un **OAuth Client ID** (tipo *Web application*).
   Authorized redirect URI: `https://<tu-proyecto>.supabase.co/auth/v1/callback`.
2. En Supabase → **Authentication → Providers → Google**, pega el Client ID y
   Client Secret del paso anterior, y habilita el provider.
3. En Supabase → **Authentication → URL Configuration**, define el **Site URL**
   con el mismo valor que `NEXT_PUBLIC_SITE_URL` (ej. `https://talkii.tudominio.com`).
4. En Supabase → **Authentication → Providers → Email**, **desactiva**
   "Confirm email" para esta fase (el flujo de confirmación de email queda
   fuera de alcance — ver `docs/superpowers/specs/2026-07-15-auth-supabase-design.md` §1).
5. Define `NEXT_PUBLIC_SITE_URL` en `.env.local` (o el entorno del VPS).

Checklist adicional para el checklist de verificación (§9): tras desplegar,
visita `/login`, entra con Google y con email/contraseña, confirma que un
usuario nuevo cae en `/onboarding`, que tras nombrar la organización llega a
`/dashboard` con el nombre correcto, y que "Cerrar sesión" vuelve a `/login`.
```

- [ ] **Step 3: Run the full test suite**

Run: `npm run test`
Expected: all tests pass (baseline 47 + 2 from Task 1 + 7 from Task 3 = 56/56).

- [ ] **Step 4: Type-check the whole project**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Production build**

Run: `npm run build`
Expected: `✓ Compiled successfully`. Confirm in the route summary that `/login`, `/register`, `/onboarding`, `/dashboard` are dynamic (`ƒ`) — they read cookies/user — and that `proxy` (formerly middleware) is listed as active.

- [ ] **Step 6: Manual smoke test (requires `.env.local` with real Supabase credentials — the user's pending manual step)**

Run: `npm run dev`, then in a browser:
1. Visit `/dashboard` while logged out → redirected to `/login`.
2. Register with email/password → redirected to `/onboarding` (no `tenant_id` claim yet).
3. Submit an organization name → redirected to `/dashboard`, showing that name.
4. Click "Cerrar sesión" → redirected to `/login`.
5. Log back in with the same email/password → redirected straight to `/dashboard` (claim already present).
6. Visit `/login` while authenticated with a claim → redirected to `/dashboard` (rule 1 of `resolveRedirect`).

- [ ] **Step 7: Commit**

```bash
git add .env.example docs/DEPLOY.md
git commit -m "docs(deploy): configuración de Google OAuth + Supabase Auth para la fase de auth"
```

---

## Self-Review Notes

- **Spec coverage:** §1 scope (login/register/callback/onboarding/dashboard/middleware→proxy/ProvisionTenant/AuthGateway) → Tasks 1–10. §2 Application → Task 1. §3 Infrastructure → Task 2. §4 App → Tasks 4–10. §5 error/edge cases → encoded directly in `auth-actions.ts` (Task 5) and the case table driving `resolveRedirect` (Task 3). §6 tests → Tasks 1 and 3. The one deliberate deviation (file renamed `middleware.ts` → `proxy.ts`, function renamed `middleware` → `proxy`) is called out in Global Constraints and is a Next-16-version adaptation, not a scope cut.
- **Type consistency checked:** `AuthGateway.assignTenantToUser(userId, tenantId)` signature matches between the port (Task 1), the fake (Task 1), and the adapter (Task 2). `ProvisionTenant` constructor order `(ids, tenants, authGateway)` and input/output shapes are identical between the use-case, its test, and `auth-actions.ts`. `ProxySession` type is identical between `resolve-redirect.ts`, its test, and `proxy.ts`.
