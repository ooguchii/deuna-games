"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Bell,
  BellRing,
  Check,
  CircleUserRound,
  Compass,
  Cpu,
  Gamepad2,
  Gauge,
  Gift,
  Heart,
  LibraryBig,
  LogOut,
  MonitorCog,
  Save,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  UserRound,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  type CSSProperties,
  type FormEvent,
  useMemo,
  useState,
} from "react";

import SiteBrand from "@/components/layout/SiteBrand";
import GameMedia from "@/components/ui/GameMedia";
import type { GameImageViewport } from "@/types/game";

import {
  AccountRewardSummary,
  AccountRewardsView,
  type AccountRewardsSnapshot,
} from "./AccountRewardsPanel";
import styles from "./account-dashboard.module.css";

type DashboardView =
  | "overview"
  | "rewards"
  | "games"
  | "pc"
  | "alerts"
  | "discover"
  | "profile"
  | "settings";

type Profile = {
  username: string;
  displayName: string | null;
  email: string | null;
  bio: string | null;
  createdAt: string;
};

type GameOption = {
  slug: string;
  title: string;
  category: string;
  coverImage?: string;
  imageViewport?: GameImageViewport;
  rating?: number;
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
  gameCoverImage?: string;
  gameImageViewport?: GameImageViewport;
  version: string;
  summary: string;
  publishedAt: string;
};

type Recommendation = {
  slug: string;
  title: string;
  category: string;
  coverImage?: string;
  imageViewport?: GameImageViewport;
  rating?: number;
  reasons: string[];
  compatibilityPercent: number | null;
};

type ApiResult = {
  ok?: boolean;
  error?: string;
};

type DashboardProps = {
  siteName: string;
  profile: Profile;
  games: GameOption[];
  preferences: Preference[];
  hardware: HardwareSelection;
  cpus: HardwareOption[];
  gpus: HardwareOption[];
  notifications: Notification[];
  recommendations: Recommendation[];
  compatibilityPercent: number | null;
  compatibilityLabel: string;
  rewards: AccountRewardsSnapshot;
};

const libraryLabels: Record<NonNullable<Preference["libraryState"]>, string> = {
  want_to_play: "Quiero jugarlo",
  playing: "Lo estoy jugando",
  completed: "Terminado",
};

