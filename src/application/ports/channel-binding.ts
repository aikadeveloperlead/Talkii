import type { Channel } from "@/domain";

/**
 * ChannelBinding — recurso de configuración del Tenant (capacidad, NO entidad
 * del núcleo: el SSOT Cap. 7 cierra las 7 entidades). Vincula la identidad de
 * un canal externo (p. ej. el phone_number_id de Meta) con el Tenant que lo
 * posee y el Agent que lo atiende.
 */
export interface ChannelBinding {
  readonly tenantId: string;
  readonly channel: Channel;
  /** Identidad del canal en el proveedor (WhatsApp: phone_number_id). */
  readonly externalId: string;
  readonly agentId: string;
  readonly funnelId?: string;
  /** Credencial propia del binding; si falta, se usa la global de plataforma. */
  readonly accessToken?: string;
}

/** Puerto: resuelve qué Tenant/Agent atiende una identidad de canal. */
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
