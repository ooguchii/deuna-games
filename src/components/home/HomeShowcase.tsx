"use client";

import Link from "next/link";
import {
  BadgeCheck,
  Bell,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Gamepad2,
  Globe2,
  Heart,
  Home,
  Info,
  Library,
  LogOut,
  Monitor,
  Pause,
  Play,
  RefreshCcw,
  Search,
  Settings,
  Shield,
  Star,
  Trophy,
  UserRound,
  UsersRound,
  Zap,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { games } from "@/data/home";
import type { Game } from "@/types/game";

import styles from "./HomeShowcase.module.css";

const FEATURED_SLUGS = [
  "baldurs-gate-3",
  "god-of-war-ragnarok",
  "forza-horizon-5",
];

const POPULAR_SLUGS = [
  "stardew-valley",
  "red-dead-redemption-2",
  "gta-san-andreas",
  "portal-2",
  "minecraft-java-edition",
];

const AUTOPLAY_MS = 7000;

function pickGames(slugs: string[]) {
  return slugs
    .map((slug) => games.find((game) => game.slug === slug))
    .filter((game): game is Game => Boolean(game));
}

export default function HomeShowcase() {
  const featuredGames = useMemo(
    () => pickGames(FEATURED_SLUGS),
    []
  );
  const popularGames = useMemo(
    () => pickGames(POPULAR_SLUGS),
    []
  );

  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const activeGame = featuredGames[activeIndex] ?? featuredGames[0];
  const nextGame = featuredGames[(activeIndex + 1) % featuredGames.length];

  useEffect(() => {
    if (paused || featuredGames.length <= 1) {
      return;
    }

    const timer = window.setTimeout(() => {
      setActiveIndex((current) => (current + 1) % featuredGames.length);
    }, AUTOPLAY_MS);

    return () => window.clearTimeout(timer);
  }, [activeIndex, featuredGames.length, paused]);

  if (!activeGame) {
    return null;
  }

  const previous = () => {
    setActiveIndex((current) =>
      (current - 1 + featuredGames.length) % featuredGames.length
    );
  };

  const next = () => {
    setActiveIndex((current) => (current + 1) % featuredGames.length);
  };

  return (
    <section className={styles.pageTop} aria-label="Inicio DeUna Games">
      <div className={styles.backgroundGlow} aria-hidden="true" />

      <div className={styles.shell}>
        <header className={styles.header}>
          <Link href="/" className={styles.brand} aria-label="DeUna Games - Inicio">
            <span className={styles.brandIcon}>
              <Gamepad2 size={27} strokeWidth={2} />
            </span>
            <span className={styles.brandName}>
              DeUna <strong>Games</strong>
            </span>
          </Link>

          <nav className={styles.nav} aria-label="Navegación principal">
            <Link href="/" className={`${styles.navItem} ${styles.navActive}`}>
              <Home size={20} strokeWidth={1.9} />
              <span>Inicio</span>
            </Link>
            <Link href="/juegos" className={styles.navItem}>
              <Gamepad2 size={20} strokeWidth={1.9} />
              <span>Juegos</span>
            </Link>
            <Link href="/actualizaciones" className={styles.navItem}>
              <RefreshCcw size={20} strokeWidth={1.9} />
              <span>Actualizaciones</span>
            </Link>
            <Link href="/quienes-somos" className={styles.navItem}>
              <CircleHelp size={20} strokeWidth={1.9} />
              <span>Quiénes somos</span>
            </Link>
          </nav>

          <div className={styles.headerActions}>
            <form className={styles.searchBox} action="/juegos" role="search">
              <Search size={20} strokeWidth={1.8} />
              <input
                type="search"
                name="q"
                placeholder="Buscar juegos..."
                aria-label="Buscar juegos"
              />
              <span className={styles.shortcut}>⌘K</span>
            </form>

            <Link href="/requisitos" className={styles.requirementsButton}>
              <Gamepad2 size={18} strokeWidth={2} />
              <span>Por requisitos</span>
            </Link>

            <button
              type="button"
              className={styles.notificationButton}
              aria-label="Notificaciones"
            >
              <Bell size={22} strokeWidth={1.85} />
              <span className={styles.notificationDot} />
            </button>

            <details className={styles.profileMenu}>
              <summary className={styles.profileSummary} aria-label="Abrir menú de perfil">
                <span className={styles.avatar}>
                  <UserRound size={24} strokeWidth={1.8} />
                </span>
              </summary>

              <div className={styles.profilePanel}>
                <div className={styles.profileHeader}>
                  <span className={styles.profileAvatarLarge}>
                    <UserRound size={29} strokeWidth={1.7} />
                  </span>
                  <div>
                    <div className={styles.profileNameRow}>
                      <strong>Jugador Élite</strong>
                      <BadgeCheck size={17} strokeWidth={2} />
                    </div>
                    <span className={styles.onlineState}>
                      <i /> En línea
                    </span>
                  </div>
                </div>

                <div className={styles.profileDivider} />

                <Link href="/perfil" className={styles.profileItem}>
                  <UserRound size={22} strokeWidth={1.7} />
                  <span><strong>Mi perfil</strong><small>Ver y editar perfil</small></span>
                </Link>
                <Link href="/biblioteca" className={styles.profileItem}>
                  <Library size={22} strokeWidth={1.7} />
                  <span><strong>Mi biblioteca</strong><small>Tus juegos y progreso</small></span>
                </Link>
                <Link href="/favoritos" className={styles.profileItem}>
                  <Heart size={22} strokeWidth={1.7} />
                  <span><strong>Favoritos</strong><small>Juegos que te encantan</small></span>
                </Link>

                <div className={styles.profileDivider} />

                <Link href="/configuracion" className={styles.profileItem}>
                  <Settings size={22} strokeWidth={1.7} />
                  <span><strong>Configuración</strong><small>Preferencias de la cuenta</small></span>
                </Link>
                <Link href="/seguridad" className={styles.profileItem}>
                  <Shield size={22} strokeWidth={1.7} />
                  <span><strong>Seguridad</strong><small>Contraseña y verificación</small></span>
                </Link>

                <div className={styles.profileDivider} />

                <button type="button" className={`${styles.profileItem} ${styles.logoutItem}`}>
                  <LogOut size={22} strokeWidth={1.7} />
                  <span><strong>Cerrar sesión</strong><small>Salir de tu cuenta</small></span>
                </button>
              </div>
            </details>
          </div>
        </header>

        <div className={styles.heroArea}>
          <button
            type="button"
            className={`${styles.heroArrow} ${styles.heroArrowLeft}`}
            aria-label="Juego anterior"
            onClick={previous}
          >
            <ChevronLeft size={26} />
          </button>

          <article className={styles.heroCard}>
            <div className={styles.heroMedia}>
              {activeGame.heroImage || activeGame.coverImage ? (
                <img
                  src={activeGame.heroImage ?? activeGame.coverImage}
                  alt=""
                  aria-hidden="true"
                />
              ) : null}
              <div className={styles.heroOverlay} />
            </div>

            <div className={styles.heroContent}>
              <span className={styles.heroBadge}>{activeGame.category}</span>
              <h1>{activeGame.title}</h1>
              <p>{activeGame.description}</p>

              <div className={styles.heroButtons}>
                <Link href={`/juegos/${activeGame.slug}`} className={styles.primaryButton}>
                  <Play size={18} fill="currentColor" />
                  Ver juego
                </Link>
                <Link href={`/juegos/${activeGame.slug}`} className={styles.secondaryButton}>
                  <Info size={18} />
                  Más información
                </Link>
              </div>
            </div>

            <div className={styles.heroControls}>
              <div className={styles.dots}>
                {featuredGames.map((game, index) => (
                  <button
                    key={game.id}
                    type="button"
                    aria-label={`Mostrar ${game.title}`}
                    aria-current={index === activeIndex ? "true" : undefined}
                    className={index === activeIndex ? styles.dotActive : undefined}
                    onClick={() => setActiveIndex(index)}
                  />
                ))}
              </div>
              <button
                type="button"
                className={styles.pauseButton}
                onClick={() => setPaused((value) => !value)}
                aria-label={paused ? "Reanudar carrusel" : "Pausar carrusel"}
              >
                {paused ? <Play size={15} fill="currentColor" /> : <Pause size={15} fill="currentColor" />}
                {paused ? "Reanudar" : "Pausar"}
              </button>
            </div>
          </article>

          {nextGame ? (
            <button
              type="button"
              className={styles.nextPreview}
              onClick={next}
              aria-label={`Mostrar ${nextGame.title}`}
            >
              {nextGame.heroImage || nextGame.coverImage ? (
                <img src={nextGame.heroImage ?? nextGame.coverImage} alt="" aria-hidden="true" />
              ) : null}
              <span className={styles.previewShade} />
            </button>
          ) : null}

          <button
            type="button"
            className={`${styles.heroArrow} ${styles.heroArrowRight}`}
            aria-label="Juego siguiente"
            onClick={next}
          >
            <ChevronRight size={26} />
          </button>
        </div>

        <section className={styles.quickBar} aria-label="Explorar juegos">
          <div className={styles.welcomeTile}>
            <span className={styles.welcomeIcon}><Gamepad2 size={24} /></span>
            <span>
              <strong>Bienvenido de vuelta</strong>
              <small>¿Qué vamos a jugar hoy?</small>
            </span>
            <i className={styles.liveDot} />
          </div>

          <Link href="/juegos" className={`${styles.quickTile} ${styles.quickActive}`}>
            <Star size={25} />
            <span>Recomendados<br />para ti</span>
          </Link>
          <Link href="/juegos/nuevos" className={styles.quickTile}>
            <Zap size={25} />
            <span>Nuevos<br />lanzamientos</span>
          </Link>
          <Link href="/juegos/populares" className={`${styles.quickTile} ${styles.quickGold}`}>
            <Trophy size={25} />
            <span>Mejor<br />calificados</span>
          </Link>
          <Link href="/juegos?modo=multijugador" className={styles.quickTile}>
            <UsersRound size={25} />
            <span>Multijugador</span>
          </Link>
          <Link href="/juegos?genero=mundo-abierto" className={styles.quickTile}>
            <Globe2 size={25} />
            <span>Mundo<br />abierto</span>
          </Link>
          <Link href="/juegos" className={styles.viewAllQuick}>
            Ver todos <ChevronRight size={17} />
          </Link>
        </section>

        <section className={styles.popularSection} aria-labelledby="home-popular-title">
          <div className={styles.sectionHeading}>
            <h2 id="home-popular-title">
              JUEGOS <strong>POPULARES</strong>
            </h2>
            <Link href="/juegos/populares">
              Ver todos <ChevronRight size={17} />
            </Link>
          </div>

          <div className={styles.popularGrid}>
            {popularGames.map((game) => (
              <article key={game.id} className={styles.gameCard}>
                <Link href={`/juegos/${game.slug}`} className={styles.gameCover}>
                  {game.coverImage ? (
                    <img src={game.coverImage} alt={game.imageAlt} />
                  ) : null}
                  <span className={styles.coverFade} />
                  <span className={styles.platformIcon}><Monitor size={16} /></span>
                </Link>

                <button
                  type="button"
                  className={styles.favoriteButton}
                  aria-label={`Agregar ${game.title} a favoritos`}
                >
                  <Heart size={20} strokeWidth={1.8} />
                </button>

                <div className={styles.gameInfo}>
                  <Link href={`/juegos/${game.slug}`}>{game.title}</Link>
                  <div className={styles.ratingRow}>
                    <Star size={17} fill="currentColor" />
                    <strong>{game.rating?.toFixed(1) ?? "—"}</strong>
                    <span>({game.reviews ?? "—"})</span>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <Link href="/juegos/populares" className={styles.carouselNext} aria-label="Ver más juegos populares">
            <ChevronRight size={25} />
          </Link>
        </section>
      </div>
    </section>
  );
}
