import type { SupabaseClient } from "@supabase/supabase-js";
import type { RateLimiter, RateLimitResult } from "@/application/ports";

/**
 * SupabaseRateLimiter — item MEDIO #13 de la auditoría. Ventana fija:
 * `window_start` se alinea al tamaño de ventana (floor(now / window) * window)
 * para que todas las llamadas dentro de la misma ventana compartan fila.
 * El incremento es atómico vía RPC `increment_rate_limit` (migración 0022,
 * un solo upsert — evita la carrera de leer-luego-escribir en la app).
 */
export class SupabaseRateLimiter implements RateLimiter {
  constructor(private readonly db: SupabaseClient) {}

  async consume(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    const windowMs = windowSeconds * 1000;
    const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs).toISOString();

    const { data, error } = await this.db.rpc("increment_rate_limit", {
      p_key: key,
      p_window_start: windowStart,
    });
    if (error) {
      throw new Error(`Supabase increment_rate_limit: ${error.message}`);
    }

    const count = data as number;
    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
    };
  }
}
