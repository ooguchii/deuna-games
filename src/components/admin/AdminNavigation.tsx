"use client";

import Link from "next/link";
import {
  FileText,
  Gamepad2,
  LayoutDashboard,
  LayoutTemplate,
  RefreshCcw,
  Settings2,
  ShieldCheck,
  Tags,
} from "lucide-react";
import { usePathname } from "next/navigation";

import styles from "../../app/admin/admin.module.css";
import ux from "./AdminShellUx.module.css";

const navigation = [
  { href: "/admin", label: "Resumen", icon: LayoutDashboard },
  { href: "/admin/juegos", label: "Juegos", icon: Gamepad2 },
  { href: "/admin/catalogos", label: "Catálogos", icon: Tags },
  { href: "/admin/actualizaciones", label: "Actualizaciones", icon: RefreshCcw },
  { href: "/admin/portada", label: "Portada", icon: LayoutTemplate },
  { href: "/admin/paginas", label: "Páginas", icon: FileText },
  { href: "/admin/seguridad", label: "Seguridad", icon: ShieldCheck },
  { href: "/admin/configuracion", label: "Configuración", icon: Settings2 },
] as const;

function isActive(pathname: string, href: string) {
  return href === "/admin"
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
}

export default function AdminNavigation() {
  const pathname = usePathname();

  return (
    <nav
      className={`${styles.adminNavigation} ${ux.navigation}`}
      aria-label="Navegación administrativa"
    >
      {navigation.map((item) => {
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
