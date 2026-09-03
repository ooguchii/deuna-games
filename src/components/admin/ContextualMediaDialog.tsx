"use client";

import { X } from "lucide-react";
import {
  type MouseEvent,
  type ReactNode,
  useEffect,
  useRef,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";

import styles from "./ContextualMediaDialog.module.css";

type Props = {
  eyebrow: string;
  title: string;
  description?: string;
  children: ReactNode;
  wide?: boolean;
  onClose: () => void;
};

const subscribeClient = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export default function ContextualMediaDialog({
  eyebrow,
  title,
  description,
  children,
  wide = false,
  onClose,
}: Props) {
  const mounted = useSyncExternalStore(
    subscribeClient,
    getClientSnapshot,
    getServerSnapshot
  );
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!mounted) return;

    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    const focusTimer = window.setTimeout(() => closeButtonRef.current?.focus(), 0);

    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus();
    };
  }, [mounted]);

  function handleBackdropClick(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) onClose();
  }

  if (!mounted) return null;

  return createPortal(
    <div
      className={styles.backdrop}
      role="presentation"
      onMouseDown={handleBackdropClick}
    >
      <section
        className={`${styles.dialog} ${wide ? styles.dialogWide : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="contextual-media-dialog-title"
        aria-describedby={description ? "contextual-media-dialog-description" : undefined}
      >
        <header className={styles.header}>
          <div className={styles.heading}>
            <span>{eyebrow}</span>
            <h2 id="contextual-media-dialog-title">{title}</h2>
            {description && (
              <p id="contextual-media-dialog-description">{description}</p>
            )}
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Cerrar editor multimedia"
          >
            <X size={19} aria-hidden="true" />
          </button>
        </header>
        <div className={styles.body}>{children}</div>
      </section>
    </div>,
    document.body
  );
}
