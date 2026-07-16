import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verifica la firma `X-Hub-Signature-256` de los webhooks de Meta:
 * HMAC-SHA256 del RAW body con el App Secret, en comparación de tiempo
 * constante. Debe calcularse sobre los bytes exactos recibidos (no sobre el
 * JSON re-serializado).
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string,
): boolean {
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) return false;

  const expected = createHmac("sha256", appSecret)
    .update(rawBody, "utf8")
    .digest();
  const given = Buffer.from(signatureHeader.slice("sha256=".length), "hex");

  return given.length === expected.length && timingSafeEqual(given, expected);
}
