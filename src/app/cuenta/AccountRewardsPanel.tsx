"use client";

import Link from "next/link";
import {
  Check,
  Coins,
  Flame,
  Gift,
  ShieldCheck,
  Sparkles,
  Trophy,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import styles from "./account-rewards.module.css";

export type AccountRewardsSnapshot = {
  xpTotal: number;
  creditsBalance: number;
  streakDays: number;
  bestStreak: number;
  level: {
    level: number;
    rank: string;
    currentLevelXp: number;
    nextLevelXp: number;
    progressPercent: number;
  };
  daily: {
    available: boolean;
    nextClaimAt: string | null;
    rewardDay: number;
    xp: number;
    credits: number;
    schedule: Array<{
      day: number;
      xp: number;
      credits: number;
    }>;
  };
  weekly: {
    claims: number;
    target: number;
    complete: boolean;
    bonusXp: number;
    bonusCredits: number;
  };
  milestones: Array<{
    key: string;
    title: string;
    description: string;
    xp: number;
    credits: number;
    complete: boolean;
  }>;
  recentEvents: Array<{
    type: string;
    key: string;
    xp: number;
    credits: number;
    createdAt: string;
  }>;
};

type ClaimResult = {
  ok?: boolean;
  error?: string;
  claimed?: boolean;
  nextClaimAt?: string;
  xp?: number;
  credits?: number;
  weeklyBonus?: boolean;
};

function formatClaimAvailability(value: string | null) {
  if (!value) return "más tarde";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "más tarde";

  const formatted = new Intl.DateTimeFormat("es", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(date);

  return `${formatted} UTC`;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";

  return new Intl.DateTimeFormat("es", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  }).format(date);
}

function eventLabel(type: string, key: string) {
  if (type === "daily_claim") return "Recompensa diaria";
  if (type === "weekly_bonus") return "Objetivo semanal";
  if (type === "milestone") {
    const labels: Record<string, string> = {
      first_game: "Primer juego guardado",
      library_5: "Biblioteca en marcha",
      favorites_3: "Tus imprescindibles",
      follow_2: "Siempre al día",
      pc_configured: "Mi PC lista",
    };
    return labels[key] ?? "Hito de Mi DeUna";
  }
  return "Actividad Rewards";
}

async function claimReward(): Promise<ClaimResult> {
  const response = await fetch("/api/account/rewards/claim", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
    },
    credentials: "same-origin",
    body: new URLSearchParams({ intent: "claim" }).toString(),
  });

  return (await response.json()) as ClaimResult;
}

