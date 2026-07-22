import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerSupabase } from "@/app/_lib/supabase-server";

/**
 * GET /auth/callback — intercambio del code de OAuth (Google) por sesión.
 * El Proxy reencamina a /onboarding si el usuario aún no tiene el claim
 * tenant_id; aquí solo se decide autenticado vs. fallido.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(new URL("/login?error=oauth", request.url));
  }

  const db = await createServerSupabase();
  const { error } = await db.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL("/login?error=oauth", request.url));
  }

  return NextResponse.redirect(new URL("/dashboard", request.url));
}
