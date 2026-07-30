import { Entity, Identity, invariant } from "../shared";
import type { Channel } from "../conversation/conversation";

/**
 * ChannelBinding — recurso de configuración del Tenant (capacidad, NO entidad
 * del núcleo: el SSOT Cap. 7 cierra las 7 entidades). Vincula la identidad de
 * un canal externo (p. ej. el phone_number_id de Meta) con el Tenant/Agent
 * que lo atiende (item MEDIO #2 de la auditoría: antes era solo una fila
 * cruda sin invariantes, reconstruida directo en el mapper de infra).
 */
export interface ChannelBindingProps {
  tenantId: Identity;
  channel: Channel;
  /** Identidad del canal en el proveedor (WhatsApp: phone_number_id). */
  externalId: string;
  agentId: Identity;
  funnelId?: Identity;
  /** Credencial propia del binding; si falta, se usa la global de plataforma. */
  accessToken?: string;
}

export class ChannelBinding extends Entity {
  private constructor(
    id: Identity,
    private readonly props: ChannelBindingProps,
  ) {
    super(id);
  }

  static create(id: Identity, props: ChannelBindingProps): ChannelBinding {
    invariant(
      props.externalId.trim().length > 0,
      "ChannelBinding: externalId no puede estar vacío",
    );
    return new ChannelBinding(id, { ...props, externalId: props.externalId.trim() });
  }

  get tenantId(): Identity {
    return this.props.tenantId;
  }
  get channel(): Channel {
    return this.props.channel;
  }
  get externalId(): string {
    return this.props.externalId;
  }
  get agentId(): Identity {
    return this.props.agentId;
  }
  get funnelId(): Identity | undefined {
    return this.props.funnelId;
  }
  get accessToken(): string | undefined {
    return this.props.accessToken;
  }
}
