import styles from "./page.module.css";

export default function Home() {
  return (
    <main className={styles.main}>
      <section className={styles.hero}>
        <span className={styles.badge}>SaaS · WhatsApp AI Agents</span>
        <h1 className={styles.title}>Talkii</h1>
        <p className={styles.subtitle}>
          Plataforma para ejecutar estrategias conversacionales con agentes de
          IA sobre WhatsApp.
        </p>
      </section>
    </main>
  );
}
