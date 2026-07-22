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
