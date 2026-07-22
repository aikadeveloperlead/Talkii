// src/proxy.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { resolveRedirect, type ProxySession } from "@/app/_lib/resolve-redirect";

/**
 * Proxy (Next 16 — reemplaza `middleware`): refresca la sesión de Supabase en
 * cada request (patrón oficial `@supabase/ssr`) y decide redirecciones con el
 * helper puro `resolveRedirect`. No hace verificación de autorización fina —
 * eso vive en RLS y en cada Server Action/Route Handler (ver Next.js docs,
 * guía de autenticación: Proxy es un chequeo optimista, no la única defensa).
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Supabase: faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY en el entorno.",
    );
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const session: ProxySession = user
    ? {
        userId: user.id,
        tenantId:
          ((user.app_metadata as Record<string, unknown> | undefined)
            ?.tenant_id as string | undefined) ?? null,
      }
    : null;

  const target = resolveRedirect(request.nextUrl.pathname, session);
  if (target) {
    const redirect = NextResponse.redirect(new URL(target, request.url));
    for (const cookie of response.cookies.getAll()) {
      redirect.cookies.set(cookie);
    }
    return redirect;
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
