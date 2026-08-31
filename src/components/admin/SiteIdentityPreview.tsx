import type { CSSProperties } from "react";
import { CheckCircle2 } from "lucide-react";

import SiteLogoMark from "@/components/brand/SiteLogoMark";
import { safeThemeBackground } from "@/lib/site/brand-foreground";

import styles from "./SiteIdentityPreview.module.css";

type SiteIdentityPreviewProps = {
  name: string;
  shortName: string;
  description: string;
  footerTagline: string;
  themeColor: string;
  brandColor: string;
};

export default function SiteIdentityPreview({
  name,
  shortName,
  description,
  footerTagline,
  themeColor,
  brandColor,
}: SiteIdentityPreviewProps) {
  const appliedThemeColor = safeThemeBackground(themeColor);
  const previewStyle = {
    "--preview-bg": appliedThemeColor,
    "--preview-brand": brandColor,
  } as CSSProperties;
  const compactName = shortName.trim() || name;
  const backgroundWasAdapted =
    appliedThemeColor.toLowerCase() !== themeColor.toLowerCase();

  return (
    <div className={styles.stack}>
      <section className={styles.panel} aria-labelledby="identity-preview-title">
        <div className={styles.panelHeading}>
          <span>VISTA PREVIA</span>
          <h2 id="identity-preview-title">Identidad del borrador</h2>
          <p>Representación compacta de la marca que compartirán la cabecera, el pie público y el panel administrativo al publicar.</p>
        </div>

        <div className={styles.preview} style={previewStyle}>
          <div className={styles.previewHeader}>
            <div className={styles.previewBrand} title={name}>
              <SiteLogoMark size={20} />
              <strong>{compactName}</strong>
            </div>
            <div className={styles.previewNav} aria-hidden="true">
              <span>Inicio</span>
              <span>Juegos</span>
              <span>Actualizaciones</span>
            </div>
          </div>
          <p>{description}</p>
          <div className={styles.previewFooter}>
            <small>{footerTagline}</small>
            <div className={styles.previewBrand} title={name}>
              <SiteLogoMark size={18} />
              <strong>{compactName}</strong>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.panel} aria-labelledby="appearance-summary-title">
        <div className={styles.panelHeading}>
          <span>PALETA</span>
          <h2 id="appearance-summary-title">Apariencia aplicada</h2>
        </div>
        <dl className={styles.colorList}>
          <div>
            <dt>Fondo y navegador</dt>
            <dd title={backgroundWasAdapted ? "El tono elegido se oscurece automáticamente para mantener contraste seguro." : undefined}>
              <i style={{ background: appliedThemeColor }} />
              <code>
                {backgroundWasAdapted
                  ? `${themeColor} → ${appliedThemeColor}`
                  : themeColor}
              </code>
            </dd>
          </div>
          <div>
            <dt>Color de marca</dt>
            <dd>
              <i style={{ background: brandColor }} />
              <code>{brandColor}</code>
            </dd>
          </div>
        </dl>
        <p className={styles.appearanceHint}>
          La marca adapta automáticamente el texto de los botones; un fondo demasiado claro conserva su tono y se oscurece hasta mantener contraste seguro.
        </p>
        <div className={styles.activeState}>
          <CheckCircle2 size={15} aria-hidden="true" />
          El borrador queda separado de la versión pública
        </div>
      </section>
    </div>
  );
}
