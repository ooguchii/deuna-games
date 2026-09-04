import {
  BarChart3,
  RefreshCcw,
  Sparkles,
  Star,
  UsersRound,
} from "lucide-react";

import {
  getGameInsights,
} from "@/lib/admin/game-insights";

import GameEditorFormActions from "./GameEditorFormActions";

import adminStyles from "../../app/admin/admin.module.css";

function confidenceLabel(value: "low" | "medium" | "high") {
  if (value === "high") return "Alta";
  if (value === "medium") return "Media";
  return "Baja";
}

function scoreLabel(value: number | null) {
  return value === null ? "Sin datos" : `${value.toFixed(1)} / 100`;
}

export default async function GameValuationEditor({
  slug,
  revision,
  editorialRating,
  legacyReviews,
  action,
}: {
  slug: string;
  revision: number;
  editorialRating?: number;
  legacyReviews?: string;
  action: string;
}) {
  const insights = await getGameInsights(slug);
  const suggestedRating = Math.max(
    0,
    Math.min(5, insights.index.score / 20)
  ).toFixed(2);

  return (
    <section className={adminStyles.editorPanel}>
      <div className={adminStyles.sectionHeading}>
        <div>
          <span>VALORACIÓN</span>
          <h2>Editorial, comunidad e Índice DeUna</h2>
        </div>
        <p>
          Tres señales separadas: la valoración editorial se decide manualmente, la comunidad proviene de votos reales y el Índice DeUna resume comportamiento autenticado sin convertir popularidad en estrellas.
        </p>
      </div>

      {!insights.migrationReady && (
        <div className={`${adminStyles.editorNotice} ${adminStyles.editorNoticeWarning}`}>
          La migración 012 todavía no está aplicada en esta base. Las señales existentes de Mi DeUna pueden analizarse, pero los votos reales y snapshots del Índice se activarán al ejecutar la migración.
        </div>
      )}

      <div className={adminStyles.editorForm}>
        <div className={adminStyles.tableSummary}>
          <strong><Star size={15} aria-hidden="true" /> Valoración editorial</strong>
          <span>{editorialRating !== undefined ? `${editorialRating.toFixed(2)} / 5` : "Sin definir"}</span>
        </div>
        <div className={adminStyles.tableSummary}>
          <strong><UsersRound size={15} aria-hidden="true" /> Comunidad</strong>
          <span>
            {insights.community.average !== null
              ? `${insights.community.average.toFixed(1)} / 5 · ${insights.community.count} votos reales`
              : "Todavía sin votos reales"}
          </span>
        </div>
        <div className={adminStyles.tableSummary}>
          <strong><Sparkles size={15} aria-hidden="true" /> Índice DeUna</strong>
          <span>
            {insights.index.score.toFixed(1)} / 100 · Confianza {confidenceLabel(insights.index.confidence)} · {insights.index.evidenceCount} evidencias
          </span>
        </div>

        <div className={adminStyles.tableSummary}>
          <strong>Interés</strong>
          <span>{scoreLabel(insights.index.breakdown.interest)} · favoritos, quiero jugar y seguimiento</span>
        </div>
        <div className={adminStyles.tableSummary}>
          <strong>Engagement</strong>
          <span>{scoreLabel(insights.index.breakdown.engagement)} · jugando y completado</span>
        </div>
        <div className={adminStyles.tableSummary}>
          <strong>Satisfacción</strong>
          <span>{scoreLabel(insights.index.breakdown.satisfaction)} · votos reales; mientras no existan, finalización como señal provisional</span>
        </div>

        <div className={`${adminStyles.tableSummary} ${adminStyles.fieldWide}`}>
          <strong>Señales de cuenta</strong>
          <span>
            {insights.preferences.users} usuarios · {insights.preferences.favorites} favoritos · {insights.preferences.wantToPlay} quieren jugar · {insights.preferences.playing} jugando · {insights.preferences.completed} completados · {insights.preferences.followers} siguen actualizaciones
          </span>
        </div>

        {legacyReviews && (
          <div className={`${adminStyles.editorNotice} ${adminStyles.editorNoticeWarning} ${adminStyles.fieldWide}`}>
            El dato histórico “{legacyReviews} valoraciones” se conserva en el payload para compatibilidad, pero ya no se edita ni se considera un conteo real de usuarios.
          </div>
        )}

        {insights.stored && (
          <div className={`${adminStyles.tableSummary} ${adminStyles.fieldWide}`}>
            <strong>Último snapshot confirmado</strong>
            <span>
              {insights.stored.score.toFixed(1)} / 100 · Confianza {confidenceLabel(insights.stored.confidence)} · {new Intl.DateTimeFormat("es-AR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "America/Argentina/Buenos_Aires",
              }).format(insights.stored.calculatedAt)}
            </span>
          </div>
        )}
      </div>

      <form className={adminStyles.editorForm} method="post" action={action}>
        <input type="hidden" name="expectedRevision" value={revision} />
        <label className={adminStyles.fieldWide}>
          <span>Valoración editorial (0–5)</span>
          <input
            name="rating"
            type="number"
            min="0"
            max="5"
            step="0.01"
            defaultValue={editorialRating ?? ""}
          />
          <small>
            Es una decisión editorial. Ni los votos de usuarios ni el Índice DeUna la sobrescriben automáticamente.
          </small>
        </label>

        <GameEditorFormActions
          note="Guardar conserva la decisión editorial como una revisión independiente."
          action={action}
          continueTo="publicacion"
          saveLabel="Guardar valoración editorial"
          continueLabel="Guardar y revisar Publicación"
        />
      </form>

      <div className={adminStyles.formActions}>
        <p>
          El Índice se recalcula desde señales agregadas de cuentas. DeUna mantiene activa su política de no registrar IP, ubicación, huellas ni navegación anónima.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <form
            method="post"
            action={`/api/admin/content/games/${encodeURIComponent(slug)}/insights/recalculate`}
          >
            <input type="hidden" name="expectedRevision" value={revision} />
            <button type="submit" disabled={!insights.migrationReady}>
              <RefreshCcw size={15} aria-hidden="true" />
              Recalcular estadísticas
            </button>
          </form>

          <form method="post" action={action}>
            <input type="hidden" name="expectedRevision" value={revision} />
            <input type="hidden" name="rating" value={suggestedRating} />
            <button
              type="submit"
              disabled={insights.index.evidenceCount === 0}
              title="Copia el Índice DeUna a la escala editorial 0–5; la acción es explícita y reversible desde Historial"
            >
              <BarChart3 size={15} aria-hidden="true" />
              Usar sugerencia {suggestedRating}/5
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
