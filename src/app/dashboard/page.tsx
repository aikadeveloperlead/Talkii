// src/app/dashboard/page.tsx
import { Identity } from "@/domain";
import { SupabaseTenantRepository } from "@/infrastructure/supabase/repositories";
import { signOut } from "@/app/_lib/auth-actions";
import { createServerSupabase } from "@/app/_lib/supabase-server";
import styles from "./page.module.css";

export default async function DashboardPage() {
  const db = await createServerSupabase();
  const {
    data: { user },
  } = await db.auth.getUser();

  const tenantId = (
    user?.app_metadata as Record<string, unknown> | undefined
  )?.tenant_id as string | undefined;

  const tenant = tenantId
    ? await new SupabaseTenantRepository(db).findById(Identity.of(tenantId))
    : null;

  return (
    <main className={styles.main}>
      <section className={styles.card}>
        <h1 className={styles.title}>{tenant?.name ?? "Talkii"}</h1>
        <p className={styles.subtitle}>Sesión iniciada correctamente.</p>
        <form action={signOut}>
          <button type="submit" className={styles.logoutButton}>
            Cerrar sesión
          </button>
        </form>
      </section>
    </main>
  );
}
