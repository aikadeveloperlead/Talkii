import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Fábrica del cliente Supabase para la capa de infraestructura.
 *
 * Se mantiene AGNÓSTICO de Next.js a propósito: la infraestructura no debe
 * depender de detalles del framework (cookies, `next/headers`). El wiring con la
 * request de Next.js (propagar el JWT del usuario para que aplique RLS) vive en
 * la capa `app`, que llama a esta fábrica con el `accessToken` de la sesión.
 *
 * - `accessToken` (JWT del usuario): las políticas RLS se evalúan con la
 *   identidad y el `tenant_id` del claim → aislamiento multi-tenant real.
 * - Sin `accessToken`: usa la anon key (útil en flujos públicos/desarrollo).
 * - Para tareas de sistema que deben saltarse RLS, usar `createServiceClient`
 *   con la service-role key (NUNCA exponer al navegador).
 */
export interface SupabaseClientOptions {
  url?: string;
  anonKey?: string;
  /** JWT del usuario autenticado; habilita RLS por tenant. */
  accessToken?: string;
}

function requireEnv(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(
      `Supabase: falta la variable de entorno ${name}. Defínela en .env.local.`,
    );
  }
  return value;
}

export function createSupabaseClient(
  options: SupabaseClientOptions = {},
): SupabaseClient {
  const url = requireEnv(
    options.url ?? process.env.NEXT_PUBLIC_SUPABASE_URL,
    "NEXT_PUBLIC_SUPABASE_URL",
  );
  const anonKey = requireEnv(
    options.anonKey ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  );

  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: options.accessToken
      ? { headers: { Authorization: `Bearer ${options.accessToken}` } }
      : undefined,
  });
}

/**
 * Cliente con service-role: SALTA RLS. Úsalo solo en procesos de sistema del
 * servidor (webhooks de WhatsApp, jobs), nunca en código que llegue al cliente.
 */
export function createServiceClient(options: { url?: string; serviceRoleKey?: string } = {}): SupabaseClient {
  const url = requireEnv(
    options.url ?? process.env.NEXT_PUBLIC_SUPABASE_URL,
    "NEXT_PUBLIC_SUPABASE_URL",
  );
  const serviceRoleKey = requireEnv(
    options.serviceRoleKey ?? process.env.SUPABASE_SERVICE_ROLE_KEY,
    "SUPABASE_SERVICE_ROLE_KEY",
  );

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
