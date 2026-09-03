import Link from "next/link";
import {
  ChevronRight,
  House,
} from "lucide-react";

export default function PublicBreadcrumb({
  className,
  currentLabel,
  homeLabel = "Inicio",
  iconSize = 13,
}: {
  className: string;
  currentLabel: string;
  homeLabel?: string;
  iconSize?: number;
}) {
  return (
    <nav
      className={className}
      aria-label="Migas de pan"
    >
      <Link href="/">
        <House
          size={iconSize}
          aria-hidden="true"
        />
        {homeLabel}
      </Link>

      <ChevronRight
        size={iconSize}
        aria-hidden="true"
      />

      <span aria-current="page">
        {currentLabel}
      </span>
    </nav>
  );
}
