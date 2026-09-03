"use client";

import {
  type CSSProperties,
  useMemo,
  useState,
} from "react";
import {
  ImageIcon,
  Palette,
} from "lucide-react";

import {
  brandForeground,
  safeThemeBackground,
} from "@/lib/site/brand-foreground";
import type {
  SiteBackgroundAsset,
  SiteBackgroundMap,
} from "@/lib/site/backgrounds";

import adminStyles from "../../app/admin/admin.module.css";
import SiteBackgroundManager from "./SiteBackgroundManager";
import styles from "./SiteAppearanceWorkspace.module.css";

export type AppearancePanel =
  | "palette"
  | "backgrounds";

type SiteAppearanceWorkspaceProps = {
  revision: number;
  initialPanel?: AppearancePanel;
  name: string;
  shortName: string;
  description: string;
  footerTagline: string;
  language: "es";
  themeColor: string;
  brandColor: string;
  customAssets?: SiteBackgroundAsset[];
  pageBackgrounds?: SiteBackgroundMap;
};

const panels: ReadonlyArray<{
  id: AppearancePanel;
  label: string;
  description: string;
  icon: typeof Palette;
}> = [
  {
    id: "palette",
    label: "Marca y color",
    description: "Colores globales",
    icon: Palette,
  },
  {
    id: "backgrounds",
    label: "Fondos",
    description: "Imágenes por página",
    icon: ImageIcon,
  },
];

export default function SiteAppearanceWorkspace({
  revision,
  initialPanel = "palette",
  name,
  shortName,
  description,
  footerTagline,
  language,
  themeColor: initialThemeColor,
  brandColor: initialBrandColor,
  customAssets = [],
  pageBackgrounds = {},
}: SiteAppearanceWorkspaceProps) {
  const [activePanel, setActivePanel] =
    useState<AppearancePanel>(initialPanel);
  const [themeColor, setThemeColor] =
    useState(initialThemeColor);
  const [brandColor, setBrandColor] =
    useState(initialBrandColor);

  const safeBackground = useMemo(
    () => safeThemeBackground(themeColor),
    [themeColor]
  );
  const onBrand = useMemo(
    () => brandForeground(brandColor),
    [brandColor]
  );
  const themeWasAdapted =
    safeBackground.toLowerCase() !== themeColor.toLowerCase();
  const previewStyle = {
    "--appearance-preview-bg": safeBackground,
    "--appearance-preview-brand": brandColor,
    "--appearance-preview-on-brand": onBrand,
  } as CSSProperties;

  return (
    <div className={styles.workspace}>
      <nav
        className={styles.tabs}
        role="tablist"
        aria-label="Herramientas de apariencia"
      >
        {panels.map((panel) => {
          const Icon = panel.icon;
          const selected = activePanel === panel.id;

          return (
            <button
              key={panel.id}
              type="button"
              role="tab"
              id={`appearance-tab-${panel.id}`}
              aria-selected={selected}
              aria-controls={`appearance-panel-${panel.id}`}
              className={selected ? styles.tabActive : undefined}
              onClick={() => setActivePanel(panel.id)}
            >
              <span className={styles.tabIcon} aria-hidden="true">
                <Icon size={17} strokeWidth={1.9} />
              </span>
              <span className={styles.tabCopy}>
                <strong>{panel.label}</strong>
                <small>{panel.description}</small>
              </span>
            </button>
          );
        })}
      </nav>

      <section
        id="appearance-panel-palette"
        role="tabpanel"
        aria-labelledby="appearance-tab-palette"
        hidden={activePanel !== "palette"}
        className={`${adminStyles.editorPanel} ${styles.palettePanel}`}
      >
        <div className={styles.panelHeading}>
          <span>MARCA Y COLOR</span>
          <h2>Paleta global del sitio</h2>
          <p>
            Aquí cambias los colores generales. Las imágenes de fondo se administran por separado en la pestaña Fondos.
          </p>
        </div>

        <div className={styles.paletteLayout}>
          <form
            className={adminStyles.editorForm}
            method="post"
            action="/api/admin/content/configuration?seccion=apariencia"
          >
            <input
              type="hidden"
              name="expectedRevision"
              value={revision}
            />
            <input type="hidden" name="name" value={name} />
            <input
              type="hidden"
              name="shortName"
              value={shortName}
            />
            <input
              type="hidden"
              name="description"
              value={description}
            />
            <input
              type="hidden"
              name="footerTagline"
              value={footerTagline}
            />
            <input
              type="hidden"
              name="language"
              value={language}
            />

            <div className={`${styles.colorFields} ${adminStyles.fieldWide}`}>
              <label className={styles.colorField}>
                <span className={styles.colorText}>
                  <strong>Fondo y navegador</strong>
                  <small>
                    Base oscura de páginas, cabecera y superficies globales.
                  </small>
                  <code>{themeColor}</code>
                </span>
                <input
                  type="color"
                  name="themeColor"
                  value={themeColor}
                  aria-label="Color de fondo y navegador"
                  onChange={(event) =>
                    setThemeColor(event.target.value)
                  }
                  required
                />
              </label>

              <label className={styles.colorField}>
                <span className={styles.colorText}>
                  <strong>Color de marca</strong>
                  <small>
                    Logo, botones, enlaces, estados activos y acentos.
                  </small>
                  <code>{brandColor}</code>
                </span>
                <input
                  type="color"
                  name="brandColor"
                  value={brandColor}
                  aria-label="Color de marca"
                  onChange={(event) =>
                    setBrandColor(event.target.value)
                  }
                  required
                />
              </label>
            </div>

            <div className={adminStyles.formActions}>
              <p>
                Guardar actualiza el borrador. El sitio público conserva la versión publicada hasta que uses Publicación.
              </p>
              <button type="submit">Guardar colores</button>
            </div>
          </form>

          <aside
            className={styles.palettePreview}
            style={previewStyle}
            aria-label="Vista previa de la paleta"
          >
            <div className={styles.previewTopbar}>
              <strong>{shortName.trim() || name}</strong>
              <span />
              <span />
              <span />
            </div>

            <div className={styles.previewBody}>
              <span className={styles.previewEyebrow}>VISTA PREVIA</span>
              <strong>Así se combinarán los colores</strong>
              <p>
                Los fondos de cada página se eligen y ajustan desde su editor específico.
              </p>
              <button type="button" tabIndex={-1}>
                Acción principal
              </button>
            </div>

            <div className={styles.previewStatus}>
              <span>
                Fondo aplicado
                <code>{safeBackground}</code>
              </span>
              <span>
                Marca
                <code>{brandColor}</code>
              </span>
            </div>

            {themeWasAdapted && (
              <p className={styles.contrastNotice}>
                El tono {themeColor} se oscurece automáticamente a {safeBackground} para mantener contraste legible.
              </p>
            )}
          </aside>
        </div>
      </section>

      <div
        id="appearance-panel-backgrounds"
        role="tabpanel"
        aria-labelledby="appearance-tab-backgrounds"
        hidden={activePanel !== "backgrounds"}
      >
        <SiteBackgroundManager
          revision={revision}
          brandColor={initialBrandColor}
          customAssets={customAssets}
          pageBackgrounds={pageBackgrounds}
        />
      </div>
    </div>
  );
}
