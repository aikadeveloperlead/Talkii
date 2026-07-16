import { randomUUID } from "node:crypto";
import { Identity } from "@/domain";
import type { IdGenerator } from "@/application/ports";

/**
 * Adaptador del puerto IdGenerator: materializa la identidad del dominio como
 * UUID v4. La elección del formato (UUID) es un detalle de infraestructura
 * (SSOT Cap. 7 §12); el dominio solo conoce el concepto `Identity`.
 */
export class UuidIdGenerator implements IdGenerator {
  next(): Identity {
    return Identity.of(randomUUID());
  }
}
