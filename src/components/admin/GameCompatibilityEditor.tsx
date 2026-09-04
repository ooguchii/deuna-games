import type {
  Game,
  GameHardwareRequirements,
} from "@/types/game";

import GameEditorFormActions from "./GameEditorFormActions";
import GamePlatformEditor from "./GamePlatformEditor";

import adminStyles from "../../app/admin/admin.module.css";

function legacyMinimum(
  requirements: GameHardwareRequirements | undefined
) {
  if (!requirements) return undefined;
  const minimum: GameHardwareRequirements = {
    system: requirements.system,
    processor: requirements.processor,
    ram: requirements.ram,
    graphics: requirements.graphics,
    storage: requirements.storage,
  };
  return Object.values(minimum).some(Boolean) ? minimum : undefined;
}

export default function GameCompatibilityEditor({
  game,
  revision,
  action,
}: {
  game: Game;
  revision: number;
  action: string;
}) {
  const requirements = game.requirements;
  const minimum = requirements?.minimum ?? legacyMinimum(requirements);
  const recommended = requirements?.recommended;

  return (
    <section className={adminStyles.editorPanel}>
      <div className={adminStyles.sectionHeading}>
        <div>
          <span>COMPATIBILIDAD</span>
          <h2>Plataformas y requisitos</h2>
        </div>
        <p>
          Confirma dónde funciona el juego y, para PC, registra mínimos y recomendados. Una lista de plataformas vacía significa “sin confirmar”, no “PC”.
        </p>
      </div>

      <form className={adminStyles.editorForm} method="post" action={action}>
        <input type="hidden" name="expectedRevision" value={revision} />

        <div className={adminStyles.fieldWide}>
          <GamePlatformEditor initialPlatforms={game.platforms ?? []} />
        </div>

        <div className={`${adminStyles.tableSummary} ${adminStyles.fieldWide}`}>
          <strong>Requisitos mínimos · PC</strong>
          <span>Equipo base para ejecutar el juego. Déjalo vacío si todavía no hay requisitos confirmados.</span>
        </div>

        <label>
          <span>Sistema operativo</span>
          <input
            name="minimumSystem"
            defaultValue={minimum?.system ?? ""}
            maxLength={240}
            placeholder="Windows 10 de 64 bits"
          />
        </label>
        <label>
          <span>Procesador</span>
          <input name="minimumProcessor" defaultValue={minimum?.processor ?? ""} maxLength={240} />
        </label>
        <label>
          <span>Memoria RAM</span>
          <input name="minimumRam" defaultValue={minimum?.ram ?? ""} maxLength={240} placeholder="12 GB" />
        </label>
        <label>
          <span>Gráficos</span>
          <input name="minimumGraphics" defaultValue={minimum?.graphics ?? ""} maxLength={240} />
        </label>
        <label className={adminStyles.fieldWide}>
          <span>Almacenamiento</span>
          <input name="minimumStorage" defaultValue={minimum?.storage ?? ""} maxLength={240} placeholder="60 GB" />
        </label>

        <div className={`${adminStyles.tableSummary} ${adminStyles.fieldWide}`}>
          <strong>Requisitos recomendados · PC</strong>
          <span>Configuración sugerida para una experiencia mejor.</span>
        </div>

        <label>
          <span>Sistema operativo</span>
          <input name="recommendedSystem" defaultValue={recommended?.system ?? ""} maxLength={240} />
        </label>
        <label>
          <span>Procesador</span>
          <input name="recommendedProcessor" defaultValue={recommended?.processor ?? ""} maxLength={240} />
        </label>
        <label>
          <span>Memoria RAM</span>
          <input name="recommendedRam" defaultValue={recommended?.ram ?? ""} maxLength={240} />
        </label>
        <label>
          <span>Gráficos</span>
          <input name="recommendedGraphics" defaultValue={recommended?.graphics ?? ""} maxLength={240} />
        </label>
        <label className={adminStyles.fieldWide}>
          <span>Almacenamiento</span>
          <input name="recommendedStorage" defaultValue={recommended?.storage ?? ""} maxLength={240} />
        </label>

        <GameEditorFormActions
          note="Plataformas y requisitos se guardan juntos para que Compatibilidad sea la única fuente editorial de estos datos."
          action={action}
          continueTo="rendimiento"
          saveLabel="Guardar compatibilidad"
          continueLabel="Guardar y continuar a Rendimiento"
        />
      </form>
    </section>
  );
}
