"use client";

import Link from "next/link";
import {
  Bell,
  BellRing,
  Check,
  Cpu,
  Gamepad2,
  Heart,
  MonitorCog,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  type FormEvent,
  useState,
} from "react";

import styles from "./account-personalization.module.css";

type GameOption = {
  slug: string;
  title: string;
  category: string;
};

type Preference = {
  gameSlug: string;
  favorite: boolean;
  libraryState: "want_to_play" | "playing" | "completed" | null;
  followUpdates: boolean;
};

type HardwareSelection = {
  cpuId: string;
  gpuId: string;
  ramGb: number;
  memoryMode: "unknown" | "single" | "dual";
} | null;

type HardwareOption = {
  id: string;
  name: string;
};

type Notification = {
  id: string;
  gameSlug: string;
  gameTitle: string;
  version: string;
  summary: string;
  publishedAt: string;
};

type Recommendation = {
  slug: string;
  title: string;
  reasons: string[];
};

type ApiResult = {
  ok?: boolean;
  error?: string;
};

async function postForm(
  url: string,
  fields: Record<string, string>
) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
    },
    body: new URLSearchParams(fields).toString(),
    credentials: "same-origin",
  });

  return (await response.json()) as ApiResult;
}

function formatNotificationDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("es", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function PreferenceEditor({
  game,
  preference,
  onSaved,
}: {
  game: GameOption;
  preference: Preference;
  onSaved: () => void;
}) {
  const [favorite, setFavorite] = useState(preference.favorite);
  const [libraryState, setLibraryState] = useState(
    preference.libraryState ?? "none"
  );
  const [followUpdates, setFollowUpdates] = useState(
    preference.followUpdates
  );
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function save(next?: {
    favorite: boolean;
    libraryState: string;
    followUpdates: boolean;
  }) {
    setPending(true);
    setMessage(null);
    const values = next ?? {
      favorite,
      libraryState,
      followUpdates,
    };

    try {
      const data = await postForm("/api/account/games", {
        gameSlug: game.slug,
        favorite: String(values.favorite),
        libraryState: values.libraryState,
        followUpdates: String(values.followUpdates),
      });

      if (!data.ok) {
        setMessage("No se pudo guardar este juego.");
        return;
      }

      setFavorite(values.favorite);
      setLibraryState(values.libraryState);
      setFollowUpdates(values.followUpdates);
      setMessage("Guardado");
      onSaved();
    } catch {
      setMessage("No se pudo conectar con el servicio de cuentas.");
    } finally {
      setPending(false);
    }
  }

  return (
    <article className={styles.libraryItem}>
      <div className={styles.libraryTitle}>
        <div>
          <Link href={`/juegos/${game.slug}`}>{game.title}</Link>
          <span>{game.category}</span>
        </div>
        <button
          type="button"
          className={styles.iconButton}
          aria-pressed={favorite}
          aria-label={favorite ? "Quitar de favoritos" : "Agregar a favoritos"}
          title={favorite ? "Quitar de favoritos" : "Agregar a favoritos"}
          disabled={pending}
          onClick={() => save({
            favorite: !favorite,
            libraryState,
            followUpdates,
          })}
        >
          <Heart
            size={18}
            fill={favorite ? "currentColor" : "none"}
            aria-hidden="true"
          />
        </button>
      </div>

      <div className={styles.preferenceControls}>
        <label>
          Estado
          <select
            value={libraryState}
            disabled={pending}
            onChange={(event) => setLibraryState(event.target.value)}
          >
            <option value="none">Sin lista</option>
            <option value="want_to_play">Quiero jugarlo</option>
            <option value="playing">Lo estoy jugando</option>
            <option value="completed">Terminado</option>
          </select>
        </label>

        <label className={styles.checkControl}>
          <input
            type="checkbox"
            checked={followUpdates}
            disabled={pending}
            onChange={(event) => setFollowUpdates(event.target.checked)}
          />
          <Bell size={16} aria-hidden="true" />
          Avisarme de actualizaciones
        </label>
      </div>

      <div className={styles.libraryActions}>
        <button
          type="button"
          className={styles.secondaryButton}
          disabled={pending}
          onClick={() => save()}
        >
          <Save size={16} aria-hidden="true" />
          {pending ? "Guardando..." : "Guardar"}
        </button>
        <button
          type="button"
          className={styles.textDangerButton}
          disabled={pending}
          onClick={() => save({
            favorite: false,
            libraryState: "none",
            followUpdates: false,
          })}
        >
          <Trash2 size={15} aria-hidden="true" />
          Quitar de Mi DeUna
        </button>
        {message && <span className={styles.inlineStatus} role="status">{message}</span>}
      </div>
    </article>
  );
}

export default function AccountPersonalizationClient({
  games,
  preferences,
  hardware,
  cpus,
  gpus,
  notifications,
  recommendations,
}: {
  games: GameOption[];
  preferences: Preference[];
  hardware: HardwareSelection;
  cpus: HardwareOption[];
  gpus: HardwareOption[];
  notifications: Notification[];
  recommendations: Recommendation[];
}) {
  const router = useRouter();
  const [hardwarePending, setHardwarePending] = useState(false);
  const [hardwareMessage, setHardwareMessage] = useState<string | null>(null);
  const [notificationPending, setNotificationPending] = useState(false);
  const [addPending, setAddPending] = useState(false);
  const [addMessage, setAddMessage] = useState<string | null>(null);
  const gamesBySlug = new Map(games.map((game) => [game.slug, game]));
  const saved = preferences
    .map((preference) => ({
      preference,
      game: gamesBySlug.get(preference.gameSlug),
    }))
    .filter((entry): entry is { preference: Preference; game: GameOption } => Boolean(entry.game));

  async function handleHardware(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setHardwarePending(true);
    setHardwareMessage(null);
    const form = new FormData(event.currentTarget);

    try {
      const data = await postForm("/api/account/hardware", {
        intent: "save",
        cpuId: String(form.get("cpuId") ?? ""),
        gpuId: String(form.get("gpuId") ?? ""),
        ramGb: String(form.get("ramGb") ?? ""),
        memoryMode: String(form.get("memoryMode") ?? "unknown"),
      });

      if (!data.ok) {
        setHardwareMessage("Revisa CPU, GPU y RAM.");
        return;
      }

      setHardwareMessage("PC guardada. Tus recomendaciones ya pueden usarla.");
      router.refresh();
    } catch {
      setHardwareMessage("No se pudo conectar con el servicio de cuentas.");
    } finally {
      setHardwarePending(false);
    }
  }

  async function clearHardware() {
    setHardwarePending(true);
    setHardwareMessage(null);

    try {
      const data = await postForm("/api/account/hardware", {
        intent: "clear",
        cpuId: "",
        gpuId: "",
        ramGb: "",
        memoryMode: "unknown",
      });

      if (!data.ok) {
        setHardwareMessage("No se pudo quitar la PC guardada.");
        return;
      }

      setHardwareMessage("PC eliminada de tu cuenta.");
      router.refresh();
    } catch {
      setHardwareMessage("No se pudo conectar con el servicio de cuentas.");
    } finally {
      setHardwarePending(false);
    }
  }

  async function addGame(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setAddPending(true);
    setAddMessage(null);
    const form = new FormData(formElement);

    try {
      const data = await postForm("/api/account/games", {
        gameSlug: String(form.get("gameSlug") ?? ""),
        favorite: String(form.get("favorite") === "on"),
        libraryState: String(form.get("libraryState") ?? "none"),
        followUpdates: String(form.get("followUpdates") === "on"),
      });

      if (!data.ok) {
        setAddMessage("No se pudo agregar el juego.");
        return;
      }

      setAddMessage("Juego agregado a Mi DeUna.");
      formElement.reset();
      router.refresh();
    } catch {
      setAddMessage("No se pudo conectar con el servicio de cuentas.");
    } finally {
      setAddPending(false);
    }
  }

  async function markNotificationsSeen() {
    setNotificationPending(true);

    try {
      const data = await postForm("/api/account/notifications/seen", {
        intent: "seen",
      });

      if (data.ok) {
        router.refresh();
      }
    } finally {
      setNotificationPending(false);
    }
  }

  return (
    <section className={styles.personalizationArea} aria-labelledby="mi-deuna-title">
      <div className={styles.personalizationIntro}>
        <span className={styles.eyebrow}>TU EXPERIENCIA</span>
        <h2 id="mi-deuna-title">Mi DeUna</h2>
        <p>
          Reúne tus juegos, tu PC y tus avisos en un solo lugar. DeUna adapta las recomendaciones con lo que tú decides guardar, no con tu historial de navegación.
        </p>
      </div>

      <div className={styles.personalizationGrid}>
        <section className={styles.dashboardPanel} aria-labelledby="account-notifications-title">
          <div className={styles.dashboardHeading}>
            <div>
              <BellRing size={20} aria-hidden="true" />
              <h3 id="account-notifications-title">Avisos de tus juegos</h3>
            </div>
            <span className={styles.counterBadge}>{notifications.length}</span>
          </div>

          {notifications.length > 0 ? (
            <>
              <div className={styles.notificationList}>
                {notifications.slice(0, 8).map((notification) => (
                  <Link
                    key={notification.id}
                    href={`/juegos/${notification.gameSlug}#versions`}
                    className={styles.notificationItem}
                  >
                    <strong>{notification.gameTitle} · {notification.version}</strong>
                    <span>{notification.summary}</span>
                    <time dateTime={notification.publishedAt}>
                      {formatNotificationDate(notification.publishedAt)}
                    </time>
                  </Link>
                ))}
              </div>
              <button
                type="button"
                className={styles.secondaryButton}
                disabled={notificationPending}
                onClick={markNotificationsSeen}
              >
                <Check size={16} aria-hidden="true" />
                {notificationPending ? "Actualizando..." : "Marcar como vistos"}
              </button>
            </>
          ) : (
            <p className={styles.emptyState}>
              No hay avisos nuevos. Sigue un juego para que sus próximas actualizaciones aparezcan aquí.
            </p>
          )}
        </section>

        <section id="mi-pc" className={styles.dashboardPanel} aria-labelledby="account-hardware-title">
          <div className={styles.dashboardHeading}>
            <div>
              <MonitorCog size={20} aria-hidden="true" />
              <h3 id="account-hardware-title">Mi PC</h3>
            </div>
            {hardware && <span className={styles.successBadge}>Guardada</span>}
          </div>

          <p className={styles.panelCopy}>
            Sólo guardamos los componentes que eliges. Se usan en el mismo motor de FPS de DeUna para ordenar juegos compatibles.
          </p>

          <form className={styles.hardwareForm} onSubmit={handleHardware}>
            <label>
              Procesador
              <select name="cpuId" defaultValue={hardware?.cpuId ?? ""} required>
                <option value="" disabled>Elige tu CPU</option>
                {cpus.map((cpu) => (
                  <option key={cpu.id} value={cpu.id}>{cpu.name}</option>
                ))}
              </select>
            </label>

            <label>
              Gráfica
              <select name="gpuId" defaultValue={hardware?.gpuId ?? ""} required>
                <option value="" disabled>Elige tu GPU</option>
                {gpus.map((gpu) => (
                  <option key={gpu.id} value={gpu.id}>{gpu.name}</option>
                ))}
              </select>
            </label>

            <label>
              RAM (GB)
              <input
                name="ramGb"
                type="number"
                min="1"
                max="256"
                step="0.5"
                defaultValue={hardware?.ramGb ?? 16}
                required
              />
            </label>

            <label>
              Memoria
              <select name="memoryMode" defaultValue={hardware?.memoryMode ?? "unknown"}>
                <option value="unknown">No sé / no importa</option>
                <option value="single">Single channel</option>
                <option value="dual">Dual channel</option>
              </select>
            </label>

            <div className={styles.dashboardActions}>
              <button type="submit" className={styles.primaryButton} disabled={hardwarePending}>
                <Cpu size={16} aria-hidden="true" />
                {hardwarePending ? "Guardando..." : "Guardar Mi PC"}
              </button>
              {hardware && (
                <button type="button" className={styles.secondaryButton} disabled={hardwarePending} onClick={clearHardware}>
                  <Trash2 size={16} aria-hidden="true" />
                  Quitar PC guardada
                </button>
              )}
            </div>
            {hardwareMessage && <p className={styles.inlineStatus} role="status">{hardwareMessage}</p>}
          </form>
        </section>
      </div>

      <section className={styles.dashboardPanel} aria-labelledby="account-library-title">
        <div className={styles.dashboardHeading}>
          <div>
            <Gamepad2 size={20} aria-hidden="true" />
            <h3 id="account-library-title">Mis juegos</h3>
          </div>
          <span className={styles.counterBadge}>{saved.length}</span>
        </div>

        <form className={styles.addGameForm} onSubmit={addGame}>
          <label>
            Juego
            <select name="gameSlug" defaultValue="" required>
              <option value="" disabled>Elige un juego</option>
              {games.map((game) => (
                <option key={game.slug} value={game.slug}>{game.title}</option>
              ))}
            </select>
          </label>
          <label>
            Estado
            <select name="libraryState" defaultValue="want_to_play">
              <option value="none">Sin lista</option>
              <option value="want_to_play">Quiero jugarlo</option>
              <option value="playing">Lo estoy jugando</option>
              <option value="completed">Terminado</option>
            </select>
          </label>
          <label className={styles.checkControl}>
            <input name="favorite" type="checkbox" />
            <Heart size={16} aria-hidden="true" /> Favorito
          </label>
          <label className={styles.checkControl}>
            <input name="followUpdates" type="checkbox" />
            <Bell size={16} aria-hidden="true" /> Seguir actualizaciones
          </label>
          <button type="submit" className={styles.primaryButton} disabled={addPending}>
            <Gamepad2 size={16} aria-hidden="true" />
            {addPending ? "Agregando..." : "Agregar"}
          </button>
          {addMessage && <span className={styles.inlineStatus} role="status">{addMessage}</span>}
        </form>

        {saved.length > 0 ? (
          <div className={styles.libraryList}>
            {saved.map(({ game, preference }) => (
              <PreferenceEditor
                key={game.slug}
                game={game}
                preference={preference}
                onSaved={() => router.refresh()}
              />
            ))}
          </div>
        ) : (
          <p className={styles.emptyState}>
            Todavía no has guardado juegos. Tus favoritos y estados sirven como señales explícitas para recomendarte otros títulos parecidos.
          </p>
        )}
      </section>

      <section className={styles.dashboardPanel} aria-labelledby="account-recommendations-title">
        <div className={styles.dashboardHeading}>
          <div>
            <Sparkles size={20} aria-hidden="true" />
            <h3 id="account-recommendations-title">Recomendados para ti</h3>
          </div>
        </div>

        {recommendations.length > 0 ? (
          <div className={styles.recommendationList}>
            {recommendations.map((recommendation) => (
              <Link
                key={recommendation.slug}
                href={`/juegos/${recommendation.slug}`}
                className={styles.recommendationItem}
              >
                <strong>{recommendation.title}</strong>
                <span>{recommendation.reasons.join(" · ")}</span>
              </Link>
            ))}
          </div>
        ) : (
          <p className={styles.emptyState}>
            Guarda al menos un juego o tu PC para activar recomendaciones personales. La navegación por sí sola no cuenta como señal.
          </p>
        )}
      </section>
    </section>
  );
}
