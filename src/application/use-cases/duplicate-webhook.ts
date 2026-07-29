import { DomainError, Identity, Webhook } from "@/domain";
import { IdGenerator } from "../ports/id-generator";
import { WebhookRepository } from "../ports/webhook-repositories";

/** DuplicateWebhook — SCR-011 §3.7. */
export class DuplicateWebhook {
  constructor(
    private readonly ids: IdGenerator,
    private readonly webhooks: WebhookRepository,
  ) {}

  async execute(webhookId: string): Promise<{ webhookId: string }> {
    const source = await this.webhooks.findById(Identity.of(webhookId));
    if (!source) {
      throw new DomainError("DuplicateWebhook: el Webhook no existe");
    }

    let name = `${source.name} (copia)`;
    let suffix = 2;
    const existingNames = new Set((await this.webhooks.listByTenant(source.tenantId)).map((w) => w.name));
    while (existingNames.has(name)) {
      name = `${source.name} (copia ${suffix})`;
      suffix += 1;
    }

    const duplicate = Webhook.create(this.ids.next(), {
      tenantId: source.tenantId,
      name,
      url: source.url,
      secret: source.secret,
      events: [...source.events],
      status: "disabled",
    });
    await this.webhooks.save(duplicate);
    return { webhookId: duplicate.id.toString() };
  }
}
