import type { Game } from "@/types/game";
import type { GameTaxonomyTerm } from "@/types/game-taxonomy";

import GameEditorFormActions from "./GameEditorFormActions";
import GameTaxonomyMultiSelect from "./GameTaxonomyMultiSelect";

import adminStyles from "../../app/admin/admin.module.css";

export default function GameClassificationEditor({
  game,
  revision,
  action,
  classificationTerms,
  tagTerms,
}: {
  game: Game;
  revision: number;
  action: string;
  classificationTerms: GameTaxonomyTerm[];
  tagTerms: GameTaxonomyTerm[];
}) {
  return (
    <section className={adminStyles.editorPanel}>
      <div className={adminStyles.sectionHeading}>
        <div>
          <span>CLASIFICACIÓN</span>
          <h2>Clasificación y descubrimiento</h2>
        </div>
        <p>
          La clasificación principal, las adicionales y las etiquetas comparten los catálogos maestros. Plataformas y requisitos pertenecen a Compatibilidad.
        </p>
      </div>

      <form className={adminStyles.editorForm} method="post" action={action}>
        <input type="hidden" name="expectedRevision" value={revision} />

        <label className={adminStyles.fieldWide}>
          <span>Clasificación principal</span>
          <select name="category" defaultValue={game.category} required>
            {classificationTerms.map((term) => (
              <option key={term.key} value={term.label}>
                {term.label}{term.active ? "" : " · Inactiva"}
              </option>
            ))}
          </select>
          <small>
            Define la clasificación primaria mostrada y utilizada por filtros. No se duplica dentro de las adicionales.
          </small>
        </label>

        <GameTaxonomyMultiSelect
          name="genresText"
          label="Clasificaciones adicionales"
          terms={classificationTerms}
          initialValues={game.genres ?? []}
          maximum={20}
        />

        <GameTaxonomyMultiSelect
          name="tagsText"
          label="Etiquetas"
          terms={tagTerms}
          initialValues={game.tags ?? []}
          maximum={30}
        />

        <GameEditorFormActions
          note="Los términos inactivos ya utilizados se conservan por compatibilidad, pero no pueden volver a añadirse."
          action={action}
          continueTo="requisitos"
          saveLabel="Guardar clasificación"
          continueLabel="Guardar y continuar a Compatibilidad"
        />
      </form>
    </section>
  );
}
