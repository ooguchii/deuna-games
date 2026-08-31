import Link from "next/link";
import {
  Gauge,
  LogOut,
} from "lucide-react";

import AdminNavigation from "@/components/admin/AdminNavigation";
import SiteLogoMark from "@/components/brand/SiteLogoMark";
import type {
  AdminSession,
} from "@/lib/admin/session";

import styles from "../../app/admin/admin.module.css";
import ux from "./AdminShellUx.module.css";

export default function AdminShell({
  session,
  children,
}: {
  session: AdminSession;
  children: React.ReactNode;
}) {
  return (
    <div className={`${styles.shell} ${ux.shell}`}>
      <a href="#main-content" className={ux.skipLink}>
        Saltar al contenido principal
      </a>

      <aside className={`${styles.sidebar} ${ux.sidebar}`}>
        <Link
          href="/admin"
          className={styles.adminBrand}
          aria-label="Panel DeUna Games"
        >
          <span>
            <SiteLogoMark size={24} strokeWidth={2.1} />
          </span>
          <div>
            <strong>DeUna Games</strong>
            <small>Administración privada</small>
          </div>
        </Link>

        <AdminNavigation role={session.role} />

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
            <span>
              {session.role === "owner" ? "Propietario" : "Administrador"}
            </span>
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
        tabIndex={-1}
        className={`${styles.adminMain} ${ux.main}`}
      >
        {children}
      </main>
    </div>
  );
}
