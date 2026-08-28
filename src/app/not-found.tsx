import Link from "next/link";

import {
  Gamepad2,
  House,
  SearchX,
} from "lucide-react";

import Footer from "@/components/layout/Footer";
import Header from "@/components/layout/Header";

import styles from "./not-found.module.css";

export default function NotFound() {
  return (
    <>
      <Header />

      <main
        id="main-content"
        className={styles.main}
      >
        <section
          className={styles.card}
          aria-labelledby="not-found-title"
        >
          <div
            className={styles.glow}
            aria-hidden="true"
          />

          <span
            className={styles.icon}
            aria-hidden="true"
          >
            <SearchX size={30} />
          </span>

          <span className={styles.code}>
            ERROR 404
          </span>

          <h1 id="not-found-title">
            Esta página no está en el catálogo
          </h1>

          <p>
            El enlace puede haber cambiado o la página que buscás ya no existe.
            Puedes volver al inicio o seguir explorando juegos.
          </p>

          <div className={styles.actions}>
            <Link
              href="/"
              className={styles.primary}
            >
              <House size={18} aria-hidden="true" />
              Volver al inicio
            </Link>

            <Link
              href="/juegos"
              className={styles.secondary}
            >
              <Gamepad2 size={18} aria-hidden="true" />
              Explorar juegos
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