function ClaimButton({
  rewards,
}: {
  rewards: AccountRewardsSnapshot;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleClaim() {
    setPending(true);
    setMessage(null);

    try {
      const result = await claimReward();

      if (!result.ok) {
        setMessage("No se pudo reclamar la recompensa.");
        return;
      }

      if (!result.claimed) {
        setMessage(
          `Próximo reclamo: ${formatClaimAvailability(result.nextClaimAt ?? null)}.`
        );
        return;
      }

      const bonus = result.weeklyBonus ? " + bonus semanal" : "";
      setMessage(
        `+${result.xp ?? 0} XP · +${result.credits ?? 0} créditos${bonus}`
      );
      router.refresh();
    } catch {
      setMessage("No se pudo conectar con Rewards.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={styles.claimAction}>
      <button
        type="button"
        className={styles.claimButton}
        disabled={pending || !rewards.daily.available}
        onClick={handleClaim}
      >
        <Gift size={18} aria-hidden="true" />
        {pending
          ? "Reclamando..."
          : rewards.daily.available
            ? `Reclamar +${rewards.daily.credits} créditos`
            : `Disponible ${formatClaimAvailability(rewards.daily.nextClaimAt)}`}
      </button>
      {message && (
        <span className={styles.claimMessage} role="status">
          {message}
        </span>
      )}
    </div>
  );
}

export function AccountRewardSummary({
  rewards,
  onOpen,
}: {
  rewards: AccountRewardsSnapshot;
  onOpen: () => void;
}) {
  const levelSpan = Math.max(
    1,
    rewards.level.nextLevelXp - rewards.level.currentLevelXp
  );
  const levelProgress = Math.max(
    0,
    rewards.xpTotal - rewards.level.currentLevelXp
  );

  return (
    <section className={styles.todayPanel} aria-label="Hoy en DeUna Rewards">
      <div className={styles.todayIdentity}>
        <span className={styles.todayIcon}>
          <Flame size={24} aria-hidden="true" />
        </span>
        <div>
          <small>HOY EN DEUNA</small>
          <strong>Nivel {rewards.level.level} · {rewards.level.rank}</strong>
          <span>
            {rewards.streakDays > 0
              ? `Racha de ${rewards.streakDays} días`
              : "Empieza tu racha hoy"}
          </span>
        </div>
      </div>

      <div className={styles.levelProgress}>
        <div>
          <span>{rewards.xpTotal} XP</span>
          <span>{levelProgress}/{levelSpan} para el siguiente nivel</span>
        </div>
        <div className={styles.progressTrack} aria-hidden="true">
          <i style={{ width: `${rewards.level.progressPercent}%` }} />
        </div>
      </div>

      <div className={styles.todayBalances}>
        <span>
          <Coins size={18} aria-hidden="true" />
          <strong>{rewards.creditsBalance}</strong> créditos
        </span>
        <span>
          <Trophy size={18} aria-hidden="true" />
          Mejor racha: <strong>{rewards.bestStreak}</strong>
        </span>
      </div>

      <div className={styles.todayActions}>
        <ClaimButton rewards={rewards} />
        <button type="button" className={styles.openRewards} onClick={onOpen}>
          Ver Rewards
        </button>
      </div>
    </section>
  );
}

export function AccountRewardsView({
  rewards,
}: {
  rewards: AccountRewardsSnapshot;
}) {
  return (
    <section className={styles.rewardsView}>
      <header className={styles.rewardsHeader}>
        <div>
          <span>DEUNA REWARDS</span>
          <h1>Tu progreso</h1>
          <p>
            Suma XP y créditos con acciones útiles. No premiamos tiempo de pantalla, clics ni navegación.
          </p>
        </div>
        <div className={styles.rankBadge}>
          <Trophy size={22} aria-hidden="true" />
          <div>
            <small>NIVEL {rewards.level.level}</small>
            <strong>{rewards.level.rank}</strong>
          </div>
        </div>
      </header>

      <div className={styles.rewardStats}>
        <article>
          <Sparkles size={21} aria-hidden="true" />
          <div><strong>{rewards.xpTotal}</strong><span>XP total</span></div>
        </article>
        <article>
          <Coins size={21} aria-hidden="true" />
          <div><strong>{rewards.creditsBalance}</strong><span>Créditos DeUna</span></div>
        </article>
        <article>
          <Flame size={21} aria-hidden="true" />
          <div><strong>{rewards.streakDays}</strong><span>Racha actual</span></div>
        </article>
        <article>
          <Trophy size={21} aria-hidden="true" />
          <div><strong>{rewards.bestStreak}</strong><span>Mejor racha</span></div>
        </article>
      </div>

      <section className={styles.dailyCard}>
        <div className={styles.cardTitle}>
          <div>
            <Gift size={20} aria-hidden="true" />
            <div>
              <h2>Recompensa diaria</h2>
              <p>
                Un reclamo cada 20 horas. Tienes hasta 60 horas desde el reclamo anterior para conservar la racha.
              </p>
            </div>
          </div>
          <ClaimButton rewards={rewards} />
        </div>

        <div className={styles.dailySchedule}>
          {rewards.daily.schedule.map((reward) => {
            const active = reward.day === rewards.daily.rewardDay;
            return (
              <div
                key={reward.day}
                data-active={active}
                aria-current={active ? "step" : undefined}
                className={styles.dailyDay}
              >
                <span>Día {reward.day}</span>
                <strong>+{reward.credits}</strong>
                <small>créditos</small>
                <i>+{reward.xp} XP</i>
              </div>
            );
          })}
        </div>
      </section>

      <div className={styles.rewardColumns}>
        <section className={styles.weeklyCard}>
          <div className={styles.cardTitle}>
            <div>
              <Flame size={20} aria-hidden="true" />
              <div>
                <h2>Objetivo semanal</h2>
                <p>Reclama 3 recompensas dentro de la misma semana de Rewards.</p>
              </div>
            </div>
            {rewards.weekly.complete && (
              <span className={styles.completedTag}>
                <Check size={15} aria-hidden="true" /> Completado
              </span>
            )}
          </div>
          <div className={styles.weeklyProgress}>
            <div aria-hidden="true">
              {Array.from({ length: rewards.weekly.target }).map((_, index) => (
                <i key={index} data-complete={index < rewards.weekly.claims} />
              ))}
            </div>
            <strong>{rewards.weekly.claims}/{rewards.weekly.target}</strong>
          </div>
          <p className={styles.weeklyReward}>
            Bonus: +{rewards.weekly.bonusXp} XP · +{rewards.weekly.bonusCredits} créditos. La semana reinicia cada lunes a las 00:00 UTC.
          </p>
        </section>

        <section className={styles.levelCard}>
          <div className={styles.cardTitle}>
            <div>
              <Trophy size={20} aria-hidden="true" />
              <div><h2>Siguiente nivel</h2><p>{rewards.level.rank} · Nivel {rewards.level.level}</p></div>
            </div>
            <strong>{rewards.level.progressPercent}%</strong>
          </div>
          <div className={styles.bigProgress} aria-hidden="true">
            <i style={{ width: `${rewards.level.progressPercent}%` }} />
          </div>
          <p>
            {Math.max(0, rewards.level.nextLevelXp - rewards.xpTotal)} XP para llegar al nivel {rewards.level.level + 1}.
          </p>
        </section>
      </div>

      <section className={styles.milestonesCard}>
        <div className={styles.cardTitle}>
          <div>
            <Sparkles size={20} aria-hidden="true" />
            <div>
              <h2>Hitos de Mi DeUna</h2>
              <p>Se pagan una sola vez. Activar y desactivar opciones no genera créditos extra.</p>
            </div>
          </div>
        </div>
        <div className={styles.milestoneGrid}>
          {rewards.milestones.map((milestone) => (
            <article key={milestone.key} data-complete={milestone.complete}>
              <span className={styles.milestoneCheck}>
                {milestone.complete
                  ? <Check size={17} aria-hidden="true" />
                  : <Gift size={17} aria-hidden="true" />}
              </span>
              <div>
                <strong>{milestone.title}</strong>
                <p>{milestone.description}</p>
                <small>+{milestone.xp} XP · +{milestone.credits} créditos</small>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.milestonesCard} aria-labelledby="rewards-rules-title">
        <div className={styles.cardTitle}>
          <div>
            <ShieldCheck size={20} aria-hidden="true" />
            <div>
              <h2 id="rewards-rules-title">Reglas claras</h2>
              <p>El progreso busca dar motivos para volver sin castigar al usuario por no entrar.</p>
            </div>
          </div>
        </div>
        <div className={styles.milestoneGrid}>
          <article data-complete="true">
            <span className={styles.milestoneCheck}><Trophy size={17} aria-hidden="true" /></span>
            <div>
              <strong>El XP es progreso</strong>
              <p>No se gasta y no se descuenta por perder una racha o por dejar de entrar.</p>
            </div>
          </article>
          <article data-complete="true">
            <span className={styles.milestoneCheck}><Coins size={17} aria-hidden="true" /></span>
            <div>
              <strong>Los créditos no son dinero</strong>
              <p>No tienen valor monetario ni conversión a efectivo. No vencen por inactividad mientras la cuenta exista y el canje todavía no está habilitado.</p>
            </div>
          </article>
          <article data-complete="true">
            <span className={styles.milestoneCheck}><Gift size={17} aria-hidden="true" /></span>
            <div>
              <strong>Sin premios aleatorios</strong>
              <p>La tabla diaria, los hitos y el bonus semanal son deterministas. Si la racha vence, sólo reinicia la racha: no pierdes XP ni créditos ya obtenidos.</p>
            </div>
          </article>
          <article data-complete="true">
            <span className={styles.milestoneCheck}><ShieldCheck size={17} aria-hidden="true" /></span>
            <div>
              <strong>Sin seguimiento para premiarte</strong>
              <p>Rewards no usa clics, páginas vistas ni tiempo de pantalla. <Link href="/privacidad">Ver cómo funciona la privacidad de Mi DeUna.</Link></p>
            </div>
          </article>
        </div>
      </section>

      <section className={styles.activityCard}>
        <div className={styles.cardTitle}>
          <div>
            <Coins size={20} aria-hidden="true" />
            <div><h2>Últimas recompensas</h2><p>Sólo eventos de Rewards, no historial de navegación.</p></div>
          </div>
        </div>
        <div className={styles.activityList}>
          {rewards.recentEvents.length > 0 ? (
            rewards.recentEvents.map((event, index) => (
              <div key={`${event.type}:${event.key}:${index}`}>
                <span><Gift size={17} aria-hidden="true" /></span>
                <div>
                  <strong>{eventLabel(event.type, event.key)}</strong>
                  <small>{formatDate(event.createdAt)}</small>
                </div>
                <b>+{event.xp} XP · {event.credits >= 0 ? "+" : ""}{event.credits} créditos</b>
              </div>
            ))
          ) : (
            <p className={styles.emptyActivity}>Tu primera recompensa aparecerá aquí.</p>
          )}
        </div>
      </section>
    </section>
  );
}
