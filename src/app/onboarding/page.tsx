import { provisionTenant } from "@/app/_lib/auth-actions";
import styles from "./page.module.css";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className={styles.main}>
      <section className={styles.card}>
        <h1 className={styles.title}>Crea tu organización</h1>
        <p className={styles.subtitle}>
          Un último paso: nombra tu organización para empezar a usar Talkii.
        </p>
        {error && (
          <p className={styles.error}>
            No pudimos crear tu organización. Intenta de nuevo.
          </p>
        )}

        <form action={provisionTenant} className={styles.form}>
          <label className={styles.label} htmlFor="organizationName">
            Nombre de la organización
          </label>
          <input
            className={styles.input}
            id="organizationName"
            name="organizationName"
            type="text"
            required
          />
          <button type="submit" className={styles.submitButton}>
            Continuar
          </button>
        </form>
      </section>
    </main>
  );
}
