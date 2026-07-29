import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthGateway, CreatedUser } from "@/application/ports";

/**
 * Implementa AuthGateway con la admin API de Supabase Auth. Requiere un
 * cliente con service-role (`createServiceClient`) — ni `updateUserById` ni
 * `createUser` están disponibles con el anon key. Un fallo de la API se
 * propaga como Error (no se traga), igual que el resto de adaptadores de
 * `infrastructure/supabase`.
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

  async createConfirmedUser(
    email: string,
    password: string,
  ): Promise<CreatedUser> {
    const { data, error } = await this.db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error || !data.user) {
      throw new Error(
        `Supabase auth.admin.createUser: ${error?.message ?? "sin usuario en la respuesta"}`,
      );
    }
    return { userId: data.user.id };
  }
}
