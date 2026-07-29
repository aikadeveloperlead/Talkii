import { DomainError, Identity } from "@/domain";
import { WebhookRepository } from "../ports/webhook-repositories";

export interface UpdateWebhookInput {
  webhookId: string;
  name?: string;
  url?: string;
  secret?: string;
  events?: string[];
}

export class UpdateWebhook {
  constructor(private readonly webhooks: WebhookRepository) {}

  async execute(input: UpdateWebhookInput): Promise<void> {
    const webhook = await this.webhooks.findById(Identity.of(input.webhookId));
    if (!webhook) {
      throw new DomainError("UpdateWebhook: el Webhook no existe");
    }
    const { webhookId: _omit, ...changes } = input;
    await this.webhooks.save(webhook.withEdits(changes));
  }
}
