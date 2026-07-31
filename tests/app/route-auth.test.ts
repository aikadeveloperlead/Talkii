import { readdirSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Hallazgo HIGH de la auditoría adversarial santa-loop: el guard de
 * autenticación (`requireContainer()` / `requireTenantContainer()` + 401) está
 * copiado a mano en cada route handler y NADA lo verificaba. Una ruta nueva que
 * olvide las dos líneas, o un refactor que haga que `requireContainer` devuelva
 * algo truthy sin sesión, shippeaba un endpoint sin autenticar con el suite en
 * verde.
 *
 * Este test se recorre el árbol de rutas por glob, así que cubre
 * automáticamente cualquier ruta futura sin tener que acordarse de añadirla.
 */

/** Rutas deliberadamente públicas, con su razón — el resto DEBE exigir sesión. */
const PUBLIC_ROUTES: Record<string, string> = {
  "health": "healthcheck de infraestructura, no expone datos de ningún tenant",
  "whatsapp/webhook": "lo llama Meta sin JWT; se autentica por firma HMAC del body",
};

const API_DIR = path.join(process.cwd(), "src", "app", "api");

/** Devuelve las rutas relativas (POSIX) de todos los route.ts bajo src/app/api. */
function findRouteFiles(dir: string, base = ""): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      found.push(...findRouteFiles(path.join(dir, entry.name), rel));
    } else if (entry.name === "route.ts") {
      found.push(base);
    }
  }
  return found;
}

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
type Handler = (...args: unknown[]) => Promise<Response>;

// Sin usuario: `getUser()` devuelve null, que es exactamente lo que ve un
// request sin cookie de sesión (o con una inválida).
const getUser = vi.fn(async () => ({ data: { user: null } }));
vi.mock("@/app/_lib/supabase-server", () => ({
  createServerSupabase: async () => ({ auth: { getUser } }),
}));

const routes = findRouteFiles(API_DIR).filter((r) => !(r in PUBLIC_ROUTES));

describe("Guard de autenticación en las rutas de /api (hallazgo HIGH)", () => {
  beforeEach(() => {
    getUser.mockClear();
  });

  it("encontró rutas que auditar (si esto falla, el glob está roto)", () => {
    expect(routes.length).toBeGreaterThan(20);
  });

  it.each(routes)("/api/%s responde 401 en todos sus métodos sin sesión", async (route) => {
    const mod = (await import(
      /* @vite-ignore */ `@/app/api/${route}/route`
    )) as Record<string, unknown>;

    const exported = HTTP_METHODS.filter((m) => typeof mod[m] === "function");
    expect(exported.length).toBeGreaterThan(0);

    for (const method of exported) {
      const handler = mod[method] as Handler;
      const request = new Request("http://localhost/api/test", {
        method,
        ...(method === "GET" || method === "DELETE"
          ? {}
          : { body: "{}", headers: { "content-type": "application/json" } }),
      });
      // Segundo argumento: las rutas dinámicas esperan { params: Promise<...> }.
      const response = await handler(request, { params: Promise.resolve({ id: "x" }) });

      expect(
        response.status,
        `/api/${route} [${method}] debe responder 401 sin sesión, respondió ${response.status}`,
      ).toBe(401);
    }
  });
});

describe("Rutas públicas declaradas explícitamente", () => {
  it("solo health y el webhook de WhatsApp están exentas del guard", () => {
    // Fija la lista: agregar una ruta pública nueva obliga a justificarla acá.
    expect(Object.keys(PUBLIC_ROUTES).sort()).toEqual(["health", "whatsapp/webhook"]);
  });
});
