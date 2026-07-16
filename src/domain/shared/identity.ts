import { invariant } from "./invariant";

/**
 * Identidad estable de una entidad del dominio.
 *
 * SSOT Cap. 7 §12: la identidad nunca depende de nombres visibles, proveedores
 * tecnológicos, modelos de IA ni infraestructura. Es un concepto exclusivo del
 * dominio.
 *
 * El dominio NO genera identificadores (eso es responsabilidad de la
 * infraestructura); solo los valida y encapsula.
 */
export class Identity {
  private constructor(private readonly value: string) {}

  static of(value: string): Identity {
    invariant(
      typeof value === "string" && value.trim().length > 0,
      "Identity debe ser un string no vacío",
    );
    return new Identity(value.trim());
  }

  toString(): string {
    return this.value;
  }

  equals(other: Identity | undefined): boolean {
    return other instanceof Identity && other.value === this.value;
  }
}
