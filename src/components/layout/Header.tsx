import Link from "next/link";
import {
  Bell,
  Gamepad2,
  Menu,
  Search,
  UserRound,
  X,
} from "lucide-react";

import HeaderNavigation from "./HeaderNavigation";
import styles from "./Header.module.css";

const MOBILE_MENU_ID = "deuna-mobile-menu-toggle";

export default function Header() {
  return (
    <>
      <input
        id={MOBILE_MENU_ID}
        type="checkbox"
        className={styles.mobileMenuToggle}
        aria-label="Abrir o cerrar menú"
        aria-controls="mobile-navigation"
      />

      <header className={styles.header}>
        <div className={styles.inner}>
          <Link
            href="/"
            className={styles.brand}
            aria-label="DeUna Games - Inicio"
          >
            <span className={styles.brandIcon}>
              <Gamepad2
                size={26}
                strokeWidth={2}
                aria-hidden="true"
              />
            </span>

            <span className={styles.brandName}>
              DeUna <strong>Games</strong>
            </span>
          </Link>

          <HeaderNavigation variant="desktop" />

          <div className={styles.actions}>
            <form
              className={styles.search}
              action="/juegos"
              role="search"
            >
              <Search
                size={18}
                strokeWidth={2}
                aria-hidden="true"
              />

              <input
                type="search"
                name="q"
                placeholder="Buscar juegos..."
                aria-label="Buscar juegos"
                autoComplete="off"
              />
            </form>

            <Link
              href="/juegos?equipo=requirements"
              className={styles.gameFinder}
            >
              <Gamepad2
                size={18}
                strokeWidth={2}
                aria-hidden="true"
              />
              <span>Por requisitos</span>
            </Link>

            <button
              type="button"
              className={styles.notificationButton}
              aria-label="Notificaciones (próximamente)"
              title="Notificaciones próximamente"
              disabled
            >
              <Bell
                size={21}
                strokeWidth={1.9}
                aria-hidden="true"
              />
              <span
                className={styles.notificationDot}
                aria-hidden="true"
              />
            </button>

            <button
              type="button"
              className={styles.profileButton}
              aria-label="Perfil (próximamente)"
              title="Perfil próximamente"
              disabled
            >
              <UserRound
                size={21}
                strokeWidth={1.8}
                aria-hidden="true"
              />
            </button>

            <label
              htmlFor={MOBILE_MENU_ID}
              className={styles.menuButton}
              aria-label="Abrir o cerrar menú"
              title="Menú"
            >
              <Menu
                size={23}
                className={styles.menuOpenIcon}
                aria-hidden="true"
              />
              <X
                size={23}
                className={styles.menuCloseIcon}
                aria-hidden="true"
              />
            </label>
          </div>
        </div>
      </header>

      <div
        id="mobile-navigation"
        className={styles.mobileNativePanel}
      >
        <div
          className={styles.mobileMenuGlow}
          aria-hidden="true"
        />

        <div className={styles.mobileInner}>
          <form
            className={styles.mobileSearch}
            action="/juegos"
            role="search"
          >
            <Search size={18} aria-hidden="true" />

            <input
              type="search"
              name="q"
              placeholder="Buscar juegos..."
              aria-label="Buscar juegos"
              autoComplete="off"
            />
          </form>

          <HeaderNavigation variant="mobile" />

          <Link
            href="/juegos?equipo=requirements"
            className={styles.mobileFinder}
          >
            <Gamepad2 size={19} aria-hidden="true" />
            Por requisitos
          </Link>
        </div>
      </div>
    </>
  );
}
