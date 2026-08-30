import Link from "next/link";
import {
  Gamepad2,
  Gauge,
  LayoutDashboard,
  LayoutTemplate,
  LogOut,
  RefreshCcw,
  Settings2,
  ShieldCheck,
} from "lucide-react";

import type {
  AdminSession,
} from "@/lib/admin/session";

import styles from "../../app/admin/admin.module.css";

const navigation = [
  {
    href: "/admin",
    label: "Resumen",
    icon: LayoutDashboard,
  },
  {
    href: "/admin/juegos",
    label: "Juegos",
    icon: Gamepad2,
  },
  {
    href: "/admin/actualizaciones",
    label: "Actualizaciones",
    icon: RefreshCcw,
  },
  {
    href: "/admin/portada",
    label: "Portada",
    icon: LayoutTemplate,
  },
  {
    href: "/admin/seguridad",
    label: "Seguridad",
    icon: ShieldCheck,
  },
  {
    href: "/admin/configuracion",
    label: "Configuración",
    icon: Settings2,
  },
] as const;

export default function AdminShell({
  session,
  children,
}: {
  session: AdminSession;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <Link
          href="/admin"
          className={styles.adminBrand}
          aria-label="Panel DeUna Games"
        >
          <span>DG</span>
          <div>
            <strong>DeUna Games</strong>
            <small>Administración privada</small>
          </div>
        </Link>

        <nav
          className={styles.adminNavigation}
          aria-label="Navegación administrativa"
        >
          {navigation.map((item) => {
            const Icon = item.icon;

            return (
              <Link key={item.href} href={item.href}>
                <Icon size={18} aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className={styles.privacyNotice}>
          <Gauge size={18} aria-hidden="true" />
          <div>
            <strong>Privacidad activa</strong>
            <span>
              Sin analíticas, IP, ubicación ni huellas de visitantes.
            </span>
          </div>
        </div>

        <div className={styles.ownerBlock}>
          <div>
            <span>Propietario</span>
            <strong>{session.username}</strong>
          </div>

          <form
            action="/api/admin/auth/logout"
            method="post"
          >
            <input
              type="hidden"
              name="intent"
              value="logout"
            />
            <button type="submit">
              <LogOut size={16} aria-hidden="true" />
              Salir
            </button>
          </form>
        </div>
      </aside>

      <main
        id="main-content"
        className={styles.adminMain}
      >
        {children}
      </main>
    </div>
  );
}
