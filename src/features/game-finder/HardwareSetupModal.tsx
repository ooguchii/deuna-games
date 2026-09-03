"use client";

import {
  Cpu,
  ShieldCheck,
  SlidersHorizontal,
  X,
} from "lucide-react";
import {
  useEffect,
  useRef,
} from "react";
import { createPortal } from "react-dom";

import CpuIdentificationAssistant from "./CpuIdentificationAssistant";
import type { HardwareProfile } from "./types";

import styles from "./HardwareSetupModal.module.css";

type HardwareSetupModalProps = {
  hardware: HardwareProfile;
  ramLabel: string;
  onConfirmed: () => void;
  onClose: () => void;
  onConfigure: () => void;
};

function getFocusableElements(dialog: HTMLElement) {
  const inside = Array.from(
    dialog.querySelectorAll<HTMLElement>(
      "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex='-1'])"
    )
  );
  const dropdown = Array.from(
    document.querySelectorAll<HTMLElement>(
      "[data-cpu-assistant-results='true'] button:not([disabled])"
    )
  );

  return [...inside, ...dropdown].filter((element) => {
    const style = window.getComputedStyle(element);
    return style.visibility !== "hidden" && style.display !== "none";
  });
}

export default function HardwareSetupModal({
  hardware,
  ramLabel,
  onConfirmed,
  onClose,
  onConfigure,
}: HardwareSetupModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const returnFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    document.body.style.overflow = "hidden";

    const frame = window.requestAnimationFrame(() => {
      const firstControl = dialogRef.current?.querySelector<HTMLElement>(
        "input:not([disabled]), button:not([disabled])"
      );
      (firstControl ?? dialogRef.current)?.focus();
    });

    function handleKeyDown(event: KeyboardEvent) {
      const dialog = dialogRef.current;
      if (!dialog) return;

      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = getFocusableElements(dialog);
      if (!focusable.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const active = document.activeElement;
      const index = active instanceof HTMLElement
        ? focusable.indexOf(active)
        : -1;

      if (event.shiftKey) {
        if (index <= 0) {
          event.preventDefault();
          focusable[focusable.length - 1]?.focus();
        }
      } else if (index === -1 || index === focusable.length - 1) {
        event.preventDefault();
        focusable[0]?.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown, true);

    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown, true);
      document.body.style.overflow = previousOverflow;
      if (returnFocus?.isConnected) {
        returnFocus.focus();
      }
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className={styles.backdrop}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="hardware-setup-title"
        aria-describedby="hardware-setup-description"
        tabIndex={-1}
      >
        <button
          type="button"
          className={styles.closeButton}
          onClick={onClose}
          aria-label="Cerrar configuración inicial"
        >
          <X size={18} aria-hidden="true" />
        </button>

        <div className={styles.icon} aria-hidden="true">
          <Cpu size={24} />
        </div>

        <div className={styles.heading}>
          <span>CONFIGURACIÓN DE TU PC</span>
          <h2 id="hardware-setup-title">Completa lo que falta</h2>
          <p id="hardware-setup-description">
            DeUna ya detectó lo que el navegador permite. Confirma el procesador para mejorar la precisión de compatibilidad y FPS.
          </p>
        </div>

        <CpuIdentificationAssistant
          hardware={hardware}
          ramLabel={ramLabel}
          onConfirmed={onConfirmed}
          onCancel={onClose}
          showCloseButton={false}
        />

        <div className={styles.footer}>
          <div className={styles.privacyNote}>
            <ShieldCheck size={15} aria-hidden="true" />
            La selección se guarda sólo en este navegador.
          </div>

          <div className={styles.actions}>
            <button type="button" className={styles.secondary} onClick={onClose}>
              Seguir con detección orientativa
            </button>
            <button type="button" className={styles.primary} onClick={onConfigure}>
              <SlidersHorizontal size={16} aria-hidden="true" />
              Configurar todo manualmente
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