const memoryLabels: Record<NonNullable<HardwareSelection>["memoryMode"], string> = {
  unknown: "No especificada",
  single: "Single channel",
  dual: "Dual channel",
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

function formatAlertDate(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;

  return new Intl.DateTimeFormat("es", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function preferenceStatus(preference: Preference) {
  if (preference.libraryState) {
    return libraryLabels[preference.libraryState];
  }
  if (preference.favorite) return "Favorito";
  if (preference.followUpdates) return "Siguiendo actualizaciones";
  return "Guardado";
}

function DashboardGameRow({
  game,
  preference,
}: {
  game: GameOption;
  preference: Preference;
}) {
  return (
    <Link href={`/juegos/${game.slug}`} className={styles.compactGameRow}>
      <div className={styles.compactCover}>
        <GameMedia
          src={game.coverImage}
          alt=""
          sizes="64px"
          viewport={game.imageViewport}
          fallbackClassName={styles.mediaFallback}
        />
      </div>
      <div className={styles.compactGameCopy}>
        <strong>{game.title}</strong>
        <span>{preferenceStatus(preference)}</span>
      </div>
      <div className={styles.compactSignals} aria-label="Señales guardadas">
        <Heart
          size={17}
          fill={preference.favorite ? "currentColor" : "none"}
          data-active={preference.favorite}
          aria-hidden="true"
        />
        <Bell
          size={17}
          data-active={preference.followUpdates}
          aria-hidden="true"
        />
      </div>
    </Link>
  );
}

function RecommendationCard({
  recommendation,
}: {
  recommendation: Recommendation;
}) {
  return (
    <Link
      href={`/juegos/${recommendation.slug}`}
      className={styles.recommendationCard}
    >
      <div className={styles.recommendationMedia}>
        <GameMedia
          src={recommendation.coverImage}
          alt=""
          sizes="(max-width: 720px) 90vw, 280px"
          viewport={recommendation.imageViewport}
          fallbackClassName={styles.mediaFallback}
        />
        <span className={styles.recommendationHeart} aria-hidden="true">
          <Heart size={16} />
        </span>
      </div>
      <div className={styles.recommendationBody}>
        <strong>{recommendation.title}</strong>
        <span>{recommendation.category}</span>
        <div className={styles.recommendationMeta}>
          <span>
            {recommendation.rating
              ? `★ ${recommendation.rating.toFixed(1)}/5`
              : "Selección DeUna"}
          </span>
          {recommendation.compatibilityPercent !== null && (
            <b>{recommendation.compatibilityPercent}% compatible</b>
          )}
        </div>
        <small>{recommendation.reasons[0] ?? "Recomendado para ti"}</small>
      </div>
    </Link>
  );
}

export default function AccountDashboardClient({
  siteName,
  profile,
  games,
  preferences,
  hardware,
  cpus,
  gpus,
  notifications,
  recommendations,
  compatibilityPercent,
  compatibilityLabel,
  rewards,
}: DashboardProps) {
  const router = useRouter();
  const [view, setView] = useState<DashboardView>("overview");
  const [pending, setPending] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null);
  const [hardwareMessage, setHardwareMessage] = useState<string | null>(null);
  const [addMessage, setAddMessage] = useState<string | null>(null);
  const [notificationPending, setNotificationPending] = useState(false);

  const gamesBySlug = useMemo(
    () => new Map(games.map((game) => [game.slug, game])),
    [games]
  );
  const cpuById = useMemo(
    () => new Map(cpus.map((cpu) => [cpu.id, cpu.name])),
    [cpus]
  );
  const gpuById = useMemo(
    () => new Map(gpus.map((gpu) => [gpu.id, gpu.name])),
    [gpus]
  );

  const saved = preferences
    .map((preference) => ({
      preference,
      game: gamesBySlug.get(preference.gameSlug),
    }))
    .filter(
      (entry): entry is { preference: Preference; game: GameOption } =>
        Boolean(entry.game)
    );
  const favoriteCount = preferences.filter(
    (preference) => preference.favorite
  ).length;
  const displayName = profile.displayName?.trim() || profile.username;

  const navItems: Array<{
    id: DashboardView;
    label: string;
    icon: typeof Gamepad2;
    badge?: number;
  }> = [
    { id: "overview", label: "Mi DeUna", icon: Gamepad2 },
    {
      id: "rewards",
      label: "Recompensas",
      icon: Gift,
      badge: rewards.daily.available ? 1 : undefined,
    },
    { id: "games", label: "Mis juegos", icon: LibraryBig },
    { id: "pc", label: "Mi PC", icon: MonitorCog },
    { id: "alerts", label: "Avisos", icon: Bell, badge: notifications.length },
    { id: "discover", label: "Descubrimientos", icon: Compass },
    { id: "profile", label: "Perfil privado", icon: UserRound },
    { id: "settings", label: "Configuración", icon: Settings },
  ];

  async function savePreference(
    gameSlug: string,
    values: {
      favorite: boolean;
      libraryState: string;
      followUpdates: boolean;
    }
  ) {
    setPending(true);
    try {
      const data = await postForm("/api/account/games", {
        gameSlug,
        favorite: String(values.favorite),
        libraryState: values.libraryState,
        followUpdates: String(values.followUpdates),
      });
      if (!data.ok) return false;
      router.refresh();
      return true;
    } finally {
      setPending(false);
    }
  }

  async function addGame(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);

    setPending(true);
    setAddMessage(null);

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
      setPending(false);
    }
  }

  async function handleHardware(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    setPending(true);
    setHardwareMessage(null);

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

      setHardwareMessage(
        "PC guardada. DeUna ya puede usarla para ordenar compatibilidad."
      );
      router.refresh();
    } catch {
      setHardwareMessage("No se pudo conectar con el servicio de cuentas.");
    } finally {
      setPending(false);
    }
  }

  async function clearHardware() {
    setPending(true);
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
      setPending(false);
    }
  }

  async function markNotificationsSeen() {
    setNotificationPending(true);
    try {
      const data = await postForm("/api/account/notifications/seen", {
        intent: "seen",
      });
      if (data.ok) router.refresh();
    } finally {
      setNotificationPending(false);
    }
  }

  async function handleProfileSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    setPending(true);
    setProfileSaved(false);
    setProfileMessage(null);

    try {
      const data = await postForm("/api/account/profile", {
        displayName: String(form.get("displayName") ?? ""),
        email: String(form.get("email") ?? ""),
        bio: String(form.get("bio") ?? ""),
      });

      if (!data.ok) {
        setProfileMessage(
          data.error === "sesion"
            ? "Tu sesión venció. Vuelve a entrar."
            : "No se pudieron guardar los cambios."
        );
        return;
      }

      setProfileSaved(true);
      router.refresh();
      window.setTimeout(() => setProfileSaved(false), 2500);
    } catch {
      setProfileMessage("No se pudo conectar con el servicio de cuentas.");
    } finally {
      setPending(false);
    }
  }

  async function handleLogout() {
    setPending(true);
    try {
      const data = await postForm("/api/account/logout", {
        intent: "logout",
      });
      if (data.ok) {
        router.replace("/");
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  async function handleDelete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    setPending(true);
    setDeleteMessage(null);

    try {
      const data = await postForm("/api/account/delete", {
        password: String(form.get("password") ?? ""),
        confirmation: "ELIMINAR",
      });

      if (!data.ok) {
        setDeleteMessage(
          data.error === "credenciales"
            ? "La contraseña actual no coincide."
            : data.error === "sesion"
              ? "Tu sesión venció. Vuelve a entrar."
              : "No se pudo eliminar la cuenta."
        );
        return;
      }

      router.replace("/cuenta?modo=entrar&estado=eliminada");
      router.refresh();
    } catch {
      setDeleteMessage("No se pudo conectar con el servicio de cuentas.");
    } finally {
      setPending(false);
    }
  }

  function renderOverview() {
    const overviewGames = saved.slice(0, 4);
    const overviewAlerts = notifications.slice(0, 2);

    return (
      <>
        <header className={styles.welcomeHeader}>
          <div>
            <h1>¡Bienvenido, {displayName}!</h1>
            <p>Todo lo que importa sobre tus juegos, tu PC y tu progreso, en un solo lugar.</p>
          </div>
          <button
            type="button"
            className={styles.outlineAccentButton}
            onClick={() => setView("games")}
          >
            <SlidersHorizontal size={17} aria-hidden="true" />
            Personalizar DeUna
          </button>
        </header>

        <AccountRewardSummary
          rewards={rewards}
          onOpen={() => setView("rewards")}
        />

        <section className={styles.statsStrip} aria-label="Resumen de Mi DeUna">
          <div className={styles.statItem}>
            <span className={styles.statIcon}><Gamepad2 size={22} /></span>
            <div><strong>{saved.length}</strong><small>Juegos guardados</small></div>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statIcon}><Heart size={22} /></span>
            <div><strong>{favoriteCount}</strong><small>Favoritos</small></div>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statIcon}><BellRing size={22} /></span>
            <div><strong>{notifications.length}</strong><small>Avisos nuevos</small></div>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statIcon}><MonitorCog size={22} /></span>
            <div><strong>Mi PC</strong><small>{hardware ? "Configurada" : "Sin configurar"}</small></div>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statIcon}><Gauge size={22} /></span>
            <div><strong>{compatibilityLabel}</strong><small>Compatibilidad general</small></div>
          </div>
        </section>

        <div className={styles.overviewGrid}>
          <section className={styles.dashboardCard}>
            <div className={styles.cardHeading}>
              <div><Gamepad2 size={19} /><h2>Mis juegos</h2></div>
              <button type="button" onClick={() => setView("games")}>Ver todos →</button>
            </div>
            <div className={styles.compactGameList}>
              {overviewGames.length > 0 ? (
                overviewGames.map(({ game, preference }) => (
                  <DashboardGameRow
                    key={game.slug}
                    game={game}
                    preference={preference}
                  />
                ))
              ) : (
                <p className={styles.emptyCompact}>Todavía no guardaste juegos.</p>
              )}
            </div>
            <button
              type="button"
              className={styles.cardFooterButton}
              onClick={() => setView("games")}
            >
              Ver todos mis juegos
            </button>
          </section>

          <section className={styles.dashboardCard}>
            <div className={styles.cardHeading}>
              <div><MonitorCog size={19} /><h2>Mi PC</h2></div>
              <button type="button" onClick={() => setView("pc")}>
                {hardware ? "Editar" : "Configurar"}
              </button>
            </div>
            {hardware ? (
              <>
                <dl className={styles.pcSpecs}>
                  <div><dt>CPU</dt><dd>{cpuById.get(hardware.cpuId) ?? hardware.cpuId}</dd></div>
                  <div><dt>GPU</dt><dd>{gpuById.get(hardware.gpuId) ?? hardware.gpuId}</dd></div>
                  <div><dt>RAM</dt><dd>{hardware.ramGb} GB</dd></div>
                  <div><dt>Memoria</dt><dd>{memoryLabels[hardware.memoryMode]}</dd></div>
                </dl>
                <div className={styles.performanceBox}>
                  <div>
                    <span>Rendimiento promedio en juegos</span>
                    <strong>{compatibilityLabel}</strong>
                    <small>Basado en tu configuración actual</small>
                  </div>
                  {compatibilityPercent !== null && (
                    <div
                      className={styles.performanceGauge}
                      style={{
                        "--gauge": `${compatibilityPercent * 3.6}deg`,
                      } as CSSProperties}
                    >
                      <span>{compatibilityPercent}%</span>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className={styles.pcEmpty}>
                <Cpu size={30} />
                <strong>Configura tu PC una sola vez</strong>
                <span>
                  DeUna reutilizará esos componentes en el motor de FPS y en tus recomendaciones.
                </span>
              </div>
            )}
            <button
              type="button"
              className={styles.cardFooterButton}
              onClick={() => setView("pc")}
            >
              {hardware ? "Ver detalles de rendimiento" : "Configurar Mi PC"}
            </button>
          </section>

          <section className={styles.dashboardCard}>
            <div className={styles.cardHeading}>
              <div><Bell size={19} /><h2>Avisos recientes</h2></div>
              <button type="button" onClick={() => setView("alerts")}>Ver todos →</button>
            </div>
            <div className={styles.alertPreviewList}>
              {overviewAlerts.length > 0 ? (
                overviewAlerts.map((notification) => (
                  <Link
                    key={notification.id}
                    href={`/juegos/${notification.gameSlug}#versions`}
                    className={styles.alertPreview}
                  >
                    <div className={styles.alertCover}>
                      <GameMedia
                        src={notification.gameCoverImage}
                        alt=""
                        sizes="64px"
                        viewport={notification.gameImageViewport}
                        fallbackClassName={styles.mediaFallback}
                      />
                    </div>
                    <div>
                      <strong>{notification.gameTitle}</strong>
                      <span>{notification.version}</span>
                      <small>{formatAlertDate(notification.publishedAt)}</small>
                    </div>
                    <i aria-hidden="true" />
                  </Link>
                ))
              ) : (
                <p className={styles.emptyCompact}>No hay avisos nuevos.</p>
              )}
            </div>
            <button
              type="button"
              className={styles.cardFooterButton}
              onClick={() => setView("alerts")}
            >
              Ir a avisos
            </button>
          </section>
        </div>

        <section className={styles.recommendationsPanel}>
          <div className={styles.cardHeading}>
            <div><Sparkles size={19} /><h2>Recomendados para ti</h2></div>
            <button type="button" onClick={() => setView("discover")}>Ver todos →</button>
          </div>
          <div className={styles.recommendationGrid}>
            {recommendations.length > 0 ? (
              recommendations.slice(0, 5).map((recommendation) => (
                <RecommendationCard
                  key={recommendation.slug}
                  recommendation={recommendation}
                />
              ))
            ) : (
              <p className={styles.emptyCompact}>
                Guarda juegos o configura tu PC para activar recomendaciones personales.
              </p>
            )}
          </div>
        </section>
      </>
    );
  }

  function renderGames() {
    return (
      <section className={styles.fullPanel}>
        <div className={styles.sectionHeader}>
          <div>
            <span>MI BIBLIOTECA</span>
            <h1>Mis juegos</h1>
            <p>Favoritos, estados y seguimiento en una única lista compacta.</p>
          </div>
          <strong>{saved.length} guardados</strong>
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
          <label className={styles.inlineCheck}>
            <input name="favorite" type="checkbox" />
            <Heart size={16} /> Favorito
          </label>
          <label className={styles.inlineCheck}>
            <input name="followUpdates" type="checkbox" />
            <Bell size={16} /> Seguir
          </label>
          <button
            type="submit"
            className={styles.accentButton}
            disabled={pending}
          >
            Agregar
          </button>
          {addMessage && <span className={styles.inlineStatus}>{addMessage}</span>}
        </form>

        <div className={styles.libraryScroller}>
          {saved.map(({ game, preference }) => (
            <article key={game.slug} className={styles.libraryRow}>
              <Link
                href={`/juegos/${game.slug}`}
                className={styles.libraryIdentity}
              >
                <div className={styles.libraryCover}>
                  <GameMedia
                    src={game.coverImage}
                    alt=""
                    sizes="72px"
                    viewport={game.imageViewport}
                    fallbackClassName={styles.mediaFallback}
                  />
                </div>
                <div>
                  <strong>{game.title}</strong>
                  <span>{game.category}</span>
                </div>
              </Link>

              <select
                aria-label={`Estado de ${game.title}`}
                defaultValue={preference.libraryState ?? "none"}
                disabled={pending}
                onChange={(event) => {
                  void savePreference(game.slug, {
                    favorite: preference.favorite,
                    libraryState: event.target.value,
                    followUpdates: preference.followUpdates,
                  });
                }}
              >
                <option value="none">Sin lista</option>
                <option value="want_to_play">Quiero jugarlo</option>
                <option value="playing">Lo estoy jugando</option>
                <option value="completed">Terminado</option>
              </select>

              <button
                type="button"
                className={styles.iconToggle}
                aria-pressed={preference.favorite}
                aria-label={
                  preference.favorite
                    ? "Quitar favorito"
                    : "Agregar favorito"
                }
                disabled={pending}
                onClick={() =>
                  void savePreference(game.slug, {
                    favorite: !preference.favorite,
                    libraryState: preference.libraryState ?? "none",
                    followUpdates: preference.followUpdates,
                  })
                }
              >
                <Heart
                  size={18}
                  fill={preference.favorite ? "currentColor" : "none"}
                />
              </button>

              <button
                type="button"
                className={styles.iconToggle}
                aria-pressed={preference.followUpdates}
                aria-label={
                  preference.followUpdates
                    ? "Dejar de seguir actualizaciones"
                    : "Seguir actualizaciones"
                }
                disabled={pending}
                onClick={() =>
                  void savePreference(game.slug, {
                    favorite: preference.favorite,
                    libraryState: preference.libraryState ?? "none",
                    followUpdates: !preference.followUpdates,
                  })
                }
              >
                <Bell size={18} />
              </button>

              <button
                type="button"
                className={styles.removeButton}
                disabled={pending}
                onClick={() =>
                  void savePreference(game.slug, {
                    favorite: false,
                    libraryState: "none",
                    followUpdates: false,
                  })
                }
              >
                <Trash2 size={16} /> Quitar
              </button>
            </article>
          ))}
        </div>
      </section>
    );
  }

  function renderPc() {
    return (
      <section className={styles.fullPanel}>
        <div className={styles.sectionHeader}>
          <div>
            <span>RENDIMIENTO</span>
            <h1>Mi PC</h1>
            <p>
              Configúrala una vez y DeUna reutiliza esos datos explícitos en FPS y recomendaciones.
            </p>
          </div>
          {hardware && <strong>{compatibilityLabel}</strong>}
        </div>

        <div className={styles.pcWorkspace}>
          <form className={styles.hardwareForm} onSubmit={handleHardware}>
            <label>
              Procesador
              <select
                name="cpuId"
                defaultValue={hardware?.cpuId ?? ""}
                required
              >
                <option value="" disabled>Elige tu CPU</option>
                {cpus.map((cpu) => (
                  <option key={cpu.id} value={cpu.id}>{cpu.name}</option>
                ))}
              </select>
            </label>

            <label>
              Gráfica
              <select
                name="gpuId"
                defaultValue={hardware?.gpuId ?? ""}
                required
              >
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
              <select
                name="memoryMode"
                defaultValue={hardware?.memoryMode ?? "unknown"}
              >
                <option value="unknown">No sé / no importa</option>
                <option value="single">Single channel</option>
                <option value="dual">Dual channel</option>
              </select>
            </label>

            <div className={styles.formActions}>
              <button
                type="submit"
                className={styles.accentButton}
                disabled={pending}
              >
                <Cpu size={17} />
                {pending ? "Guardando..." : "Guardar Mi PC"}
              </button>
              {hardware && (
                <button
                  type="button"
                  className={styles.ghostButton}
                  disabled={pending}
                  onClick={clearHardware}
                >
                  <Trash2 size={16} /> Quitar PC guardada
                </button>
              )}
            </div>
            {hardwareMessage && (
              <p className={styles.inlineStatus}>{hardwareMessage}</p>
            )}
          </form>

          <div className={styles.pcSummaryLarge}>
            <MonitorCog size={30} />
            <span>Compatibilidad general</span>
            <strong>{compatibilityLabel}</strong>
            {compatibilityPercent !== null && <b>{compatibilityPercent}%</b>}
            <small>
              Estimación orientativa con el mismo motor de FPS de DeUna.
            </small>
          </div>
        </div>
      </section>
    );
  }

  function renderAlerts() {
    return (
      <section className={styles.fullPanel}>
        <div className={styles.sectionHeader}>
          <div>
            <span>SEGUIMIENTO</span>
            <h1>Avisos de tus juegos</h1>
            <p>
              Sólo aparecen cambios publicados después de que decidiste seguir cada juego.
            </p>
          </div>
          <strong>{notifications.length} nuevos</strong>
        </div>

        {notifications.length > 0 ? (
          <>
            <div className={styles.alertsGrid}>
              {notifications.map((notification) => (
                <Link
                  key={notification.id}
                  href={`/juegos/${notification.gameSlug}#versions`}
                  className={styles.alertCard}
                >
                  <div className={styles.alertLargeCover}>
                    <GameMedia
                      src={notification.gameCoverImage}
                      alt=""
                      sizes="96px"
                      viewport={notification.gameImageViewport}
                      fallbackClassName={styles.mediaFallback}
                    />
                  </div>
                  <div>
                    <strong>{notification.gameTitle}</strong>
                    <span>{notification.version}</span>
                    <p>{notification.summary}</p>
                    <small>{formatAlertDate(notification.publishedAt)}</small>
                  </div>
                </Link>
              ))}
            </div>
            <button
              type="button"
              className={styles.ghostButton}
              disabled={notificationPending}
              onClick={markNotificationsSeen}
            >
              <Check size={17} />
              {notificationPending
                ? "Actualizando..."
                : "Marcar todos como vistos"}
            </button>
          </>
        ) : (
          <div className={styles.emptyLarge}>
            <Bell size={30} />
            <strong>Estás al día</strong>
            <span>No hay avisos nuevos de los juegos que sigues.</span>
          </div>
        )}
      </section>
    );
  }

  function renderDiscover() {
    return (
      <section className={styles.fullPanel}>
        <div className={styles.sectionHeader}>
          <div>
            <span>PARA TI</span>
            <h1>Descubrimientos</h1>
            <p>
              Ordenados por tus elecciones explícitas y por la compatibilidad de Mi PC cuando está configurada.
            </p>
          </div>
          <strong>{recommendations.length} sugerencias</strong>
        </div>
        <div className={styles.discoveryGrid}>
          {recommendations.map((recommendation) => (
            <RecommendationCard
              key={recommendation.slug}
              recommendation={recommendation}
            />
          ))}
        </div>
      </section>
    );
  }

  function renderProfile() {
    return (
      <section className={styles.fullPanel}>
        <div className={styles.sectionHeader}>
          <div>
            <span>TU CUENTA</span>
            <h1>Perfil privado</h1>
            <p>
              Tu usuario es la única identidad obligatoria. Todo lo demás sigue siendo opcional.
            </p>
          </div>
          <strong>@{profile.username}</strong>
        </div>

        <form className={styles.profileForm} onSubmit={handleProfileSave}>
          <div className={styles.field}>
            <label htmlFor="dashboard-display-name">
              Nombre visible <span className={styles.optional}>Opcional</span>
            </label>
            <input
              id="dashboard-display-name"
              name="displayName"
              defaultValue={profile.displayName ?? ""}
              maxLength={80}
              autoComplete="nickname"
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="dashboard-email">
              Correo <span className={styles.optional}>Opcional</span>
            </label>
            <input
              id="dashboard-email"
              name="email"
              type="email"
              defaultValue={profile.email ?? ""}
              maxLength={254}
              autoComplete="email"
            />
            <p className={styles.hint}>
              Se cifra antes de guardarlo. Déjalo vacío para eliminarlo.
            </p>
          </div>

          <div className={styles.field}>
            <label htmlFor="dashboard-bio">
              Bio <span className={styles.optional}>Opcional</span>
            </label>
            <textarea
              id="dashboard-bio"
              name="bio"
              defaultValue={profile.bio ?? ""}
              maxLength={500}
            />
          </div>

          {profileMessage && (
            <p className={styles.message} role="status">{profileMessage}</p>
          )}

          <button
            type="submit"
            className={styles.primaryButton}
            disabled={pending}
          >
            <Save size={17} />
            {profileSaved
              ? "Guardado"
              : pending
                ? "Procesando..."
                : "Guardar cambios"}
          </button>
        </form>
      </section>
    );
  }

  function renderSettings() {
    return (
      <section className={styles.fullPanel}>
        <div className={styles.sectionHeader}>
          <div>
            <span>CONTROL Y PRIVACIDAD</span>
            <h1>Configuración</h1>
            <p>Privacidad por defecto y control directo sobre tu cuenta.</p>
          </div>
          <ShieldCheck size={30} />
        </div>

        <div className={styles.settingsGrid}>
          <section className={styles.privacyPanel}>
            <ShieldCheck size={28} aria-hidden="true" />
            <h2>Privacidad por defecto</h2>
            <p>
              La cuenta funciona sin convertir tus datos personales o tu navegación en requisito.
            </p>
            <ul>
              <li><ShieldCheck size={16} /> Sin IP ni historial de navegación asociado a tu cuenta.</li>
              <li><ShieldCheck size={16} /> Sin teléfono, nombre legal, domicilio o ubicación.</li>
              <li><ShieldCheck size={16} /> Correo opcional y cifrado si decides agregarlo.</li>
              <li><ShieldCheck size={16} /> Mi PC guarda sólo componentes que eliges explícitamente.</li>
              <li><ShieldCheck size={16} /> Rewards registra premios e hitos, no clics, vistas ni tiempo de navegación.</li>
            </ul>
          </section>

          <section className={styles.deletePanel}>
            <div className={styles.deleteHeader}>
              <div>
                <h2>Eliminar mi cuenta</h2>
                <p>
                  La eliminación es permanente. Se borran perfil, correo cifrado, sesiones, códigos de recuperación, Mis juegos, Mi PC y todo tu progreso de Rewards.
                </p>
              </div>
            </div>
            <form className={styles.deleteForm} onSubmit={handleDelete}>
              <div className={styles.field}>
                <label htmlFor="dashboard-delete-password">
                  Confirma con tu contraseña actual
                </label>
                <input
                  id="dashboard-delete-password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  disabled={pending}
                />
              </div>
              {deleteMessage && (
                <p className={styles.message} role="status">{deleteMessage}</p>
              )}
              <button
                type="submit"
                className={styles.dangerButton}
                disabled={pending}
              >
                <Trash2 size={17} />
                {pending ? "Eliminando..." : "Eliminar definitivamente"}
              </button>
            </form>
          </section>
        </div>
      </section>
    );
  }

  const content =
    view === "overview"
      ? renderOverview()
      : view === "rewards"
        ? <AccountRewardsView rewards={rewards} />
        : view === "games"
          ? renderGames()
          : view === "pc"
            ? renderPc()
            : view === "alerts"
              ? renderAlerts()
              : view === "discover"
                ? renderDiscover()
                : view === "profile"
                  ? renderProfile()
                  : renderSettings();

  return (
    <main className={styles.dashboardPage}>
      <div className={styles.dashboardShell}>
        <aside className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <SiteBrand siteName={siteName} className={styles.sidebarBrand} />
            <Link href="/" className={styles.backHome}>
              <ArrowLeft size={17} aria-hidden="true" />
              <span>Volver a DeUna</span>
            </Link>
          </div>

          <nav className={styles.sidebarNav} aria-label="Secciones de Mi DeUna">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  data-active={view === item.id}
                  onClick={() => setView(item.id)}
                >
                  <Icon size={19} aria-hidden="true" />
                  <span>{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <b>{item.badge}</b>
                  )}
                </button>
              );
            })}
          </nav>

          <div className={styles.sidebarUser}>
            <div className={styles.userIdentity}>
              <span><CircleUserRound size={25} /></span>
              <div>
                <strong>{profile.username}</strong>
                <small>Nivel {rewards.level.level} · {rewards.level.rank}</small>
              </div>
            </div>
            <div className={styles.userMiniStats}>
              <span>{rewards.xpTotal} XP</span>
              <span>{rewards.creditsBalance} créditos</span>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              disabled={pending}
            >
              <LogOut size={18} /> Cerrar sesión
            </button>
          </div>
        </aside>

        <div className={styles.dashboardMain}>
          {content}
        </div>
      </div>
    </main>
  );
}
