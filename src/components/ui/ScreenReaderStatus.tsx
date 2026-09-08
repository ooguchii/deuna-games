import styles from "./ScreenReaderStatus.module.css";

export default function ScreenReaderStatus({
  children,
}: {
  children: string;
}) {
  return (
    <span
      className={styles.status}
      role="status"
      aria-live="polite"
    >
      {children}
    </span>
  );
}
