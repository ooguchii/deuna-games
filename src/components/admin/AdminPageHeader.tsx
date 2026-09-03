import type { ReactNode } from "react";

import AdminContextBar from "@/components/admin/AdminContextBar";

import styles from "../../app/admin/admin.module.css";

type AdminPageHeaderProps = {
  eyebrow: ReactNode;
  title: ReactNode;
  description: ReactNode;
  action?: ReactNode;
};

/** Encabezado común: la barra contextual siempre queda después del texto. */
export default function AdminPageHeader({
  eyebrow,
  title,
  description,
  action,
}: AdminPageHeaderProps) {
  return (
    <>
      <header className={styles.pageHeader}>
        <div>
          <span>{eyebrow}</span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        {action}
      </header>
      <AdminContextBar />
    </>
  );
}
