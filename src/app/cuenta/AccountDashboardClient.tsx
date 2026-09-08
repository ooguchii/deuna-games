"use client";

import Image from "next/image";
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
  useEffect,
  useMemo,
  useState,
} from "react";

import HardwareConfigurationFields, { type ManualDraft } from "@/features/game-finder/HardwareConfigurationFields";
import { findCpuById, findGpuById } from "@/features/game-finder/hardware-catalog";
import { clearStoredHardwareProfile, storeExplicitHardwareProfile } from "@/features/game-finder/hardware-storage";
import SiteBrand from "@/components/layout/SiteBrand";
import GameFavoriteButton from "@/components/ui/GameFavoriteButton";
import GameMedia from "@/components/ui/GameMedia";
import {
  accountDashboardDestinations,
  accountDashboardViewHref,
  resolveAccountDashboardView,
  type AccountDashboardView,
} from "@/lib/accounts/dashboard-view";
import type { GameImageViewport } from "@/types/game";

import AccountAvatarEditor from "./AccountAvatarEditor";
import {
  AccountRewardSummary,
  AccountRewardsView,
  type AccountRewardsSnapshot,
} from "./AccountRewardsPanel";
import styles from "./account-dashboard.module.css";

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

function AccountHardwareForm({ hardware, pending, message, onSubmit, onClear }: {
  hardware: HardwareSelection;
  pending: boolean;
  message: string | null;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClear: () => void;
}) {
  const initialDraft: ManualDraft = {
    cpuId: hardware?.cpuId ?? "",
    gpuId: hardware?.gpuId ?? "",
    ramGb: hardware ? String(hardware.ramGb) : "",
    memoryMode: hardware?.memoryMode ?? "unknown",
    os: "",
  };
  const [draft, setDraft] = useState(initialDraft);
  const ready = Boolean(findCpuById(draft.cpuId) && findGpuById(draft.gpuId)
    && Number(draft.ramGb) >= 1 && Number(draft.ramGb) <= 256);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initialDraft);

  return (
    <form className={styles.hardwareForm} onSubmit={onSubmit} aria-label="Configurar Mi PC">
      <p className={styles.hardwareHelp}>
        Busca el modelo exacto de tu procesador y tu gráfica y confirma la RAM física.
        Se guardarán en tu cuenta para usarlos en FPS y recomendaciones.
      </p>
      <fieldset disabled={pending} className={styles.hardwareFields}>
        <legend className={styles.hardwareLegend}>Componentes de tu PC</legend>
        <HardwareConfigurationFields
          draft={draft}
          onChange={setDraft}
          idPrefix="account"
          showOperatingSystem={false}
        />
      </fieldset>
      {findGpuById(draft.gpuId)?.integrated && (
        <p className={styles.hardwareHelp}>
          En gráficas integradas, usar uno o dos canales de memoria puede cambiar el rendimiento estimado.
        </p>
      )}
      <div className={styles.formActions}>
        <button type="submit" className={styles.accentButton} disabled={pending || !ready || !dirty}>
          <Cpu size={17} /> {pending ? "Guardando..." : "Guardar Mi PC"}
        </button>
        {dirty && (
          <button type="button" className={styles.ghostButton} disabled={pending} onClick={() => setDraft(initialDraft)}>
            Cancelar cambios
          </button>
        )}
        {hardware && (
          <button type="button" className={styles.ghostButton} disabled={pending} onClick={onClear}>
            <Trash2 size={16} /> Quitar PC guardada
          </button>
        )}
      </div>
      {message && <p className={styles.inlineStatus} role="status">{message}</p>}
    </form>
  );
}

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

type PerformanceEstimate = {
  minFps: number;
  maxFps: number;
  tier: "excellent" | "good" | "acceptable" | "basic";
  confidence: "high" | "medium" | "low";
};

type Recommendation = {
  slug: string;
  title: string;
  category: string;
  coverImage?: string;
  imageViewport?: GameImageViewport;
  rating?: number;
  reasons: string[];
  performanceEstimate: PerformanceEstimate | null;
};

type ApiResult = {
  ok?: boolean;
  error?: string;
};

