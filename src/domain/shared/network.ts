/**
 * Utilidades de red puras (sin I/O, sin resolución DNS) para bloquear SSRF en
 * destinos salientes definidos por el Tenant (p. ej. URLs de Webhook).
 */

/** IP (v4 o v6, literal) en rango privado, loopback, link-local o metadata en la nube. */
export function isPrivateOrMetadataAddress(address: string): boolean {
  const ip = address.replace(/^\[|\]$/g, "").toLowerCase();

  if (ip === "::1" || ip === "::ffff:127.0.0.1") return true;
  if (ip.startsWith("fc") || ip.startsWith("fd") || ip.startsWith("fe80")) return true;

  const parts = ip.split(".");
  if (parts.length === 4) {
    const nums = parts.map(Number);
    if (!nums.every((n) => Number.isInteger(n) && n >= 0 && n <= 255)) return false;
    const [a, b] = nums;
    if (a === 127) return true; // loopback
    if (a === 10) return true; // RFC1918
    if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918
    if (a === 192 && b === 168) return true; // RFC1918
    if (a === 169 && b === 254) return true; // link-local + metadata (169.254.169.254)
    if (a === 0) return true; // "this network"
  }
  return false;
}

/** Hostname que debe bloquearse aunque no sea una IP literal (p. ej. "localhost"). */
export function isDisallowedWebhookHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  return isPrivateOrMetadataAddress(host);
}
