import Link from "next/link";
import { signUpWithPassword } from "@/app/_lib/auth-actions";
import styles from "./page.module.css";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className={styles.main}>
      <section className={styles.card}>
        <h1 className={styles.title}>Crear cuenta</h1>
        {error && (
          <p className={styles.error}>
            No pudimos crear tu cuenta. Verifica los datos e intenta de nuevo.
          </p>
        )}

        <form action={signUpWithPassword} className={styles.form}>
          <label className={styles.label} htmlFor="email">
            Email
          </label>
          <input
            className={styles.input}
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
          />
          <label className={styles.label} htmlFor="password">
            Contraseña
          </label>
          <input
            className={styles.input}
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
          <button type="submit" className={styles.submitButton}>
            Registrarme
          </button>
        </form>

        <p className={styles.footer}>
          ¿Ya tienes cuenta? <Link href="/login">Inicia sesión</Link>
        </p>
      </section>
    </main>
  );
}
