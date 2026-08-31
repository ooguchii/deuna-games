import Link from "next/link";
import { Gamepad2 } from "lucide-react";

import styles from "./Header.module.css";

type SiteBrandProps = {
  siteName: string;
  className?: string;
  href?: string;
};

function BrandName({ value }: { value: string }) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  const highlighted = words.pop() ?? value;
  const leading = words.join(" ");

  return (
    <>
      {leading && <>{leading} </>}
      <strong>{highlighted}</strong>
    </>
  );
}

export default function SiteBrand({
  siteName,
  className,
  href = "/",
}: SiteBrandProps) {
  return (
    <Link
      href={href}
      className={`${styles.brand}${className ? ` ${className}` : ""}`}
      aria-label={`${siteName} - Inicio`}
    >
      <span className={styles.brandIcon}>
        <Gamepad2
          size={26}
          strokeWidth={2}
          aria-hidden="true"
        />
      </span>

      <span className={styles.brandName}>
        <BrandName value={siteName} />
      </span>
    </Link>
  );
}
