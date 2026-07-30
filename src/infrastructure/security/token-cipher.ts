import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Cifrado simétrico para secretos por-tenant en reposo (hallazgo MEDIO de
 * auditoría: channel_bindings.access_token guardado en texto plano).
 * AES-256-GCM vía node:crypto nativo — mismo criterio que
 * whatsapp/verify-signature.ts, sin dependencias nuevas.
 *
 * La clave del env (ENCRYPTION_KEY, cualquier longitud) se deriva a 32 bytes
 * vía SHA-256: no exige que el operador maneje bytes exactos a mano.
 *
 * Formato del texto cifrado: `iv:authTag:cipher`, los tres en base64.
 */
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function deriveKey(key: string): Buffer {
  return createHash("sha256").update(key, "utf8").digest();
}

export function encryptToken(plainText: string, key: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, deriveKey(key), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv, authTag, encrypted].map((buf) => buf.toString("base64")).join(":");
}

export function decryptToken(cipherText: string, key: string): string {
  const [ivB64, authTagB64, encryptedB64] = cipherText.split(":");
  if (!ivB64 || !authTagB64 || !encryptedB64) {
    throw new Error("decryptToken: formato de texto cifrado inválido");
  }
  const decipher = createDecipheriv(ALGORITHM, deriveKey(key), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedB64, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}
