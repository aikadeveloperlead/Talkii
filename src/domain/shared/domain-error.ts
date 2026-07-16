/**
 * Error base del dominio. Se lanza cuando se viola una invariante conceptual
 * definida por el SSOT (Documento Maestro del Dominio, Cap. 7).
 *
 * El dominio nunca depende de infraestructura: este error es TypeScript puro
 * y no conoce HTTP, base de datos ni frameworks (Regla 12 — dependencias hacia
 * el dominio).
 */
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainError";
  }
}
