import Link from "next/link";
import { signInWithGoogle, signInWithPassword } from "@/app/_lib/auth-actions";
import styles from "./page.module.css";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className={styles.main}>
      <section className={styles.card}>
        <h1 className={styles.title}>Iniciar sesión</h1>
        {error && (
          <p className={styles.error}>
            No pudimos iniciar tu sesión. Verifica tus datos e intenta de nuevo.
          </p>
        )}

        <form action={signInWithGoogle}>
          <button type="submit" className={styles.googleButton}>
            Continuar con Google
          </button>
        </form>

        <div className={styles.divider}>o</div>

        <form action={signInWithPassword} className={styles.form}>
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
            autoComplete="current-password"
            required
          />
          <button type="submit" className={styles.submitButton}>
            Entrar
          </button>
        </form>

        <p className={styles.footer}>
          ¿No tienes cuenta? <Link href="/register">Regístrate</Link>
        </p>
      </section>
    </main>
  );
}