type DashboardProps = {
  initialView: AccountDashboardView;
  siteName: string;
  profile: Profile;
  games: GameOption[];
  preferences: Preference[];
  hardware: HardwareSelection;
  cpus: HardwareOption[];
  gpus: HardwareOption[];
  notifications: Notification[];
  recommendations: Recommendation[];
  hardwareEstimateCount: number;
  hardwareCoveragePercent: number | null;
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

const performanceTierLabels: Record<PerformanceEstimate["tier"], string> = {
  excellent: "Excelente",
  good: "Buena",
  acceptable: "Aceptable",
  basic: "Básica",
};

const confidenceLabels: Record<PerformanceEstimate["confidence"], string> = {
  high: "alta",
  medium: "media",
  low: "baja",
};

const dashboardNavIcons: Record<AccountDashboardView, typeof Gamepad2> = {
  overview: Gamepad2,
  rewards: Gift,
  games: LibraryBig,
  pc: MonitorCog,
  alerts: Bell,
  discover: Compass,
  profile: UserRound,
  settings: Settings,
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
  const estimate = recommendation.performanceEstimate;

  return (
    <article style={{ position: "relative", minWidth: 0 }}>
      <Link
        href={`/juegos/${recommendation.slug}`}
        className={styles.recommendationCard}
        style={{ display: "block", height: "100%" }}
      >
        <div className={styles.recommendationMedia}>
          <GameMedia
            src={recommendation.coverImage}
            alt=""
            sizes="(max-width: 720px) 90vw, 280px"
            viewport={recommendation.imageViewport}
            fallbackClassName={styles.mediaFallback}
          />
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
            {estimate && (
              <b>
                {estimate.minFps}–{estimate.maxFps} FPS estimados
              </b>
            )}
          </div>
          <small>
            {estimate
              ? `${performanceTierLabels[estimate.tier]} · confianza ${confidenceLabels[estimate.confidence]}`
              : recommendation.reasons[0] ?? "Recomendado para ti"}
          </small>
        </div>
      </Link>
      <GameFavoriteButton
        gameSlug={recommendation.slug}
        gameTitle={recommendation.title}
        className={styles.recommendationHeart}
        style={{
          position: "absolute",
          top: 5,
          right: 5,
          zIndex: 2,
          width: 44,
          height: 44,
          border: 0,
          borderRadius: "50%",
          background: "transparent",
          backdropFilter: "none",
        }}
      />
    </article>
  );
}

export default function AccountDashboardClient({
  initialView,
  siteName,
  profile,
  games,
  preferences,
  hardware,
  cpus,
  gpus,
  notifications,
  recommendations,
  hardwareEstimateCount,
  hardwareCoveragePercent,
  rewards,
}: DashboardProps) {
  const router = useRouter();
  const [view, setView] = useState<AccountDashboardView>(initialView);
  const [pending, setPending] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null);
  const [hardwareMessage, setHardwareMessage] = useState<string | null>(null);
  const [addMessage, setAddMessage] = useState<string | null>(null);
  const [notificationPending, setNotificationPending] = useState(false);
  const [sidebarAvatarRevision, setSidebarAvatarRevision] = useState(0);
  const [sidebarHasAvatar, setSidebarHasAvatar] = useState<boolean | null>(null);

  function openView(nextView: AccountDashboardView) {
    if (nextView === view) return;
    setView(nextView);
    window.history.pushState(null, "", accountDashboardViewHref(nextView));
  }

  useEffect(() => {
    const currentView = new URLSearchParams(window.location.search).get("vista");
    if (
      currentView !== null &&
      resolveAccountDashboardView(currentView) === "overview"
    ) {
      window.history.replaceState(null, "", accountDashboardViewHref("overview"));
    }

    const syncViewFromLocation = () => {
      const parameters = new URLSearchParams(window.location.search);
      setView(
        resolveAccountDashboardView(parameters.get("vista") ?? undefined)
      );
    };

    window.addEventListener("popstate", syncViewFromLocation);
    return () => window.removeEventListener("popstate", syncViewFromLocation);
  }, []);

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
  const sidebarAvatarSrc = `/api/account/avatar?r=${sidebarAvatarRevision}`;

  const navItems = accountDashboardDestinations.map((destination) => ({
    id: destination.id,
    label: destination.label,
    icon: dashboardNavIcons[destination.id],
    badge:
      destination.id === "rewards"
        ? rewards.daily.available ? 1 : undefined
        : destination.id === "alerts"
          ? notifications.length
          : undefined,
  }));

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
    if (pending) return;
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

      storeExplicitHardwareProfile({
        cpuId: String(form.get("cpuId")),
        gpuId: String(form.get("gpuId")),
        ramGb: Number(form.get("ramGb")),
        memoryMode: String(form.get("memoryMode")) as NonNullable<HardwareSelection>["memoryMode"],
      });
      setHardwareMessage(
        "PC guardada. DeUna ya puede usarla para ordenar recomendaciones por rendimiento estimado."
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

      clearStoredHardwareProfile();
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
            onClick={() => openView("games")}
          >
            <SlidersHorizontal size={17} aria-hidden="true" />
            Personalizar DeUna
          </button>
        </header>

        <AccountRewardSummary
          rewards={rewards}
          onOpen={() => openView("rewards")}
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
            <div>
              <strong>{hardware ? hardwareEstimateCount : "—"}</strong>
              <small>{hardware ? "Juegos con estimación FPS" : "Configura Mi PC"}</small>
            </div>
          </div>
        </section>

        <div className={styles.overviewGrid}>
          <section className={styles.dashboardCard}>
            <div className={styles.cardHeading}>
              <div><Gamepad2 size={19} /><h2>Mis juegos</h2></div>
              <button type="button" onClick={() => openView("games")}>Ver todos →</button>
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
              onClick={() => openView("games")}
            >
              Ver todos mis juegos
            </button>
          </section>

          <section className={styles.dashboardCard}>
            <div className={styles.cardHeading}>
              <div><MonitorCog size={19} /><h2>Mi PC</h2></div>
              <button type="button" onClick={() => openView("pc")}>
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
                    <span>Cobertura del motor FPS</span>
                    <strong>{hardwareEstimateCount} de {games.length} juegos</strong>
                    <small>Con calibración para rango estimado en 1080p medio.</small>
                  </div>
                  {hardwareCoveragePercent !== null && (
                    <div
                      className={styles.performanceGauge}
                      style={{
                        "--gauge": `${hardwareCoveragePercent * 3.6}deg`,
                      } as CSSProperties}
                      aria-label={`${hardwareCoveragePercent}% del catálogo tiene estimación FPS disponible`}
                    >
                      <span>{hardwareCoveragePercent}%</span>
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
              onClick={() => openView("pc")}
            >
              {hardware ? "Ver detalles de rendimiento" : "Configurar Mi PC"}
            </button>
          </section>

          <section className={styles.dashboardCard}>
            <div className={styles.cardHeading}>
              <div><Bell size={19} /><h2>Avisos recientes</h2></div>
              <button type="button" onClick={() => openView("alerts")}>Ver todos →</button>
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
              onClick={() => openView("alerts")}
            >
              Ir a avisos
            </button>
          </section>
        </div>

        <section className={styles.recommendationsPanel}>
          <div className={styles.cardHeading}>
            <div><Sparkles size={19} /><h2>Recomendados para ti</h2></div>
            <button type="button" onClick={() => openView("discover")}>Ver todos →</button>
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
          {hardware && <strong>{hardwareEstimateCount} estimables</strong>}
        </div>

        <div className={styles.pcWorkspace}>
          <AccountHardwareForm
            key={JSON.stringify(hardware)}
            hardware={hardware}
            pending={pending}
            message={hardwareMessage}
            onSubmit={handleHardware}
            onClear={clearHardware}
          />

          <div className={styles.pcSummaryLarge}>
            <MonitorCog size={30} />
            <span>Cobertura de estimaciones</span>
            <strong>{hardwareEstimateCount} de {games.length} juegos</strong>
            {hardwareCoveragePercent !== null && (
              <b>{hardwareCoveragePercent}% del catálogo</b>
            )}
            <small>
              Este porcentaje mide cobertura de calibración, no compatibilidad. Los FPS se muestran por juego como rangos estimados y con nivel de confianza.
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
              Ordenados por tus elecciones explícitas y por el rendimiento estimado de Mi PC cuando está configurada.
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

        <AccountAvatarEditor
          username={profile.username}
          onAvatarChange={(hasAvatar) => {
            setSidebarHasAvatar(hasAvatar);
            setSidebarAvatarRevision((current) => current + 1);
          }}
        />

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
                  aria-current={view === item.id ? "page" : undefined}
                  onClick={() => openView(item.id)}
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
              <span style={{ position: "relative", overflow: "hidden" }}>
                <CircleUserRound size={25} aria-hidden="true" />
                {sidebarHasAvatar !== false && (
                  <Image
                    key={sidebarAvatarSrc}
                    src={sidebarAvatarSrc}
                    alt=""
                    width={42}
                    height={42}
                    unoptimized
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                    onLoad={() => setSidebarHasAvatar(true)}
                    onError={() => setSidebarHasAvatar(false)}
                  />
                )}
              </span>
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