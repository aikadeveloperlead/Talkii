/**
 * Utilidades de red puras (sin I/O, sin resolución DNS) para bloquear SSRF en
 * destinos salientes definidos por el Tenant (p. ej. URLs de Webhook).
 */

/** IP (v4 o v6, literal) en rango privado, loopback, link-local o metadata en la nube. */
export function isPrivateOrMetadataAddress(address: string): boolean {
  let ip = address.replace(/^\[|\]$/g, "").toLowerCase();

  // Normaliza IPv4 mapeada a IPv6 (`::ffff:a.b.c.d`) ANTES del parseo dotted-quad:
  // sin esto, `ip.split(".")` produce ["::ffff:169","254","169","254"], el
  // `Number.isInteger` falla y la función devolvía `false` — dejando pasar el
  // servicio de metadata de la nube vía un registro AAAA (hallazgo MEDIUM de
  // la auditoría santa-loop). Antes solo se cubría el literal `::ffff:127.0.0.1`.
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(ip);
  if (mapped) ip = mapped[1];

  if (ip === "::1") return true;
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
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT RFC6598 (redes internas de nube)
    if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking RFC2544
    if (a === 192 && b === 0) return true; // IETF protocol assignments RFC6890
  }
  return false;
}

/** Hostname que debe bloquearse aunque no sea una IP literal (p. ej. "localhost"). */
export function isDisallowedWebhookHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  return isPrivateOrMetadataAddress(host);
}
