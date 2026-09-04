import Link from "next/link";
import {
  RefreshCcw,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";

import type { Game } from "@/types/game";

import GameDownloadEditor from "./GameDownloadEditor";
import GameEditorFormActions from "./GameEditorFormActions";

import adminStyles from "../../app/admin/admin.module.css";

export default function GameDistributionEditor({
  game,
  revision,
  action,
}: {
  game: Game;
  revision: number;
  action: string;
}) {
  const download = game.download;
  const sources = download?.sources ?? [];
  const available = sources.filter(
    (source) => source.enabled !== false && source.status !== "down"
  ).length;
  const down = sources.filter((source) => source.status === "down").length;
  const maintenance = sources.filter(
    (source) => source.status === "maintenance"
  ).length;
  const declaredPlatforms = game.platforms ?? [];
  const packagePlatform = download?.platform?.trim() || "";
  const platformMismatch = Boolean(
    packagePlatform &&
      declaredPlatforms.length > 0 &&
      !declaredPlatforms.includes(packagePlatform as never)
  );

  return (
    <section className={adminStyles.editorPanel}>
      <div className={adminStyles.sectionHeading}>
        <div>
          <span>DISTRIBUCIÓN</span>
          <h2>Descargas, mirrors y consistencia</h2>
        </div>
        <p>
          Mantiene la versión actual y sus fuentes. Las nuevas versiones se publican mediante una operación atómica separada.
        </p>
      </div>

      <div className={adminStyles.editorForm}>
        <div className={adminStyles.tableSummary}>
          <strong>Fuentes configuradas</strong>
          <span>{sources.length} · {available} visibles/no caídas</span>
        </div>
        <div className={adminStyles.tableSummary}>
          <strong>Estado declarado</strong>
          <span>{down} caídas · {maintenance} en mantenimiento</span>
        </div>
        <div className={adminStyles.tableSummary}>
          <strong>Plataforma del paquete</strong>
          <span>{packagePlatform || "Sin definir"}</span>
        </div>

        {platformMismatch ? (
          <div className={`${adminStyles.editorNotice} ${adminStyles.editorNoticeWarning} ${adminStyles.fieldWide}`}>
            <TriangleAlert size={17} aria-hidden="true" />
            La plataforma “{packagePlatform}” no está declarada en Compatibilidad. Corrige uno de los dos datos para evitar una ficha contradictoria.
          </div>
        ) : (
          <div className={`${adminStyles.editorNotice} ${adminStyles.editorNoticeSuccess} ${adminStyles.fieldWide}`}>
            <ShieldCheck size={17} aria-hidden="true" />
            No se detectaron contradicciones entre la plataforma del paquete y Compatibilidad.
          </div>
        )}

        {download?.href && (
          <div className={`${adminStyles.editorNotice} ${adminStyles.editorNoticeWarning} ${adminStyles.fieldWide}`}>
            Este borrador todavía conserva un enlace principal heredado. Las fuentes modernas pueden coexistir hasta completar la migración.
          </div>
        )}

        <div className={`${adminStyles.tableSummary} ${adminStyles.fieldWide}`}>
          <strong>Verificación de mirrors</strong>
          <span>
            El panel valida formato HTTPS y estados editoriales. No realiza solicitudes servidoras automáticas a URLs arbitrarias para evitar SSRF, redirecciones inseguras y falsos positivos de proveedores que bloquean HEAD.
          </span>
        </div>

        <div className={adminStyles.fieldWide}>
          <Link
            href={`/admin/juegos/${encodeURIComponent(game.slug)}/actualizacion`}
            className={adminStyles.tableAction}
          >
            <RefreshCcw size={15} aria-hidden="true" />
            Publicar nueva versión
          </Link>
        </div>
      </div>

      <form className={adminStyles.editorForm} method="post" action={action}>
        <input type="hidden" name="expectedRevision" value={revision} />

        <label>
          <span>Tamaño total (GB)</span>
          <input
            name="sizeGb"
            type="number"
            min="0.01"
            max="100000"
            step="0.01"
            defaultValue={download?.sizeGb ?? ""}
            placeholder="60"
          />
        </label>

        <label>
          <span>Cantidad de archivos</span>
          <input
            name="fileCount"
            type="number"
            min="1"
            max="10000"
            step="1"
            defaultValue={download?.fileCount ?? ""}
            placeholder="1"
          />
        </label>

        <label className={adminStyles.fieldWide}>
          <span>Plataforma / paquete</span>
          {declaredPlatforms.length ? (
            <select name="platform" defaultValue={packagePlatform}>
              <option value="">Sin definir</option>
              {platformMismatch && packagePlatform && (
                <option value={packagePlatform}>{packagePlatform} · no declarada</option>
              )}
              {declaredPlatforms.map((platform) => (
                <option key={platform} value={platform}>{platform}</option>
              ))}
            </select>
          ) : (
            <input
              name="platform"
              defaultValue={packagePlatform}
              maxLength={80}
              placeholder="Configura primero las plataformas en Compatibilidad"
            />
          )}
          <small>
            Cuando Compatibilidad tiene plataformas confirmadas, Distribución restringe el paquete a esa misma fuente de verdad.
          </small>
        </label>

        <GameDownloadEditor initialSources={sources} />

        <GameEditorFormActions
          note="Las URLs HTTP inseguras se rechazan y cada fuente conserva estado, visibilidad y orden editorial."
          action={action}
          continueTo="valoracion"
          saveLabel="Guardar distribución"
          continueLabel="Guardar y continuar a Valoración"
        />
      </form>
    </section>
  );
}
