import { after } from "next/server";
import {
  createServiceClient,
  parseWebhookPayload,
  verifyWebhookSignature,
  type ParsedInboundMessage,
} from "@/infrastructure";
import { createContainer } from "@/app/_lib/container";

/**
 * Webhook de la WhatsApp Cloud API (Meta).
 *
 * GET  — verificación de alta: Meta manda hub.verify_token y espera de vuelta
 *        hub.challenge en texto plano.
 * POST — notificaciones. Se valida la firma sobre el RAW body, se responde 200
 *        de inmediato y el pipeline (HandleInboundMessage) corre en `after()`
 *        para no provocar reintentos de Meta mientras decide el LLM.
 *
 * Seguridad: el webhook no trae JWT de usuario → usa el service client (salta
 * RLS). El aislamiento multi-tenant lo garantiza la resolución
 * channel_binding → tenant dentro del use-case.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  const expected = process.env.WHATSAPP_VERIFY_TOKEN;
  if (mode === "subscribe" && expected && token === expected) {
    return new Response(challenge ?? "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

export async function POST(request: Request) {
  const rawBody = await request.text();

  const appSecret = process.env.WHATSAPP_APP_SECRET;
  const signature = request.headers.get("x-hub-signature-256");
  if (!appSecret || !verifyWebhookSignature(rawBody, signature, appSecret)) {
    return new Response("Invalid signature", { status: 401 });
  }

  let messages: ParsedInboundMessage[] = [];
  try {
    messages = parseWebhookPayload(JSON.parse(rawBody));
  } catch {
    // Body no-JSON: firmado pero malformado; se ignora con 200.
  }

  if (messages.length > 0) {
    after(async () => {
      const container = createContainer(createServiceClient());
      for (const message of messages) {
        try {
          const result = await container.handleInboundMessage.execute({
            channel: "whatsapp",
            channelExternalId: message.phoneNumberId,
            externalMessageId: message.wamid,
            from: message.from,
            displayName: message.displayName,
            text: message.text,
            timestamp: message.timestamp,
          });
          console.log(
            JSON.stringify({
              scope: "whatsapp.webhook",
              wamid: message.wamid,
              ...result,
            }),
          );
        } catch (error) {
          console.error(
            JSON.stringify({
              scope: "whatsapp.webhook",
              wamid: message.wamid,
              error: error instanceof Error ? error.message : String(error),
            }),
          );
        }
      }
    });
  }

  // Meta solo necesita saber que recibimos la notificación.
  return new Response("EVENT_RECEIVED", { status: 200 });
}
