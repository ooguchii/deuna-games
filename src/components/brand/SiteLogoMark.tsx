import { Gamepad2 } from "lucide-react";

type SiteLogoMarkProps = {
  size?: number;
  strokeWidth?: number;
  className?: string;
};

/** Símbolo gráfico compartido por la web pública y el panel. */
export default function SiteLogoMark({
  size = 26,
  strokeWidth = 2,
  className,
}: SiteLogoMarkProps) {
  return (
    <Gamepad2
      size={size}
      strokeWidth={strokeWidth}
      className={className}
      aria-hidden="true"
    />
  );
}
