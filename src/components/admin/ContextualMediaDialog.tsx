"use client";

import { X } from "lucide-react";
import {
  type ReactNode,
  useEffect,
  useRef,
} from "react";

import styles from "./ContextualMediaDialog.module.css";

type Props = {
  eyebrow: string;
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
};

export default function ContextualMediaDialog({
  eyebrow,
  title,
  description,
  children,
  onClose,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (!dialog.open) dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby="contextual-media-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={styles.shell}>
        <header className={styles.header}>
          <div className={styles.heading}>
            <span>{eyebrow}</span>
            <h2 id="contextual-media-dialog-title">{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Cerrar editor multimedia"
          >
            <X size={19} aria-hidden="true" />
          </button>
        </header>
        <div className={styles.body}>{children}</div>
      </div>
    </dialog>
  );
}

export { styles as contextualDialogStyles };
