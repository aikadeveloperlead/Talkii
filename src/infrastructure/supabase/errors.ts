import { DomainError } from "@/domain";

/**
 * Traducción de códigos de error de Postgres a errores de dominio.
 *
 * Hallazgo MEDIUM de la auditoría santa-loop: varios repositorios dejaban
 * escapar `23505` (unique_violation) como Error genérico, así que perder una
 * carrera de creación (dos POST concurrentes con el mismo teléfono/nombre)
 * devolvía 500 "Internal Error" — indistinguible de una caída real — en vez
 * del 409 que `toErrorResponse` ya produce para cualquier DomainError.
 *
 * El patrón correcto ya existía en SupabaseSessionRepository (23505) y
 * SupabaseAppointmentRepository (23P01); esto lo centraliza para no volver a
 * olvidarlo en el próximo repositorio.
 */
const UNIQUE_VIOLATION = "23505";

/** Lanza DomainError si el error es unique_violation; si no, devuelve false. */
export function throwIfUniqueViolation(
  error: { code?: string } | null | undefined,
  message: string,
): void {
  if (error && (error as { code?: string }).code === UNIQUE_VIOLATION) {
    throw new DomainError(message);
  }
}
