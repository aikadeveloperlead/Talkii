import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthGateway } from "@/application/ports";

/**
 * Implementa AuthGateway con la admin API de Supabase Auth. Requiere un
 * cliente con service-role (`createServiceClient`) — `updateUserById` no está
 * disponible con el anon key. Un fallo de la API se propaga como Error (no se
 * traga), igual que el resto de adaptadores de `infrastructure/supabase`.
 */
export class SupabaseAuthGateway implements AuthGateway {
  constructor(private readonly db: SupabaseClient) {}

  async assignTenantToUser(userId: string, tenantId: string): Promise<void> {
    const { error } = await this.db.auth.admin.updateUserById(userId, {
      app_metadata: { tenant_id: tenantId },
    });
    if (error) {
      throw new Error(
        `Supabase auth.admin.updateUserById: ${error.message}`,
      );
    }
  }
}
