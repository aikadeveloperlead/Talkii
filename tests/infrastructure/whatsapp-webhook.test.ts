import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyWebhookSignature } from "@/infrastructure/whatsapp/verify-signature";
import { parseWebhookPayload } from "@/infrastructure/whatsapp/parse-webhook";

const SECRET = "app-secret-de-prueba";

function sign(body: string): string {
  return "sha256=" + createHmac("sha256", SECRET).update(body, "utf8").digest("hex");
}

describe("verifyWebhookSignature (X-Hub-Signature-256)", () => {
  it("acepta una firma HMAC-SHA256 válida", () => {
    const body = '{"object":"whatsapp_business_account"}';
    expect(verifyWebhookSignature(body, sign(body), SECRET)).toBe(true);
  });

  it("rechaza una firma corrupta", () => {
    const body = '{"object":"whatsapp_business_account"}';
    const bad = sign(body).slice(0, -4) + "0000";
    expect(verifyWebhookSignature(body, bad, SECRET)).toBe(false);
  });

  it("rechaza header ausente o sin prefijo sha256=", () => {
    expect(verifyWebhookSignature("{}", null, SECRET)).toBe(false);
    expect(verifyWebhookSignature("{}", "md5=abc", SECRET)).toBe(false);
  });

  it("rechaza si el body fue alterado tras firmar", () => {
    const signature = sign('{"a":1}');
    expect(verifyWebhookSignature('{"a":2}', signature, SECRET)).toBe(false);
  });
});

// Payload real (recortado) de la Cloud API de Meta para un mensaje de texto.
const metaTextPayload = {
  object: "whatsapp_business_account",
  entry: [
    {
      id: "WABA-ID",
      changes: [
        {
          field: "messages",
          value: {
            messaging_product: "whatsapp",
            metadata: {
              display_phone_number: "15550001111",
              phone_number_id: "phone-123",
            },
            contacts: [
              { profile: { name: "Nicolás" }, wa_id: "573001112233" },
            ],
            messages: [
              {
                from: "573001112233",
                id: "wamid.IN-1",
                timestamp: "1784548800",
                type: "text",
                text: { body: "hola, quiero info" },
              },
            ],
          },
        },
      ],
    },
  ],
};

// Notificación de status (delivered/read): no contiene mensajes.
const metaStatusPayload = {
  object: "whatsapp_business_account",
  entry: [
    {
      id: "WABA-ID",
      changes: [
        {
          field: "messages",
          value: {
            messaging_product: "whatsapp",
            metadata: { display_phone_number: "1555", phone_number_id: "phone-123" },
            statuses: [{ id: "wamid.OUT-1", status: "delivered" }],
          },
        },
      ],
    },
  ],
};

describe("parseWebhookPayload (Cloud API de Meta)", () => {
  it("extrae los mensajes de texto con su metadata", () => {
    const messages = parseWebhookPayload(metaTextPayload);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      phoneNumberId: "phone-123",
      wamid: "wamid.IN-1",
      from: "573001112233",
      displayName: "Nicolás",
      text: "hola, quiero info",
    });
    expect(messages[0].timestamp.toISOString()).toBe("2026-07-20T12:00:00.000Z");
  });

  it("ignora notificaciones de status", () => {
    expect(parseWebhookPayload(metaStatusPayload)).toHaveLength(0);
  });

  it("ignora mensajes que no son de texto", () => {
    const withImage = structuredClone(metaTextPayload);
    withImage.entry[0].changes[0].value.messages[0] = {
      from: "573001112233",
      id: "wamid.IN-2",
      timestamp: "1784548800",
      type: "image",
      image: { id: "media-1" },
    } as never;
    expect(parseWebhookPayload(withImage)).toHaveLength(0);
  });

  it("tolera payloads malformados sin lanzar", () => {
    expect(parseWebhookPayload(null)).toHaveLength(0);
    expect(parseWebhookPayload({})).toHaveLength(0);
    expect(parseWebhookPayload({ entry: "no-array" })).toHaveLength(0);
  });
});
