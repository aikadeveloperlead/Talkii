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
