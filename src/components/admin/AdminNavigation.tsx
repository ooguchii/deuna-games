"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
} from "react";
import {
  FileText,
  Gamepad2,
  LayoutDashboard,
  LayoutTemplate,
  Settings2,
  ShieldCheck,
  Tags,
  UsersRound,
} from "lucide-react";
import { usePathname } from "next/navigation";

import type { AdminRole } from "@/lib/admin/roles";

import styles from "../../app/admin/admin.module.css";
import ux from "./AdminShellUx.module.css";

const navigation = [
  { href: "/admin", label: "Resumen", icon: LayoutDashboard, ownerOnly: false },
  { href: "/admin/juegos", label: "Juegos", icon: Gamepad2, ownerOnly: false },
  { href: "/admin/catalogos", label: "Catálogos", icon: Tags, ownerOnly: false },
  { href: "/admin/portada", label: "Portada", icon: LayoutTemplate, ownerOnly: false },
  { href: "/admin/paginas", label: "Páginas", icon: FileText, ownerOnly: false },
  { href: "/admin/cuentas", label: "Cuentas", icon: UsersRound, ownerOnly: true },
  { href: "/admin/seguridad", label: "Seguridad", icon: ShieldCheck, ownerOnly: false },
  { href: "/admin/configuracion", label: "Configuración", icon: Settings2, ownerOnly: false },
] as const;

function isActive(pathname: string, href: string) {
  return href === "/admin"
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
}

export default function AdminNavigation({
  role,
}: {
  role: AdminRole;
}) {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const nav = navRef.current;
      const active = nav?.querySelector<HTMLElement>(
        '[aria-current="page"]'
      );

      if (!nav || !active) return;

      const edgePadding = 10;
      const navRect = nav.getBoundingClientRect();
      const activeRect = active.getBoundingClientRect();
      const activeLeft =
        nav.scrollLeft + activeRect.left - navRect.left;
      const activeRight = activeLeft + activeRect.width;
      const visibleLeft = nav.scrollLeft + edgePadding;
      const visibleRight =
        nav.scrollLeft + nav.clientWidth - edgePadding;

      if (
        activeLeft >= visibleLeft &&
        activeRight <= visibleRight
      ) {
        return;
      }

      const centered =
        activeLeft -
        (nav.clientWidth - activeRect.width) / 2;
      const maximum = Math.max(
        0,
        nav.scrollWidth - nav.clientWidth
      );

      nav.scrollLeft = Math.min(
        maximum,
        Math.max(0, centered)
      );
    });

    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  return (
    <nav
      ref={navRef}
      className={`${styles.adminNavigation} ${ux.navigation}`}
      aria-label="Navegación administrativa"
    >
      {navigation
        .filter((item) => !item.ownerOnly || role === "owner")
        .map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={active ? ux.activeLink : undefined}
              aria-current={active ? "page" : undefined}
            >
              <Icon size={17} aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
    </nav>
  );
}
