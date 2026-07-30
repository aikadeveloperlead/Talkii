// src/app/dashboard/page.tsx
import { signOut } from "@/app/_lib/auth-actions";
import { requireTenantContainer } from "@/app/_lib/route-container";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const scope = await requireTenantContainer();
  const workspace = scope
    ? await scope.container.getWorkspace.execute(scope.tenantId)
    : null;

  return (
    <main className={styles.main}>
      <section className={styles.card}>
        <h1 className={styles.title}>{workspace?.name ?? "Talkii"}</h1>
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
