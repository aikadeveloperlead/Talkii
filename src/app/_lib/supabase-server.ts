import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase con alcance de request para la capa `app` (Next.js).
 *
 * Es el ÚNICO punto acoplado a Next.js: puentea las cookies de la request
 * (`await cookies()` — asíncrono desde Next 15+) con `@supabase/ssr`, de modo
 * que el cliente lleva el JWT del usuario y las políticas RLS aíslan por tenant.
 *
 * El `SupabaseClient` resultante se inyecta en los repositorios de
 * `infrastructure` (que son agnósticos de cómo se creó el cliente).
 */
export async function createServerSupabase(): Promise<SupabaseClient> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Supabase: faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY en el entorno.",
    );
  }

  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        // En Server Components no se pueden escribir cookies; se ignora con
        // seguridad (el refresco de sesión se hace en Route Handlers/middleware).
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Contexto de solo lectura (render de Server Component): no-op.
        }
      },
    },
  });
}
