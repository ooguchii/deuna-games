"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bell,
  BellRing,
  Check,
  Gamepad2,
  Menu,
  Search,
  UserRound,
  X,
} from "lucide-react";

import touchStyles from "@/components/ui/TouchTarget.module.css";
import type {
  AccountUpdateNotification,
} from "@/lib/accounts/update-notifications";

import HeaderNavigation from "./HeaderNavigation";
import styles from "./Header.module.css";
import notificationStyles from "./HeaderNotifications.module.css";
import SiteBrand from "./SiteBrand";

type HeaderClientProps = {
  siteName: string;
  accountAuthenticated: boolean;
  accountNotifications: AccountUpdateNotification[] | null;
};

function formatNotificationDate(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;

  return new Intl.DateTimeFormat("es", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function displayCount(count: number) {
  return count > 99 ? "99+" : String(count);
}

export default function HeaderClient({
  siteName,
  accountAuthenticated,
  accountNotifications,
}: HeaderClientProps) {
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState(
    accountNotifications ?? []
  );
  const [notificationPending, setNotificationPending] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState<string | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const mobilePanelRef = useRef<HTMLDivElement>(null);
  const notificationButtonRef = useRef<HTMLButtonElement>(null);
  const notificationRootRef = useRef<HTMLDivElement>(null);
  const notificationPanelRef = useRef<HTMLDivElement>(null);
  const notificationsAvailable = accountNotifications !== null;
  const unseenCount = notifications.length;

  const closeMobileMenu = useCallback((restoreFocus = false) => {
    setMobileMenuOpen(false);

    if (restoreFocus) {
      window.requestAnimationFrame(() => {
        menuButtonRef.current?.focus();
      });
    }
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) return;

    const previousOverflow = document.body.style.overflow;
    const desktopMedia = window.matchMedia("(min-width: 1161px)");

    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMobileMenu(true);
        return;
      }

      if (event.key !== "Tab") return;

      const focusable =
        mobilePanelRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );

      if (!focusable?.length) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    const handleDesktop = () => {
      if (desktopMedia.matches) {
        closeMobileMenu(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    desktopMedia.addEventListener("change", handleDesktop);

    const focusFrame = window.requestAnimationFrame(() => {
      mobilePanelRef.current
        ?.querySelector<HTMLInputElement>('input[type="search"]')
        ?.focus();
    });

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      desktopMedia.removeEventListener("change", handleDesktop);
    };
  }, [closeMobileMenu, mobileMenuOpen]);

  useEffect(() => {
    if (!notificationsOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !notificationRootRef.current?.contains(event.target)
      ) {
        setNotificationsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setNotificationsOpen(false);
      window.requestAnimationFrame(() => {
        notificationButtonRef.current?.focus();
      });
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    const focusFrame = window.requestAnimationFrame(() => {
      notificationPanelRef.current
        ?.querySelector<HTMLElement>('a[href], button:not([disabled])')
        ?.focus();
    });

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [notificationsOpen]);

  async function markNotificationsSeen() {
    if (notificationPending || unseenCount === 0) return;

    setNotificationPending(true);
    setNotificationMessage(null);

    try {
      const response = await fetch("/api/account/notifications/seen", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        },
        body: new URLSearchParams({ intent: "seen" }).toString(),
        credentials: "same-origin",
      });
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
      } | null;

      if (!response.ok || !payload?.ok) {
        throw new Error("No se pudieron marcar los avisos como vistos.");
      }

      setNotifications([]);
      router.refresh();
    } catch {
      setNotificationMessage(
        "No se pudieron actualizar los avisos. Inténtalo de nuevo."
      );
    } finally {
      setNotificationPending(false);
    }
  }

  const notificationLabel = !notificationsAvailable
    ? "Avisos temporalmente no disponibles"
    : unseenCount > 0
      ? `Avisos: ${unseenCount} nuevos`
      : "Avisos: sin novedades";
  const notificationPreview = notifications.slice(0, 4);

  return (
    <>
      <header className={styles.header}>
        <div className={styles.inner}>
          <SiteBrand siteName={siteName} />

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
              href="/requisitos"
              className={`${styles.gameFinder} ${touchStyles.minimum}`}
              data-brand-action="true"
            >
              <Gamepad2
                size={18}
                strokeWidth={2}
                aria-hidden="true"
              />
              <span>Por requisitos</span>
            </Link>

            {accountAuthenticated ? (
              <div
                ref={notificationRootRef}
                className={notificationStyles.notificationRoot}
              >
                <button
                  ref={notificationButtonRef}
                  type="button"
                  className={`${styles.notificationButton} ${touchStyles.minimum}`}
                  aria-label={notificationLabel}
                  aria-haspopup="dialog"
                  aria-expanded={notificationsOpen}
                  aria-controls="header-notifications"
                  title={notificationLabel}
                  onClick={() => {
                    closeMobileMenu(false);
                    setNotificationMessage(null);
                    setNotificationsOpen((current) => !current);
                  }}
                >
                  <Bell
                    size={21}
                    strokeWidth={1.9}
                    aria-hidden="true"
                  />
                  {unseenCount > 0 && (
                    <span
                      className={`${styles.notificationDot} ${notificationStyles.notificationBadge}`}
                      aria-hidden="true"
                    >
                      {displayCount(unseenCount)}
                    </span>
                  )}
                </button>

                {notificationsOpen && (
                  <div
                    id="header-notifications"
                    ref={notificationPanelRef}
                    className={notificationStyles.popover}
                    role="dialog"
                    aria-label="Avisos de Mi DeUna"
                  >
                    <div className={notificationStyles.popoverHeader}>
                      <span
                        className={notificationStyles.popoverIcon}
                        aria-hidden="true"
                      >
                        <BellRing size={20} />
                      </span>
                      <div className={notificationStyles.popoverHeading}>
                        <strong>Avisos</strong>
                        <span>
                          {!notificationsAvailable
                            ? "No pudimos cargar los avisos ahora"
                            : unseenCount > 0
                              ? `${unseenCount} ${unseenCount === 1 ? "novedad" : "novedades"} de juegos que sigues`
                              : "No tienes novedades pendientes"}
                        </span>
                      </div>
                    </div>

                    {!notificationsAvailable ? (
                      <div className={notificationStyles.emptyState}>
                        <Bell size={24} aria-hidden="true" />
                        <strong>Avisos no disponibles</strong>
                        <span>
                          Puedes abrir Mi DeUna para volver a intentarlo sin perder tu seguimiento.
                        </span>
                      </div>
                    ) : notificationPreview.length > 0 ? (
                      <div
                        className={notificationStyles.notificationList}
                        aria-label="Últimos avisos sin ver"
                      >
                        {notificationPreview.map((notification) => (
                          <Link
                            key={notification.id}
                            href={`/juegos/${notification.gameSlug}#versions`}
                            className={notificationStyles.notificationItem}
                            onClick={() => setNotificationsOpen(false)}
                          >
                            <div className={notificationStyles.notificationItemCopy}>
                              <strong>{notification.gameTitle}</strong>
                              <span>{notification.version}</span>
                              <p>{notification.summary}</p>
                            </div>
                            <time dateTime={notification.publishedAt}>
                              {formatNotificationDate(notification.publishedAt)}
                            </time>
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <div className={notificationStyles.emptyState}>
                        <Check size={24} aria-hidden="true" />
                        <strong>Estás al día</strong>
                        <span>
                          Las nuevas actualizaciones publicadas de los juegos que sigues aparecerán aquí.
                        </span>
                      </div>
                    )}

                    <div className={notificationStyles.popoverActions}>
                      {notificationsAvailable && unseenCount > 0 && (
                        <button
                          type="button"
                          className={notificationStyles.markSeenButton}
                          disabled={notificationPending}
                          onClick={() => void markNotificationsSeen()}
                        >
                          <Check size={16} aria-hidden="true" />
                          {notificationPending
                            ? "Actualizando..."
                            : "Marcar vistos"}
                        </button>
                      )}
                      <Link
                        href="/cuenta?vista=alerts"
                        className={notificationStyles.viewAll}
                        onClick={() => setNotificationsOpen(false)}
                      >
                        Ver todos los avisos
                      </Link>
                      {notificationMessage && (
                        <p
                          className={notificationStyles.status}
                          role="status"
                        >
                          {notificationMessage}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Link
                href="/cuenta?vista=alerts"
                className={`${styles.notificationButton} ${touchStyles.minimum}`}
                aria-label="Avisos de Mi DeUna"
                title="Avisos"
              >
                <Bell
                  size={21}
                  strokeWidth={1.9}
                  aria-hidden="true"
                />
              </Link>
            )}

            <Link
              href="/cuenta"
              className={`${styles.profileButton} ${touchStyles.minimum}`}
              aria-label="Cuenta"
              title="Cuenta"
            >
              <UserRound
                size={21}
                strokeWidth={1.8}
                aria-hidden="true"
              />
            </Link>

            <button
              ref={menuButtonRef}
              type="button"
              className={`${styles.menuButton} ${touchStyles.minimum} ${mobileMenuOpen ? styles.menuButtonOpen : ""}`}
              aria-label={mobileMenuOpen ? "Cerrar menú" : "Abrir menú"}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-navigation"
              title={mobileMenuOpen ? "Cerrar menú" : "Abrir menú"}
              onClick={() => {
                setNotificationsOpen(false);
                setMobileMenuOpen((current) => !current);
              }}
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
            </button>
          </div>
        </div>
      </header>

      <div
        id="mobile-navigation"
        ref={mobilePanelRef}
        className={`${styles.mobileNativePanel} ${mobileMenuOpen ? styles.mobileNativePanelOpen : ""}`}
        aria-hidden={!mobileMenuOpen}
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("a")) {
            closeMobileMenu(false);
          }
        }}
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
            onSubmit={() => closeMobileMenu(false)}
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
            href="/requisitos"
            className={styles.mobileFinder}
            data-brand-action="true"
          >
            <Gamepad2 size={19} aria-hidden="true" />
            Por requisitos
          </Link>

          <Link
            href="/cuenta?vista=alerts"
            className={notificationStyles.mobileNotificationLink}
          >
            <Bell size={19} aria-hidden="true" />
            Avisos
            {accountAuthenticated && unseenCount > 0 && (
              <span
                className={notificationStyles.mobileBadge}
                aria-label={`${unseenCount} avisos nuevos`}
              >
                {displayCount(unseenCount)}
              </span>
            )}
          </Link>

          <Link
            href="/cuenta"
            className={styles.mobileFinder}
            data-brand-action="true"
          >
            <UserRound size={19} aria-hidden="true" />
            Cuenta
          </Link>
        </div>
      </div>
    </>
  );
}
