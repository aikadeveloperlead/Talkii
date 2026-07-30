import { Entity, Identity, invariant } from "../shared";

/** WebhookDelivery — registro de una entrega (BK-05: toda entrega queda registrada). */
export type WebhookDeliveryStatus = "pending" | "delivered" | "failed";

export interface WebhookDeliveryProps {
  webhookId: Identity;
  eventName: string;
  payload: Record<string, unknown>;
  status: WebhookDeliveryStatus;
  responseStatus?: number;
  responseTimeMs?: number;
  /** Motivo real del fallo (hallazgo ALTO de auditoría: antes se descartaba en un catch{} vacío). */
  errorDetail?: string;
  occurredAt: Date;
}

export class WebhookDelivery extends Entity {
  private constructor(
    id: Identity,
    private readonly props: WebhookDeliveryProps,
  ) {
    super(id);
  }

  static create(id: Identity, props: WebhookDeliveryProps): WebhookDelivery {
    invariant(props.eventName.trim().length > 0, "WebhookDelivery: debe declarar un evento");
    return new WebhookDelivery(id, { ...props, payload: { ...props.payload } });
  }

  get webhookId(): Identity {
    return this.props.webhookId;
  }
  get eventName(): string {
    return this.props.eventName;
  }
  get payload(): Readonly<Record<string, unknown>> {
    return this.props.payload;
  }
  get status(): WebhookDeliveryStatus {
    return this.props.status;
  }
  get responseStatus(): number | undefined {
    return this.props.responseStatus;
  }
  get responseTimeMs(): number | undefined {
    return this.props.responseTimeMs;
  }
  get errorDetail(): string | undefined {
    return this.props.errorDetail;
  }
  get occurredAt(): Date {
    return this.props.occurredAt;
  }
}
