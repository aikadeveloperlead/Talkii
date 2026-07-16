import { DomainError } from "./domain-error";

/**
 * Garantiza una invariante del dominio. Si la condición no se cumple, lanza
 * un `DomainError`. Se usa en las factorías de las entidades para hacer
 * imposible construir un estado que contradiga el SSOT.
 */
export function invariant(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new DomainError(message);
  }
}
