import Link from "next/link";

import SiteLogoMark from "@/components/brand/SiteLogoMark";
import touchStyles from "@/components/ui/TouchTarget.module.css";

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
      className={`${styles.brand} ${touchStyles.minimum}${className ? ` ${className}` : ""}`}
      aria-label={`${siteName} - Inicio`}
    >
      <SiteLogoMark
        size={26}
        strokeWidth={2}
      />

      <span className={styles.brandName}>
        <BrandName value={siteName} />
      </span>
    </Link>
  );
}
