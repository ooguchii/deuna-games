"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Download,
  FileClock,
  Gauge,
  History,
  ImageIcon,
  ListTree,
  MonitorCog,
  Palette,
  PanelTop,
  Rocket,
  SquarePen,
  Tags,
  UserRound,
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

const catalogSections = [
  { id: "clasificaciones", label: "Clasificaciones", icon: ListTree },
  { id: "etiquetas", label: "Etiquetas", icon: Tags },
  { id: "publicacion", label: "Publicación", icon: Rocket },
  { id: "historial", label: "Historial", icon: FileClock },
] as const;

const homeSections = [
  { id: "curaduria", label: "Curaduría", icon: PanelTop },
  { id: "presentacion", label: "Presentación", icon: SquarePen },
  { id: "publicacion", label: "Publicación", icon: Rocket },
  { id: "historial", label: "Historial", icon: FileClock },
] as const;

const publicPageSections = [
  { id: "juegos", label: "Juegos", icon: PanelTop },
  { id: "actualizaciones", label: "Actualizaciones", icon: SquarePen },
  { id: "compatibilidad", label: "¿Qué puedo jugar?", icon: MonitorCog },
  { id: "publicacion", label: "Publicación", icon: Rocket },
  { id: "historial", label: "Historial", icon: FileClock },
] as const;

const configurationSections = [
  { id: "identidad", label: "Identidad", icon: UserRound },
  { id: "apariencia", label: "Apariencia", icon: Palette },
  { id: "publicacion", label: "Publicación", icon: Rocket },
  { id: "historial", label: "Historial", icon: History },
] as const;

const aboutSections = [
  { id: "encabezado", label: "Encabezado", icon: PanelTop },
  { id: "principios", label: "Principios", icon: ListTree },
  { id: "proposito", label: "Propósito", icon: SquarePen },
  { id: "cierre", label: "Cierre", icon: FileClock },
  { id: "publicacion", label: "Publicación", icon: Rocket },
  { id: "historial", label: "Historial", icon: History },
] as const;

function ContextLinks({
  pathname,
  selected,
  sections,
  label,
}: {
  pathname: string;
  selected: string;
  sections: readonly {
    id: string;
    label: string;
    icon: typeof PanelTop;
  }[];
  label: string;
}) {
  return (
    <nav className={ux.contextBar} aria-label={label}>
      {sections.map((section) => {
        const Icon = section.icon;
        const active = selected === section.id;

        return (
          <Link
            key={section.id}
            href={`${pathname}?seccion=${section.id}`}
            className={active ? ux.contextActive : undefined}
            aria-current={active ? "page" : undefined}
          >
            <Icon size={16} strokeWidth={1.9} aria-hidden="true" />
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}

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
            <Link
              key={section.id}
              href={href}
              className={active ? ux.contextActive : undefined}
              aria-current={active ? "page" : undefined}
            >
              <Icon size={16} strokeWidth={1.9} aria-hidden="true" />
              {section.label}
            </Link>
          );
        })}
      </nav>
    );
  }

  if (updateMatch && updateMatch[1] !== "nueva") {
    return (
      <ContextLinks
        pathname={pathname}
        selected={searchParams.get("seccion") ?? "editar"}
        sections={updateSections}
        label="Secciones del editor de actualización"
      />
    );
  }

  if (pathname === "/admin/catalogos") {
    return (
      <ContextLinks
        pathname={pathname}
        selected={searchParams.get("seccion") ?? "clasificaciones"}
        sections={catalogSections}
        label="Secciones del panel de catálogos"
      />
    );
  }

  if (pathname === "/admin/portada") {
    return (
      <ContextLinks
        pathname={pathname}
        selected={searchParams.get("seccion") ?? "curaduria"}
        sections={homeSections}
        label="Secciones del editor de Portada"
      />
    );
  }

  if (pathname === "/admin/paginas/presentacion") {
    return (
      <ContextLinks
        pathname={pathname}
        selected={searchParams.get("seccion") ?? "juegos"}
        sections={publicPageSections}
        label="Secciones de presentación pública"
      />
    );
  }

  if (pathname === "/admin/paginas/quienes-somos") {
    return (
      <ContextLinks
        pathname={pathname}
        selected={searchParams.get("seccion") ?? "encabezado"}
        sections={aboutSections}
        label="Secciones de Quiénes somos"
      />
    );
  }

  if (pathname === "/admin/configuracion") {
    return (
      <ContextLinks
        pathname={pathname}
        selected={searchParams.get("seccion") ?? "identidad"}
        sections={configurationSections}
        label="Secciones de Configuración"
      />
    );
  }

  return null;
}
