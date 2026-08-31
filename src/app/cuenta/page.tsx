import type { Metadata } from "next";
import {
  BellRing,
  Cpu,
  Gamepad2,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";

import {
  cpuCatalog,
  gpuCatalog,
} from "@/features/game-finder/hardware-catalog";
import {
  getAccountPersonalization,
} from "@/lib/accounts/personalization-service";
import {
  getAccountProfile,
} from "@/lib/accounts/service";
import {
  readAccountSession,
} from "@/lib/accounts/session";
import {
  getPublicGames,
} from "@/lib/games/public-catalog";
import {
  hasRecommendationSignals,
  rankGamesForSavedHardware,
  rankPersonalizedRecommendations,
} from "@/lib/home/account-personalization";
import {
  getPublicResolvedUpdates,
} from "@/lib/updates/public-updates";

import AccountAccessClient from "./AccountAccessClient";
import AccountPersonalizationClient from "./AccountPersonalizationClient";
import styles from "./account.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mi DeUna",
  robots: {
    index: false,
    follow: false,
  },
};

function compatibilityPercent(
  minFps: number | undefined,
  canEstimate: boolean | undefined
) {
  if (!canEstimate || !minFps) return null;
  return Math.max(30, Math.min(100, Math.round((minFps / 60) * 100)));
}

function compatibilityLabel(percent: number | null) {
  if (percent === null) return "Sin configurar";
  if (percent >= 85) return "Muy buena";
  if (percent >= 70) return "Buena";
  if (percent >= 50) return "Aceptable";
  return "Básica";
}

export default async function AccountPage() {
  const session = await readAccountSession();

  if (session) {
    const [profile, personalization, games, updates] = await Promise.all([
      getAccountProfile(session.userId),
      getAccountPersonalization(session.userId),
      getPublicGames(),
      getPublicResolvedUpdates(),
    ]);

    if (profile) {
      const preferenceBySlug = new Map(
        personalization.preferences.map((preference) => [
          preference.gameSlug,
          preference,
        ])
      );
      const notifications = updates.filter((update) => {
        const preference = preferenceBySlug.get(update.gameSlug);

        if (
          !preference?.followUpdates ||
          !preference.followedAt
        ) {
          return false;
        }

        const boundary =
          preference.updatesSeenThrough ?? preference.followedAt;
        const publishedAt = Date.parse(update.publishedAt);

        return (
          Number.isFinite(publishedAt) &&
          publishedAt > boundary.getTime()
        );
      });
      const recommendations = hasRecommendationSignals(
        personalization.preferences,
        personalization.hardware
      )
        ? rankPersonalizedRecommendations(
            games,
            personalization.preferences,
            personalization.hardware
          ).slice(0, 12)
        : [];
      const hardwareRanking = personalization.hardware
        ? rankGamesForSavedHardware(
            games,
            personalization.hardware
          )
        : [];
      const compatiblePercents = hardwareRanking
        .map((entry) =>
          compatibilityPercent(
            entry.estimate?.minFps,
            entry.estimate?.canEstimate
          )
        )
        .filter((value): value is number => value !== null);
      const overallCompatibility = compatiblePercents.length > 0
        ? Math.round(
            compatiblePercents.reduce((total, value) => total + value, 0) /
              compatiblePercents.length
          )
        : null;

      return (
        <main className={`${styles.page} ${styles.dashboardPage}`}>
          <AccountPersonalizationClient
            profile={{
              ...profile,
              createdAt: profile.createdAt.toISOString(),
            }}
            games={games.map((game) => ({
              slug: game.slug,
              title: game.title,
              category: game.category,
              coverImage: game.coverImage,
              rating: game.rating,
            }))}
            preferences={personalization.preferences.map((preference) => ({
              gameSlug: preference.gameSlug,
              favorite: preference.favorite,
              libraryState: preference.libraryState,
              followUpdates: preference.followUpdates,
            }))}
            hardware={personalization.hardwareSelection
              ? {
                  cpuId: personalization.hardwareSelection.cpuId,
                  gpuId: personalization.hardwareSelection.gpuId,
                  ramGb: personalization.hardwareSelection.ramGb,
                  memoryMode: personalization.hardwareSelection.memoryMode,
                }
              : null}
            cpus={cpuCatalog.map((cpu) => ({
              id: cpu.id,
              name: cpu.name,
            }))}
            gpus={gpuCatalog.map((gpu) => ({
              id: gpu.id,
              name: gpu.name,
            }))}
            notifications={notifications.map((update) => ({
              id: update.id,
              gameSlug: update.gameSlug,
              gameTitle: update.game.title,
              gameCoverImage: update.game.coverImage,
              version: update.version,
              summary: update.summary,
              publishedAt: update.publishedAt,
            }))}
            recommendations={recommendations.map((entry) => ({
              slug: entry.game.slug,
              title: entry.game.title,
              category: entry.game.category,
              coverImage: entry.game.coverImage,
              rating: entry.game.rating,
              reasons: entry.reasons,
              compatibilityPercent: compatibilityPercent(
                entry.estimate?.minFps,
                entry.estimate?.canEstimate
              ),
            }))}
            compatibilityPercent={overallCompatibility}
            compatibilityLabel={compatibilityLabel(overallCompatibility)}
          />
        </main>
      );
    }
  }

  return (
    <main className={styles.page}>
      <div className={`${styles.shell} ${styles.hero}`}>
        <section className={styles.intro}>
          <span className={styles.eyebrow}>
            <Sparkles size={16} aria-hidden="true" />
            MI DEUNA
          </span>
          <h1>Tu DeUna cambia cuando sabe lo que eliges guardar.</h1>
          <p>
            La cuenta sirve para guardar tus juegos, recordar tu PC, seguir actualizaciones y ordenar recomendaciones para ti. No hace falta convertir tu navegación en seguimiento para personalizar la experiencia.
          </p>

          <ul className={styles.privacyList}>
            <li>
              <Gamepad2 size={18} aria-hidden="true" />
              Mis juegos: favoritos, quiero jugarlo, jugando y terminado.
            </li>
            <li>
              <Cpu size={18} aria-hidden="true" />
              Mi PC: guarda CPU, GPU y RAM para usar el mismo motor de FPS de DeUna sin configurarlo cada vez.
            </li>
            <li>
              <BellRing size={18} aria-hidden="true" />
              Sigue juegos y recibe avisos internos cuando tengan nuevas actualizaciones publicadas.
            </li>
            <li>
              <ShieldCheck size={18} aria-hidden="true" />
              Las recomendaciones usan esas elecciones explícitas, no IP, ubicación ni historial de navegación.
            </li>
            <li>
              <UserRound size={18} aria-hidden="true" />
              Para crear la cuenta sólo se necesitan usuario y contraseña; el resto es opcional.
            </li>
            <li>
              <LockKeyhole size={18} aria-hidden="true" />
              El correo continúa siendo opcional y se cifra si decides agregarlo.
            </li>
          </ul>
        </section>

        <AccountAccessClient />
      </div>
    </main>
  );
}
