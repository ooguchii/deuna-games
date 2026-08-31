"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  useEffect,
  useRef,
} from "react";
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

type ContextSection = {
  id: string;
  label: string;
  icon: typeof PanelTop;
};

function useKeepActiveContextVisible(selected: string) {
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const nav = navRef.current;
      const active = nav?.querySelector<HTMLElement>(
        '[aria-current="page"]'
      );

      if (!nav || !active) return;

      const edgePadding = 10;
      const visibleLeft = nav.scrollLeft + edgePadding;
      const visibleRight =
        nav.scrollLeft + nav.clientWidth - edgePadding;
      const activeLeft = active.offsetLeft;
      const activeRight = activeLeft + active.offsetWidth;

      if (
        activeLeft >= visibleLeft &&
        activeRight <= visibleRight
      ) {
        return;
      }

      const centered =
        activeLeft -
        (nav.clientWidth - active.offsetWidth) / 2;
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
  }, [selected]);

  return navRef;
}

function ContextLinks({
  pathname,
  selected,
  sections,
  label,
  hrefForSection,
}: {
  pathname: string;
  selected: string;
  sections: readonly ContextSection[];
  label: string;
  hrefForSection?: (sectionId: string) => string;
}) {
  const navRef = useKeepActiveContextVisible(selected);

  return (
    <nav
      ref={navRef}
      className={ux.contextBar}
      aria-label={label}
    >
      {sections.map((section) => {
        const Icon = section.icon;
        const active = selected === section.id;
        const href = hrefForSection
          ? hrefForSection(section.id)
          : `${pathname}?seccion=${section.id}`;

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
      <ContextLinks
        pathname={gamePath}
        selected={selected}
        sections={gameSections}
        label="Secciones del editor de juego"
        hrefForSection={(sectionId) =>
          sectionId === "publicacion"
            ? `${gamePath}/publicacion`
            : `${gamePath}?seccion=${sectionId}`
        }
      />
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
