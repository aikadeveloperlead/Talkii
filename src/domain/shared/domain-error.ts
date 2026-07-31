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

/**
 * El recurso pedido no existe. Sigue siendo un error de dominio (el dominio no
 * conoce HTTP), pero permite que la capa `app` distinga "no está" de "conflicto"
 * — hallazgo MEDIUM de la auditoría santa-loop: TODO DomainError se mapeaba a
 * 409, así que un recurso inexistente devolvía "Conflict" en unas rutas y 404
 * en otras, para la misma condición.
 */
export class NotFoundError extends DomainError {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

/**
 * La entrada viola una regla de forma/valor: el cliente debe corregirla antes de
 * reintentar. Se distingue de un conflicto de estado (que sí es 409).
 */
export class ValidationError extends DomainError {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}
