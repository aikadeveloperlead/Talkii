import { describe, expect, it } from "vitest";
import { isDisallowedWebhookHostname, isPrivateOrMetadataAddress } from "@/domain";

/**
 * Hallazgo MEDIUM de la auditoría santa-loop: el filtro SSRF no normalizaba
 * direcciones IPv4 mapeadas a IPv6 (`::ffff:a.b.c.d`), así que un registro
 * AAAA apuntando a `::ffff:169.254.169.254` pasaba el chequeo y permitía
 * alcanzar el servicio de metadata de la nube vía DNS rebinding.
 */
describe("isPrivateOrMetadataAddress — IPv4 literal (cobertura previa)", () => {
  it.each([
    ["127.0.0.1", "loopback"],
    ["10.0.0.5", "RFC1918 /8"],
    ["172.16.0.1", "RFC1918 /12"],
    ["192.168.1.1", "RFC1918 /16"],
    ["169.254.169.254", "metadata de la nube"],
    ["0.0.0.0", "this network"],
  ])("bloquea %s (%s)", (ip) => {
    expect(isPrivateOrMetadataAddress(ip)).toBe(true);
  });

  it("permite una IP pública", () => {
    expect(isPrivateOrMetadataAddress("93.184.216.34")).toBe(false);
  });
});

describe("isPrivateOrMetadataAddress — IPv4 mapeada a IPv6 (hallazgo MEDIUM)", () => {
  it.each([
    ["::ffff:169.254.169.254", "metadata de la nube mapeada"],
    ["::ffff:10.0.0.5", "RFC1918 mapeada"],
    ["::ffff:127.0.0.1", "loopback mapeada"],
    ["::ffff:192.168.1.1", "RFC1918 /16 mapeada"],
    ["::FFFF:169.254.169.254", "mapeada en mayúsculas"],
  ])("bloquea %s (%s)", (ip) => {
    expect(isPrivateOrMetadataAddress(ip)).toBe(true);
  });

  it("permite una IP pública mapeada", () => {
    expect(isPrivateOrMetadataAddress("::ffff:93.184.216.34")).toBe(false);
  });
});

describe("isPrivateOrMetadataAddress — rangos adicionales no cubiertos antes", () => {
  it.each([
    ["100.64.0.1", "CGNAT RFC6598"],
    ["100.127.255.255", "CGNAT límite superior"],
    ["198.18.0.1", "benchmarking RFC2544"],
    ["192.0.0.1", "IETF protocol assignments"],
  ])("bloquea %s (%s)", (ip) => {
    expect(isPrivateOrMetadataAddress(ip)).toBe(true);
  });

  it("no bloquea 100.128.0.1 (fuera del rango CGNAT)", () => {
    expect(isPrivateOrMetadataAddress("100.128.0.1")).toBe(false);
  });
});

describe("isPrivateOrMetadataAddress — IPv6 nativo", () => {
  it.each([
    ["::1", "loopback"],
    ["fc00::1", "unique local"],
    ["fd12:3456::1", "unique local"],
    ["fe80::1", "link-local"],
  ])("bloquea %s (%s)", (ip) => {
    expect(isPrivateOrMetadataAddress(ip)).toBe(true);
  });
});

describe("isDisallowedWebhookHostname", () => {
  it("bloquea localhost y subdominios", () => {
    expect(isDisallowedWebhookHostname("localhost")).toBe(true);
    expect(isDisallowedWebhookHostname("api.localhost")).toBe(true);
  });

  it("bloquea un hostname que es una IP privada mapeada", () => {
    expect(isDisallowedWebhookHostname("::ffff:10.0.0.1")).toBe(true);
  });

  it("permite un hostname público normal", () => {
    expect(isDisallowedWebhookHostname("example.com")).toBe(false);
  });
});
