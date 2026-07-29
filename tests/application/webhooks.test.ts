import { describe, expect, it } from "vitest";
import { DomainError } from "@/domain";
import {
  CreateWebhook,
  DispatchWebhookEvent,
  DuplicateWebhook,
  GetWebhookDetail,
  ListWebhookDeliveries,
  ListWebhooks,
  SetWebhookStatus,
  UpdateWebhook,
} from "@/application/use-cases";
import {
  FakeWebhookSender,
  FixedClock,
  InMemoryWebhookDeliveries,
  InMemoryWebhooks,
  SequentialIds,
} from "../fakes";

const tenantId = "11111111-1111-1111-1111-111111111111";

function setup() {
  const ids = new SequentialIds();
  const clock = new FixedClock();
  const webhooks = new InMemoryWebhooks();
  const deliveries = new InMemoryWebhookDeliveries();
  const sender = new FakeWebhookSender();
  return {
    webhooks,
    deliveries,
    sender,
    createWebhook: new CreateWebhook(ids, webhooks),
    updateWebhook: new UpdateWebhook(webhooks),
    setStatus: new SetWebhookStatus(webhooks),
    duplicateWebhook: new DuplicateWebhook(ids, webhooks),
    getDetail: new GetWebhookDetail(webhooks),
    listWebhooks: new ListWebhooks(webhooks),
    listDeliveries: new ListWebhookDeliveries(deliveries),
    dispatch: new DispatchWebhookEvent(ids, clock, webhooks, deliveries, sender),
  };
}

describe("CreateWebhook (SCR-011 BK-01 HTTPS, BK-02 nombre único, BK-03 >=1 evento)", () => {
  it("crea el Webhook activo", async () => {
    const { createWebhook, getDetail } = setup();
    const { webhookId } = await createWebhook.execute({
      tenantId,
      name: "CRM externo",
      url: "https://example.com/hook",
      events: ["message.received"],
    });
    expect((await getDetail.execute(webhookId))?.status).toBe("active");
  });

  it("rechaza URL no-HTTPS", async () => {
    const { createWebhook } = setup();
    await expect(
      createWebhook.execute({
        tenantId,
        name: "X",
        url: "http://example.com/hook",
        events: ["message.received"],
      }),
    ).rejects.toThrow(DomainError);
  });

  it("rechaza sin eventos seleccionados", async () => {
    const { createWebhook } = setup();
    await expect(
      createWebhook.execute({ tenantId, name: "X", url: "https://example.com", events: [] }),
    ).rejects.toThrow(DomainError);
  });

  it("rechaza nombre duplicado en el Tenant", async () => {
    const { createWebhook } = setup();
    const input = {
      tenantId,
      name: "CRM externo",
      url: "https://example.com/hook",
      events: ["message.received"],
    };
    await createWebhook.execute(input);
    await expect(createWebhook.execute(input)).rejects.toThrow(DomainError);
  });
});

describe("SetWebhookStatus / DuplicateWebhook", () => {
  it("archiva sin eliminar (WH-04) y duplica como disabled", async () => {
    const { createWebhook, setStatus, duplicateWebhook, getDetail, listWebhooks } = setup();
    const { webhookId } = await createWebhook.execute({
      tenantId,
      name: "CRM externo",
      url: "https://example.com/hook",
      events: ["message.received"],
    });

    await setStatus.execute(webhookId, "archived");
    expect((await getDetail.execute(webhookId))?.status).toBe("archived");

    const { webhookId: copyId } = await duplicateWebhook.execute(webhookId);
    expect((await getDetail.execute(copyId))?.status).toBe("disabled");
    expect(await listWebhooks.execute(tenantId)).toHaveLength(2);
  });
});

describe("DispatchWebhookEvent (SCR-011 §4.4, BK-04/BK-05)", () => {
  it("entrega solo a Webhooks activos suscritos al evento y registra el resultado", async () => {
    const { createWebhook, setStatus, dispatch, sender, listDeliveries } = setup();
    const { webhookId: activeId } = await createWebhook.execute({
      tenantId,
      name: "Activo",
      url: "https://example.com/a",
      events: ["message.received"],
    });
    const { webhookId: archivedId } = await createWebhook.execute({
      tenantId,
      name: "Archivado",
      url: "https://example.com/b",
      events: ["message.received"],
    });
    await setStatus.execute(archivedId, "archived");
    await createWebhook.execute({
      tenantId,
      name: "Otro evento",
      url: "https://example.com/c",
      events: ["lead.created"],
    });

    const result = await dispatch.execute(tenantId, "message.received", { text: "hola" });

    expect(result.dispatched).toBe(1); // solo el activo suscrito
    expect(sender.sent).toHaveLength(1);
    expect(sender.sent[0].webhook.id.toString()).toBe(activeId);

    const deliveries = await listDeliveries.execute(activeId);
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0].status).toBe("delivered");
  });

  it("registra la entrega como failed si el sender lanza", async () => {
    const ids = new SequentialIds();
    const clock = new FixedClock();
    const webhooks = new InMemoryWebhooks();
    const deliveries = new InMemoryWebhookDeliveries();
    const throwingSender = {
      async send(): Promise<never> {
        throw new Error("network error");
      },
    };
    const createWebhook = new CreateWebhook(ids, webhooks);
    const { webhookId } = await createWebhook.execute({
      tenantId,
      name: "Falla",
      url: "https://example.com/fail",
      events: ["message.received"],
    });

    const dispatch = new DispatchWebhookEvent(ids, clock, webhooks, deliveries, throwingSender);
    await dispatch.execute(tenantId, "message.received", {});

    const listDeliveries = new ListWebhookDeliveries(deliveries);
    const result = await listDeliveries.execute(webhookId);
    expect(result[0].status).toBe("failed");
  });
});
