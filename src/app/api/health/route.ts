import { createServerSupabase } from "@/app/_lib/supabase-server";

/**
 * GET /api/health — comprobación de vida del wiring.
 *
 * Verifica que el entorno está configurado y que Supabase es alcanzable con las
 * políticas RLS activas. No expone datos: solo confirma conectividad. Es
 * dinámica (usa cookies), por lo que Next no la cachea.
 */
export async function GET(): Promise<Response> {
  try {
    const db = await createServerSupabase();
    // Consulta mínima sujeta a RLS: comprueba conectividad sin filtrar datos.
    const { error } = await db.from("tenants").select("id").limit(1);
    if (error) {
      return Response.json(
        { status: "degraded", db: "error", detail: error.message },
        { status: 503 },
      );
    }
    return Response.json({ status: "ok", db: "reachable" });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "unknown";
    return Response.json({ status: "error", detail }, { status: 500 });
  }
}
