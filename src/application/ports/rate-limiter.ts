/**
 * Puerto: rate limiting (item MEDIO #13 de la auditoría). Cuenta consumos de
 * una `key` arbitraria dentro de una ventana fija; el mecanismo concreto
 * (tabla Supabase, decisión del usuario — no in-memory) vive en infrastructure.
 */
export interface RateLimitResult {
  readonly allowed: boolean;
  readonly remaining: number;
}

export interface RateLimiter {
  /** Incrementa el contador de `key` en la ventana actual y evalúa `limit`. */
  consume(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult>;
}
