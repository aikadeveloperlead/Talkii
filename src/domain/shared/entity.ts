import { Identity } from "./identity";

/**
 * Base de toda entidad del dominio.
 *
 * SSOT Cap. 7 §12–13: las entidades poseen identidad estable durante todo su
 * ciclo de vida; la igualdad se determina por identidad, no por atributos.
 */
export abstract class Entity {
  protected constructor(readonly id: Identity) {}

  equals(other: Entity | undefined): boolean {
    if (!other) return false;
    if (this === other) return true;
    return this.id.equals(other.id);
  }
}
