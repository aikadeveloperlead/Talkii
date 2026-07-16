import type { Clock } from "@/application/ports";

/**
 * Adaptador del puerto Clock: reloj real del sistema.
 *
 * Es el único punto de infraestructura que lee la hora; el dominio y los casos
 * de uso reciben el instante a través del puerto, no de `new Date()` directo.
 */
export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
