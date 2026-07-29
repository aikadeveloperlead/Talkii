import { NextResponse } from "next/server";
import { DomainError } from "@/domain";
import { createContainer, type Container } from "./container";
import { createServerSupabase } from "./supabase-server";

/**
 * Wiring compartido de los Route Handlers autenticados de la capa `app`
 * (Conversation Service — SCR-002 §7): resuelve el usuario de la request y
 * ensambla el Container con su cliente Supabase por-request (RLS aplica por
 * tenant). Devuelve null si no hay sesión, para que el caller responda 401.
 */
export async function requireContainer(): Promise<Container | null> {
  const db = await createServerSupabase();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return null;
  return createContainer(db);
}

export function unauthorized(): NextResponse {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

/** Traduce errores del caso de uso a la respuesta HTTP (SCR-002 §7 Errores). */
export function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof DomainError) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }
  console.error(error);
  return NextResponse.json({ error: "Internal Error" }, { status: 500 });
}
