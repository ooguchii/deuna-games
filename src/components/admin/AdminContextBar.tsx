"use client";

import { usePathname, useSearchParams } from "next/navigation";
import {
  Download,
  FileClock,
  ImageIcon,
  ListTree,
  MonitorCog,
  PanelTop,
} from "lucide-react";

import ux from "./AdminShellUx.module.css";

const sections = [
  {
    id: "ficha",
    label: "Ficha",
    icon: PanelTop,
  },
  {
    id: "datos",
    label: "Datos",
    icon: ListTree,
  },
  {
    id: "requisitos",
    label: "Requisitos",
    icon: MonitorCog,
  },
  {
    id: "multimedia",
    label: "Multimedia",
    icon: ImageIcon,
  },
  {
    id: "descargas",
    label: "Descargas",
    icon: Download,
  },
  {
    id: "historial",
    label: "Historial",
    icon: FileClock,
  },
] as const;

export default function AdminContextBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const match = /^\/admin\/juegos\/([^/]+)$/.exec(pathname);

  if (!match || match[1] === "nuevo") return null;

  const selected = searchParams.get("seccion") ?? "ficha";

  return (
    <nav
      className={ux.contextBar}
      aria-label="Secciones del editor de juego"
    >
      {sections.map((section) => {
        const Icon = section.icon;
        const active = selected === section.id;

        return (
          <a
            key={section.id}
            href={`${pathname}?seccion=${section.id}`}
            className={active ? ux.contextActive : undefined}
            aria-current={active ? "page" : undefined}
          >
            <Icon size={13} aria-hidden="true" />
            {section.label}
          </a>
        );
      })}
    </nav>
  );
}
