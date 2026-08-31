import type { CSSProperties } from "react";
import { CheckCircle2 } from "lucide-react";

import SiteLogoMark from "@/components/brand/SiteLogoMark";

import styles from "./SiteIdentityPreview.module.css";

type SiteIdentityPreviewProps = {
  name: string;
  description: string;
  footerTagline: string;
  themeColor: string;
  brandColor: string;
};

export default function SiteIdentityPreview({
  name,
  description,
  footerTagline,
  themeColor,
  brandColor,
}: SiteIdentityPreviewProps) {
  const previewStyle = {
    "--preview-bg": themeColor,
    "--preview-brand": brandColor,
  } as CSSProperties;

  return (
    <div className={styles.stack}>
      <section className={styles.panel} aria-labelledby="identity-preview-title">
        <div className={styles.panelHeading}>
          <span>VISTA PREVIA</span>
          <h2 id="identity-preview-title">Identidad del borrador</h2>
          <p>Representación compacta de la cabecera, portada y pie públicos.</p>
        </div>

        <div className={styles.preview} style={previewStyle}>
          <div className={styles.previewHeader}>
            <div className={styles.previewBrand}>
              <SiteLogoMark size={20} />
              <strong>{name}</strong>
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
            <div className={styles.previewBrand}>
              <SiteLogoMark size={18} />
              <strong>{name}</strong>
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
            <dd>
              <i style={{ background: themeColor }} />
              <code>{themeColor}</code>
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
          El color de marca unifica botones, enlaces, foco, barra contextual y marca pública.
        </p>
        <div className={styles.activeState}>
          <CheckCircle2 size={15} aria-hidden="true" />
          El borrador queda separado de la versión pública
        </div>
      </section>
    </div>
  );
}
