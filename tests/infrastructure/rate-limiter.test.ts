import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SupabaseRateLimiter } from "@/infrastructure";

/** Simula el RPC increment_rate_limit: cuenta llamadas por (key, window_start). */
function fakeDb(onRpc: (params: { p_key: string; p_window_start: string }) => number) {
  const rpc = async (
    _fn: string,
    params: { p_key: string; p_window_start: string },
  ) => ({ data: onRpc(params), error: null });
  return { rpc } as unknown as SupabaseClient;
}

describe("SupabaseRateLimiter (item MEDIO #13 de la auditoría)", () => {
  it("permite mientras el conteo no supere el límite", async () => {
    const db = fakeDb(() => 3);
    const limiter = new SupabaseRateLimiter(db);

    const result = await limiter.consume("login:a@b.com", 5, 60);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
  });

  it("permite exactamente en el límite (el N-ésimo intento cuenta)", async () => {
    const db = fakeDb(() => 5);
    const limiter = new SupabaseRateLimiter(db);

    const result = await limiter.consume("login:a@b.com", 5, 60);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(0);
  });

  it("bloquea cuando el conteo supera el límite", async () => {
    const db = fakeDb(() => 9);
    const limiter = new SupabaseRateLimiter(db);

    const result = await limiter.consume("login:a@b.com", 5, 60);

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("llama al RPC con un window_start alineado al tamaño de ventana", async () => {
    let captured: { p_key: string; p_window_start: string } | undefined;
    const db = fakeDb((params) => {
      captured = params;
      return 1;
    });
    const limiter = new SupabaseRateLimiter(db);

    const windowSeconds = 300;
    await limiter.consume("signup:x@y.com", 3, windowSeconds);

    expect(captured?.p_key).toBe("signup:x@y.com");
    const windowStartMs = new Date(captured!.p_window_start).getTime();
    expect(windowStartMs % (windowSeconds * 1000)).toBe(0);
  });

  it("propaga un error descriptivo si el RPC falla", async () => {
    const db = {
      rpc: async () => ({ data: null, error: { message: "boom" } }),
    } as unknown as SupabaseClient;
    const limiter = new SupabaseRateLimiter(db);

    await expect(limiter.consume("k", 1, 60)).rejects.toThrow(/boom/);
  });
});
