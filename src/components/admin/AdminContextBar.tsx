"use client";

import { usePathname } from "next/navigation";
import {
  Download,
  ImageIcon,
  ListTree,
  MonitorCog,
  MoveUp,
} from "lucide-react";

import ux from "./AdminShellUx.module.css";

export default function AdminContextBar() {
  const pathname = usePathname();
  const match = /^\/admin\/juegos\/([^/]+)$/.exec(pathname);

  if (!match || match[1] === "nuevo") return null;

  return (
    <nav className={ux.contextBar} aria-label="Secciones del editor de juego">
      <a href="#main-content">
        <MoveUp size={13} aria-hidden="true" />
        Ficha
      </a>
      <a href="#datos-avanzados">
        <ListTree size={13} aria-hidden="true" />
        Datos
      </a>
      <a href="#requisitos">
        <MonitorCog size={13} aria-hidden="true" />
        Requisitos
      </a>
      <a href="#multimedia">
        <ImageIcon size={13} aria-hidden="true" />
        Multimedia
      </a>
      <a href="#descargas">
        <Download size={13} aria-hidden="true" />
        Descargas
      </a>
    </nav>
  );
}
