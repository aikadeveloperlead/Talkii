import { Entity, Identity, invariant } from "../shared";

/**
 * Webhook — Entidad del bounded context Webhooks & Integraciones (SCR-011).
 * Configuración de entrega saliente hacia sistemas externos (CRMs, ERPs,
 * n8n, Make, Zapier, "cualquier sistema que pueda consumir Webhooks" — spec
 * §1.1). Explícitamente fuera de alcance (spec §1.3): retries, colas, rate
 * limiting, OAuth — este es un envío HTTP POST simple, sin reintentos.
 */
export type WebhookStatus = "active" | "disabled" | "archived";

export interface WebhookProps {
  tenantId: Identity;
  name: string;
  url: string;
  secret?: string;
  events: string[];
  status?: WebhookStatus;
}

export class Webhook extends Entity {
  private constructor(
    id: Identity,
    private readonly props: WebhookProps & { status: WebhookStatus },
  ) {
    super(id);
  }

  static create(id: Identity, props: WebhookProps): Webhook {
    invariant(props.name.trim().length > 0, "Webhook: el nombre no puede estar vacío");
    invariant(props.url.startsWith("https://"), "Webhook: la URL debe ser HTTPS (BK-01)");
    invariant(props.events.length > 0, "Webhook: debe seleccionar al menos un evento (BK-03)");
    return new Webhook(id, {
      ...props,
      name: props.name.trim(),
      events: [...props.events],
      status: props.status ?? "active",
    });
  }

  get tenantId(): Identity {
    return this.props.tenantId;
  }
  get name(): string {
    return this.props.name;
  }
  get url(): string {
    return this.props.url;
  }
  get secret(): string | undefined {
    return this.props.secret;
  }
  get events(): readonly string[] {
    return this.props.events;
  }
  get status(): WebhookStatus {
    return this.props.status;
  }
  /** BK-04: un Webhook archivado no recibe eventos. */
  get isDeliverable(): boolean {
    return this.props.status === "active";
  }

  withEdits(changes: Partial<Pick<WebhookProps, "name" | "url" | "secret" | "events">>): Webhook {
    return Webhook.create(this.id, { ...this.props, ...changes });
  }

  withStatus(status: WebhookStatus): Webhook {
    return Webhook.create(this.id, { ...this.props, status });
  }
}
