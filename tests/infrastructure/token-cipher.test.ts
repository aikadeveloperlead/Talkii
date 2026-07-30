import { describe, expect, it } from "vitest";
import { decryptToken, encryptToken } from "@/infrastructure/security/token-cipher";

/**
 * Hallazgo MEDIO de auditoría: "Token de WhatsApp por tenant en texto
 * plano" — channel_bindings.access_token se guardaba sin cifrar. AES-256-GCM
 * (node:crypto nativo, mismo criterio que verify-signature.ts — sin
 * dependencias nuevas), clave derivada de ENCRYPTION_KEY vía SHA-256 (acepta
 * cualquier string, no exige exactamente 32 bytes a mano).
 */
describe("token-cipher (AES-256-GCM sobre node:crypto nativo)", () => {
  const key = "una-clave-de-desarrollo-cualquiera";

  it("cifra y descifra el mismo texto (round-trip)", () => {
    const cipherText = encryptToken("EAAG...token-real-de-meta", key);
    expect(cipherText).not.toContain("EAAG");
    expect(decryptToken(cipherText, key)).toBe("EAAG...token-real-de-meta");
  });

  it("produce un cifrado distinto cada vez (IV aleatorio por llamada)", () => {
    const a = encryptToken("mismo-texto", key);
    const b = encryptToken("mismo-texto", key);
    expect(a).not.toBe(b);
    expect(decryptToken(a, key)).toBe("mismo-texto");
    expect(decryptToken(b, key)).toBe("mismo-texto");
  });

  it("falla al descifrar con la clave equivocada", () => {
    const cipherText = encryptToken("secreto", key);
    expect(() => decryptToken(cipherText, "otra-clave-distinta")).toThrow();
  });

  it("falla al descifrar un texto manipulado (auth tag de GCM detecta el tamper)", () => {
    const cipherText = encryptToken("secreto", key);
    const tampered = cipherText.slice(0, -2) + "xx";
    expect(() => decryptToken(tampered, key)).toThrow();
  });
});
