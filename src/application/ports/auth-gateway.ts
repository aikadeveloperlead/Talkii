/**
 * Puerto: aprovisionamiento de identidad.
 *
 * Abstrae el mecanismo de identidad (Supabase Auth admin API, o cualquier
 * otro proveedor) para que la capa `application` nunca dependa de Supabase
 * directamente (AA-01/AA-03).
 */
export interface AuthGateway {
  assignTenantToUser(userId: string, tenantId: string): Promise<void>;
}
