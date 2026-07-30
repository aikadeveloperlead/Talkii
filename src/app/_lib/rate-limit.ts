// src/app/_lib/rate-limit.ts
import { createServiceClient, SupabaseRateLimiter } from "@/infrastructure";

/**
 * Rate limiting vía tabla Supabase persistente (item MEDIO #13 de la
 * auditoría — mecanismo elegido por el usuario: no in-memory, compartido
 * entre instancias). Usa el service client porque se aplica ANTES de que
 * exista sesión (login/signup): no hay JWT del que derivar una policy RLS
 * con sentido, mismo criterio que el webhook de WhatsApp con channel_bindings.
 *
 * No pasa por `container.ts`: es un concern transversal de la capa `app`
 * (como `validation.ts`), no un caso de uso del dominio.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  const limiter = new SupabaseRateLimiter(createServiceClient());
  const result = await limiter.consume(key, limit, windowSeconds);
  return result.allowed;
}
