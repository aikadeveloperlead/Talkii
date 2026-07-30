import type { Channel, ChannelBinding } from "@/domain";

export type { ChannelBinding };

/**
 * Puerto: resuelve qué Tenant/Agent atiende una identidad de canal.
 *
 * `ChannelBinding` es la entidad de dominio (`domain/administration/channel-binding.ts`,
 * item MEDIO #2 de la auditoría) — este módulo solo re-exporta el tipo para no
 * romper los imports existentes de `@/application/ports`.
 */
export interface ChannelBindingResolver {
  findByChannelIdentity(
    channel: Channel,
    externalId: string,
  ): Promise<ChannelBinding | null>;
  /**
   * Binding activo del Tenant para un canal (envío saliente iniciado desde
   * Talkii, p. ej. un mensaje de operador). MVP: un binding por Tenant/canal;
   * el soporte de múltiples números por Tenant queda fuera de este alcance.
   */
  findByTenant(
    tenantId: string,
    channel: Channel,
  ): Promise<ChannelBinding | null>;
}
