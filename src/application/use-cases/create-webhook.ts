import { DomainError, Identity, Webhook } from "@/domain";
import { IdGenerator } from "../ports/id-generator";
import { WebhookRepository } from "../ports/webhook-repositories";

export interface CreateWebhookInput {
  tenantId: string;
  name: string;
  url: string;
  secret?: string;
  events: string[];
}

export class CreateWebhook {
  constructor(
    private readonly ids: IdGenerator,
    private readonly webhooks: WebhookRepository,
  ) {}

  async execute(input: CreateWebhookInput): Promise<{ webhookId: string }> {
    const tenantId = Identity.of(input.tenantId);
    const existing = (await this.webhooks.listByTenant(tenantId)).find((w) => w.name === input.name);
    if (existing) {
      throw new DomainError("CreateWebhook: ya existe un Webhook con ese nombre en el Tenant (BK-02)");
    }

    const webhook = Webhook.create(this.ids.next(), {
      tenantId,
      name: input.name,
      url: input.url,
      secret: input.secret,
      events: input.events,
    });
    await this.webhooks.save(webhook);
    return { webhookId: webhook.id.toString() };
  }
}
