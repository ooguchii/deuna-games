"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bell,
  BellRing,
  Check,
  CircleUserRound,
  Compass,
  Gamepad2,
  Gift,
  LibraryBig,
  LogOut,
  Menu,
  MonitorCog,
  Search,
  Settings,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";

import touchStyles from "@/components/ui/TouchTarget.module.css";
import {
  accountDashboardDestinations,
  accountDashboardViewHref,
  type AccountDashboardView,
} from "@/lib/accounts/dashboard-view";
import type {
  AccountUpdateNotification,
} from "@/lib/accounts/update-notifications";

import accountStyles from "./HeaderAccountMenu.module.css";
import avatarStyles from "./HeaderClientAvatar.module.css";
import HeaderNavigation from "./HeaderNavigation";
import styles from "./Header.module.css";
import notificationStyles from "./HeaderNotifications.module.css";
import SiteBrand from "./SiteBrand";

type HeaderClientProps = {
  siteName: string;
  accountIdentity: {
    username: string;
    displayName: string | null;
  } | null;
  accountNotifications: AccountUpdateNotification[] | null;
  accountAvatarUrl: string | null;
};

type HeaderPopover = "notifications" | "account" | null;
type MobileMenuSource = "menu" | "account";

const accountDestinationIcons: Record<AccountDashboardView, LucideIcon> = {
  overview: Gamepad2,
  rewards: Gift,
  games: LibraryBig,
  pc: MonitorCog,
  alerts: Bell,
  discover: Compass,
  profile: UserRound,
  settings: Settings,
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

function AccountAvatarVisual({
  accountAvatarUrl,
  fallback: Fallback,
  size,
}: {
  accountAvatarUrl: string | null;
  fallback: LucideIcon;
  size: number;
}) {
  if (accountAvatarUrl) {
    return (
      <span
        className={avatarStyles.image}
        style={{
          backgroundImage: `url("${accountAvatarUrl}")`,
        }}
        aria-hidden="true"
      />
    );
  }

  return (
    <Fallback
      size={size}
      strokeWidth={1.8}
      aria-hidden="true"
    />
  );
}

export default function HeaderClient({
  siteName,
  accountIdentity,
  accountNotifications,
  accountAvatarUrl,
}: HeaderClientProps) {
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activePopover, setActivePopover] = useState<HeaderPopover>(null);
  const [dismissedNotificationFeed, setDismissedNotificationFeed] = useState<string | null>(null);
  const [notificationPending, setNotificationPending] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState<string | null>(null);
  const [logoutPending, setLogoutPending] = useState(false);
  const [accountMessage, setAccountMessage] = useState<string | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const mobilePanelRef = useRef<HTMLDivElement>(null);
  const mobileMenuSourceRef = useRef<MobileMenuSource>("menu");
  const notificationButtonRef = useRef<HTMLButtonElement>(null);
  const notificationRootRef = useRef<HTMLDivElement>(null);
  const notificationPanelRef = useRef<HTMLDivElement>(null);
  const accountButtonRef = useRef<HTMLButtonElement>(null);
  const accountRootRef = useRef<HTMLDivElement>(null);
  const accountPanelRef = useRef<HTMLDivElement>(null);
  const notificationsAvailable = accountNotifications !== null;
  const notificationFeed = JSON.stringify(accountNotifications);
  const notifications = dismissedNotificationFeed === notificationFeed
    ? []
    : accountNotifications ?? [];
  const unseenCount = notifications.length;
  const notificationsOpen = activePopover === "notifications";
  const accountMenuOpen = activePopover === "account";
  const displayName = accountIdentity?.displayName?.trim() || accountIdentity?.username || "Mi DeUna";

  const closeMobileMenu = useCallback((restoreFocus = false) => {
    setMobileMenuOpen(false);

    if (restoreFocus) {
      const source = mobileMenuSourceRef.current;
      window.requestAnimationFrame(() => {
        if (source === "account") {
          accountButtonRef.current?.focus();
        } else {
          menuButtonRef.current?.focus();
        }
      });
    }
  }, []);

  function openMobileMenu(source: MobileMenuSource) {
    mobileMenuSourceRef.current = source;
    setActivePopover(null);
    setAccountMessage(null);
    setMobileMenuOpen(true);
  }

  function togglePopover(next: Exclude<HeaderPopover, null>) {
    closeMobileMenu(false);
    setNotificationMessage(null);
    setAccountMessage(null);
    setActivePopover((current) => current === next ? null : next);
  }

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
      const selector = mobileMenuSourceRef.current === "account"
        ? '[data-account-shortcut="true"]'
        : 'input[type="search"]';
      mobilePanelRef.current
        ?.querySelector<HTMLElement>(selector)
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
    if (!activePopover) return;

    const root = activePopover === "notifications"
      ? notificationRootRef.current
      : accountRootRef.current;
    const panel = activePopover === "notifications"
      ? notificationPanelRef.current
      : accountPanelRef.current;
    const trigger = activePopover === "notifications"
      ? notificationButtonRef.current
      : accountButtonRef.current;

    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !root?.contains(event.target)) {
        setActivePopover(null);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setActivePopover(null);
      window.requestAnimationFrame(() => trigger?.focus());
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    const focusFrame = window.requestAnimationFrame(() => {
      panel
        ?.querySelector<HTMLElement>('a[href], button:not([disabled])')
        ?.focus();
    });

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [activePopover]);

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

      setDismissedNotificationFeed(notificationFeed);
      router.refresh();
    } catch {
      setNotificationMessage(
        "No se pudieron actualizar los avisos. Inténtalo de nuevo."
      );
    } finally {
      setNotificationPending(false);
    }
  }

  async function logoutFromHeader() {
    if (logoutPending) return;

    setLogoutPending(true);
    setAccountMessage(null);

    try {
      const response = await fetch("/api/account/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        },
        body: new URLSearchParams({ intent: "logout" }).toString(),
        credentials: "same-origin",
      });
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
      } | null;

      if (!response.ok || !payload?.ok) {
        throw new Error("No se pudo cerrar la sesión.");
      }

      setActivePopover(null);
      setMobileMenuOpen(false);
      router.replace("/");
      router.refresh();
    } catch {
      setAccountMessage(
        "No se pudo cerrar la sesión. Inténtalo de nuevo."
      );
    } finally {
      setLogoutPending(false);
    }
  }

  const notificationLabel = !notificationsAvailable
    ? "Avisos temporalmente no disponibles"
    : unseenCount > 0
      ? `Avisos: ${unseenCount} nuevos`
      : "Avisos: sin novedades";
  const notificationPreview = notifications.slice(0, 4);

  function renderAccountShortcuts(mobile: boolean) {
    return accountDashboardDestinations.map((destination) => {
      const Icon = accountDestinationIcons[destination.id];
      const badge = destination.id === "alerts" ? unseenCount : 0;

      if (mobile) {
        return (
          <Link
            key={destination.id}
            href={accountDashboardViewHref(destination.id)}
            className={`${accountStyles.mobileShortcut} ${destination.id === "alerts" ? notificationStyles.mobileNotificationLink : ""}`}
            data-account-shortcut="true"
            onClick={() => closeMobileMenu(false)}
          >
            <Icon size={18} aria-hidden="true" />
            <span>{destination.label}</span>
            {badge > 0 && (
              <b
                className={`${accountStyles.shortcutBadge} ${notificationStyles.mobileBadge}`}
                aria-label={`${badge} avisos nuevos`}
              >
                {displayCount(badge)}
              </b>
            )}
          </Link>
        );
      }

      return (
        <Link
          key={destination.id}
          href={accountDashboardViewHref(destination.id)}
          className={accountStyles.shortcut}
          onClick={() => setActivePopover(null)}
        >
          <span className={accountStyles.shortcutIcon} aria-hidden="true">
            <Icon size={18} />
          </span>
          <span className={accountStyles.shortcutCopy}>
            <strong>{destination.label}</strong>
            <span>{destination.description}</span>
          </span>
          {badge > 0 && (
            <b
              className={accountStyles.shortcutBadge}
              aria-label={`${badge} avisos nuevos`}
            >
              {displayCount(badge)}
            </b>
          )}
        </Link>
      );
    });
  }

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

            <div className={accountStyles.personalActions}>
              {accountIdentity ? (
                <>
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
                      onClick={() => togglePopover("notifications")}
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
                                onClick={() => setActivePopover(null)}
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
                            onClick={() => setActivePopover(null)}
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

                  <div
                    ref={accountRootRef}
                    className={accountStyles.accountRoot}
                  >
                    <button
                      ref={accountButtonRef}
                      type="button"
                      className={`${styles.profileButton} ${touchStyles.minimum} ${accountMenuOpen ? accountStyles.profileButtonOpen : ""}`}
                      aria-label={`Menú de Mi DeUna de ${displayName}`}
                      aria-haspopup="dialog"
                      aria-expanded={accountMenuOpen}
                      aria-controls="header-account-menu"
                      title="Menú de Mi DeUna"
                      onClick={() => {
                        if (window.matchMedia("(max-width: 600px)").matches) {
                          openMobileMenu("account");
                          return;
                        }
                        togglePopover("account");
                      }}
                    >
                      <AccountAvatarVisual
                        accountAvatarUrl={accountAvatarUrl}
                        fallback={UserRound}
                        size={21}
                      />
                    </button>

                    {accountMenuOpen && (
                      <div
                        id="header-account-menu"
                        ref={accountPanelRef}
                        className={accountStyles.popover}
                        role="dialog"
                        aria-label="Accesos de Mi DeUna"
                      >
                        <div className={accountStyles.identity}>
                          <span className={accountStyles.avatar} aria-hidden="true">
                            <AccountAvatarVisual
                              accountAvatarUrl={accountAvatarUrl}
                              fallback={CircleUserRound}
                              size={24}
                            />
                          </span>
                          <div className={accountStyles.identityCopy}>
                            <strong>{displayName}</strong>
                            <span>@{accountIdentity.username} · Mi DeUna</span>
                          </div>
                        </div>

                        <nav
                          className={accountStyles.shortcutGrid}
                          aria-label="Accesos rápidos de Mi DeUna"
                        >
                          {renderAccountShortcuts(false)}
                        </nav>

                        <div className={accountStyles.footer}>
                          <button
                            type="button"
                            className={accountStyles.logoutButton}
                            disabled={logoutPending}
                            onClick={() => void logoutFromHeader()}
                          >
                            <LogOut size={17} aria-hidden="true" />
                            {logoutPending ? "Cerrando sesión..." : "Cerrar sesión"}
                          </button>
                          {accountMessage && (
                            <p className={accountStyles.status} role="status">
                              {accountMessage}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <Link
                  href="/cuenta?modo=entrar"
                  className={`${accountStyles.signInButton} ${touchStyles.minimum}`}
                  aria-label="Iniciar sesión en Mi DeUna"
                >
                  <UserRound size={18} aria-hidden="true" />
                  <span className={accountStyles.signInLabelFull}>Iniciar sesión</span>
                  <span className={accountStyles.signInLabelCompact}>Entrar</span>
                </Link>
              )}
            </div>

            <button
              ref={menuButtonRef}
              type="button"
              className={`${styles.menuButton} ${touchStyles.minimum} ${mobileMenuOpen ? styles.menuButtonOpen : ""}`}
              aria-label={mobileMenuOpen ? "Cerrar menú" : "Abrir menú"}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-navigation"
              title={mobileMenuOpen ? "Cerrar menú" : "Abrir menú"}
              onClick={() => {
                setActivePopover(null);
                if (mobileMenuOpen) {
                  closeMobileMenu(false);
                } else {
                  openMobileMenu("menu");
                }
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

          {accountIdentity ? (
            <section
              className={accountStyles.mobileAccountSection}
              aria-label="Mi DeUna"
            >
              <div className={accountStyles.mobileIdentity}>
                <span className={accountStyles.avatar} aria-hidden="true">
                  <AccountAvatarVisual
                    accountAvatarUrl={accountAvatarUrl}
                    fallback={CircleUserRound}
                    size={22}
                  />
                </span>
                <div className={accountStyles.identityCopy}>
                  <strong>{displayName}</strong>
                  <span>@{accountIdentity.username}</span>
                </div>
              </div>

              <nav
                className={accountStyles.mobileGrid}
                aria-label="Accesos de Mi DeUna"
              >
                {renderAccountShortcuts(true)}
              </nav>

              <button
                type="button"
                className={accountStyles.mobileLogout}
                disabled={logoutPending}
                onClick={() => void logoutFromHeader()}
              >
                <LogOut size={17} aria-hidden="true" />
                {logoutPending ? "Cerrando sesión..." : "Cerrar sesión"}
              </button>
              {accountMessage && (
                <p className={accountStyles.status} role="status">
                  {accountMessage}
                </p>
              )}
            </section>
          ) : (
            <Link
              href="/cuenta?modo=entrar"
              className={accountStyles.mobileSignIn}
            >
              <UserRound size={19} aria-hidden="true" />
              Iniciar sesión en Mi DeUna
            </Link>
          )}
        </div>
      </div>
    </>
  );
}
