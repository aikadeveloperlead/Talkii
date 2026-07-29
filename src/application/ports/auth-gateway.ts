/**
 * Puerto: aprovisionamiento de identidad.
 *
 * Abstrae el mecanismo de identidad (Supabase Auth admin API, o cualquier
 * otro proveedor) para que la capa `application` nunca dependa de Supabase
 * directamente (AA-01/AA-03).
 */
export interface CreatedUser {
  userId: string;
}

export interface AuthGateway {
  assignTenantToUser(userId: string, tenantId: string): Promise<void>;
  /**
   * Crea una identidad ya confirmada (sin depender del ajuste global
   * "Confirm email" del proveedor): el alta self-service queda confirmada de
   * origen, sin abrir esa política a ningún otro flujo de signup.
   */
  createConfirmedUser(email: string, password: string): Promise<CreatedUser>;
}
