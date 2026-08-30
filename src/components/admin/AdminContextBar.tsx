"use client";

import { usePathname, useSearchParams } from "next/navigation";
import {
  Download,
  FileClock,
  Gauge,
  ImageIcon,
  ListTree,
  MonitorCog,
  PanelTop,
  Rocket,
  SquarePen,
} from "lucide-react";

import ux from "./AdminShellUx.module.css";

const gameSections = [
  { id: "ficha", label: "Ficha", icon: PanelTop },
  { id: "datos", label: "Datos", icon: ListTree },
  { id: "requisitos", label: "Requisitos", icon: MonitorCog },
  { id: "rendimiento", label: "Rendimiento", icon: Gauge },
  { id: "multimedia", label: "Multimedia", icon: ImageIcon },
  { id: "descargas", label: "Descargas", icon: Download },
  { id: "publicacion", label: "Publicación", icon: Rocket },
  { id: "historial", label: "Historial", icon: FileClock },
] as const;

const updateSections = [
  { id: "editar", label: "Editar", icon: SquarePen },
  { id: "publicacion", label: "Publicación", icon: Rocket },
  { id: "historial", label: "Historial", icon: FileClock },
] as const;

export default function AdminContextBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const gameMatch = /^\/admin\/juegos\/([^/]+)(?:\/(publicacion))?$/.exec(pathname);
  const updateMatch = /^\/admin\/actualizaciones\/([^/]+)$/.exec(pathname);

  if (gameMatch && gameMatch[1] !== "nuevo") {
    const gamePath = `/admin/juegos/${gameMatch[1]}`;
    const selected = gameMatch[2] === "publicacion"
      ? "publicacion"
      : searchParams.get("seccion") ?? "ficha";

    return (
      <nav className={ux.contextBar} aria-label="Secciones del editor de juego">
        {gameSections.map((section) => {
          const Icon = section.icon;
          const active = selected === section.id;
          const href = section.id === "publicacion"
            ? `${gamePath}/publicacion`
            : `${gamePath}?seccion=${section.id}`;

          return (
            <a
              key={section.id}
              href={href}
              className={active ? ux.contextActive : undefined}
              aria-current={active ? "page" : undefined}
            >
              <Icon size={16} strokeWidth={1.9} aria-hidden="true" />
              {section.label}
            </a>
          );
        })}
      </nav>
    );
  }

  if (updateMatch && updateMatch[1] !== "nueva") {
    const selected = searchParams.get("seccion") ?? "editar";

    return (
      <nav className={ux.contextBar} aria-label="Secciones del editor de actualización">
        {updateSections.map((section) => {
          const Icon = section.icon;
          const active = selected === section.id;

          return (
            <a
              key={section.id}
              href={`${pathname}?seccion=${section.id}`}
              className={active ? ux.contextActive : undefined}
              aria-current={active ? "page" : undefined}
            >
              <Icon size={16} strokeWidth={1.9} aria-hidden="true" />
              {section.label}
            </a>
          );
        })}
      </nav>
    );
  }

  return null;
}
