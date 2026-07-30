import { afterEach, describe, expect, it, vi } from "vitest";

const { createServerSupabase } = vi.hoisted(() => ({
  createServerSupabase: vi.fn(),
}));

vi.mock("@/app/_lib/supabase-server", () => ({ createServerSupabase }));

describe("GET /api/health", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("db alcanzable -> 200 ok", async () => {
    createServerSupabase.mockResolvedValue({
      from: () => ({
        select: () => ({ limit: () => Promise.resolve({ error: null }) }),
      }),
    });
    const { GET } = await import("@/app/api/health/route");

    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", db: "reachable" });
  });

  it("error de Supabase -> 503 degraded sin filtrar el detalle a la respuesta", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    createServerSupabase.mockResolvedValue({
      from: () => ({
        select: () => ({
          limit: () =>
            Promise.resolve({ error: { message: "secreto de conexión interno" } }),
        }),
      }),
    });
    const { GET } = await import("@/app/api/health/route");

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body).toEqual({ status: "degraded", db: "error" });
    expect(JSON.stringify(body)).not.toContain("secreto de conexión interno");
  });

  it("excepción no controlada -> 500 sin filtrar el detalle a la respuesta", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    createServerSupabase.mockRejectedValue(new Error("env var faltante"));
    const { GET } = await import("@/app/api/health/route");

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toEqual({ status: "error" });
    expect(JSON.stringify(body)).not.toContain("env var faltante");
  });
});
