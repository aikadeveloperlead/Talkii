import { Identity } from "@/domain";

/**
 * Puerto: generación de identidades.
 *
 * El dominio no genera identificadores (SSOT Cap. 7 §12: la identidad es un
 * concepto del dominio, pero su materialización — ej. UUID v4 — es un detalle
 * de infraestructura). La aplicación pide una identidad a este puerto.
 */
export interface IdGenerator {
  next(): Identity;
}
