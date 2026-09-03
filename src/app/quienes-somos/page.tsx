import type { Metadata } from "next";

import Link from "next/link";

import {
  ArrowRight,
  ChevronRight,
  Compass,
  House,
  Layers3,
  Monitor,
  RefreshCcw,
  Search,
  Sparkles,
} from "lucide-react";

import Footer from "@/components/layout/Footer";
import Header from "@/components/layout/Header";

import {
  getPublicAboutConfig,
} from "@/lib/about/public-about-config";
import {
  absoluteUrl,
} from "@/lib/site";
import {
  getPublicSiteConfig,
} from "@/lib/site/public-site-config";
import {
  safeJsonLd,
} from "@/lib/safe-json-ld";

import styles from "./page.module.css";

const principleIcons = [
  Search,
  Monitor,
  RefreshCcw,
] as const;

const ecosystemIcons = [
  Compass,
  Layers3,
  RefreshCcw,
] as const;

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const config = await getPublicSiteConfig();

  return {
    title: "Quiénes somos",
    description:
      `Conoce qué es ${config.name}, por qué existe y cómo busca simplificar el descubrimiento de juegos, requisitos y actualizaciones para PC.`,

    alternates: {
      canonical: "/quienes-somos",
    },

    openGraph: {
      title: `Quiénes somos | ${config.name}`,
      description:
        `${config.name} busca hacer más simple descubrir juegos, entender requisitos y mantener cada versión organizada.`,
      url: "/quienes-somos",
      type: "website",
    },

    twitter: {
      card: "summary_large_image",
      title: `Quiénes somos | ${config.name}`,
      description:
        `Conoce la idea detrás de ${config.name} y la forma en que queremos ordenar el descubrimiento de juegos para PC.`,
    },
  };
}

export default async function AboutPage() {
  const [config, about] = await Promise.all([
    getPublicSiteConfig(),
    getPublicAboutConfig(),
  ]);
  const shortName = config.shortName || config.name;

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Inicio",
        item: absoluteUrl("/"),
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Quiénes somos",
        item: absoluteUrl("/quienes-somos"),
      },
    ],
  };

  const aboutPageJsonLd = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    name: `Quiénes somos | ${config.name}`,
    url: absoluteUrl("/quienes-somos"),
    description:
      `${config.name} busca simplificar el descubrimiento de juegos, requisitos, versiones y actualizaciones para PC.`,
    inLanguage: config.language,
    about: {
      "@type": "Organization",
      name: config.name,
      url: absoluteUrl("/"),
      description: config.description,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: safeJsonLd(
            breadcrumbJsonLd
          ),
        }}
      />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: safeJsonLd(
            aboutPageJsonLd
          ),
        }}
      />

      <Header />

      <main
        id="main-content"
        className={styles.main}
      >
        <nav
          className={styles.breadcrumb}
          aria-label="Migas de pan"
        >
          <Link href="/">
            <House
              size={14}
              aria-hidden="true"
            />
            Inicio
          </Link>

          <ChevronRight
            size={14}
            aria-hidden="true"
          />

          <span aria-current="page">
            Quiénes somos
          </span>
        </nav>

        <section
          className={styles.hero}
          aria-labelledby="about-title"
        >
          <div
            className={styles.heroGrid}
            aria-hidden="true"
          />

          <div
            className={styles.heroOrbOne}
            aria-hidden="true"
          />

          <div
            className={styles.heroOrbTwo}
            aria-hidden="true"
          />

          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}>
              SOBRE {config.name.toUpperCase()}
            </span>

            <h1 id="about-title">
              {about.hero.title}{" "}
              <span>{about.hero.highlight}</span>
            </h1>

            <p>
              {config.name} {about.hero.text}
            </p>

            <div className={styles.heroActions}>
              <Link
                href="/juegos"
                className={styles.primaryAction}
              >
                Explorar juegos
                <ArrowRight
                  size={17}
                  aria-hidden="true"
                />
              </Link>

              <Link
                href="/actualizaciones"
                className={styles.secondaryAction}
              >
                Ver actualizaciones
              </Link>
            </div>
          </div>

          <div className={styles.heroSignal}>
            <span className={styles.signalLabel}>
              NUESTRA IDEA
            </span>

            {about.hero.signals.map((signal, index) => (
              <div
                key={`${signal.title}-${index}`}
                className={styles.signalLine}
              >
                <span className={styles.signalNumber}>
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <strong>{signal.title}</strong>
                  <p>{signal.text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section
          className={styles.introSection}
          aria-labelledby="what-is-title"
        >
          <div className={styles.sectionHeading}>
            <span>QUÉ ES {shortName.toUpperCase()}</span>
            <h2 id="what-is-title">
              {about.intro.title}{" "}
              <strong>{about.intro.highlight}</strong>
            </h2>
          </div>

          <div className={styles.introCopy}>
            {about.intro.paragraphs.map((paragraph, index) => (
              <p key={`${paragraph.slice(0, 30)}-${index}`}>
                {paragraph}
              </p>
            ))}
          </div>
        </section>

        <section
          className={styles.principlesSection}
          aria-labelledby="principles-title"
        >
          <div className={styles.sectionTopline}>
            <div>
              <span>PRINCIPIOS</span>
              <h2 id="principles-title">
                La experiencia antes que el ruido.
              </h2>
            </div>

            <Sparkles
              size={24}
              aria-hidden="true"
            />
          </div>

          <div className={styles.principlesGrid}>
            {about.principles.map((item, index) => {
              const Icon = principleIcons[index] ?? Search;

              return (
                <article
                  key={`${item.eyebrow}-${index}`}
                  className={styles.principleCard}
                >
                  <div className={styles.principleIcon}>
                    <Icon
                      size={24}
                      aria-hidden="true"
                    />
                  </div>

                  <span>{item.eyebrow}</span>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section
          className={styles.reasonSection}
          aria-labelledby="reason-title"
        >
          <div className={styles.reasonVisual}>
            <div
              className={styles.reasonRing}
              aria-hidden="true"
            >
              <span>{shortName}</span>
            </div>

            <div className={styles.reasonBadge}>
              <span>MENOS</span>
              ruido
            </div>

            <div className={styles.reasonBadgeAlt}>
              <span>MÁS</span>
              contexto
            </div>
          </div>

          <div className={styles.reasonCopy}>
            <span className={styles.eyebrow}>
              POR QUÉ EXISTE
            </span>

            <h2 id="reason-title">
              {about.reason.title}{" "}
              <span>{about.reason.highlight}</span>
            </h2>

            <p>{about.reason.paragraphs[0]}</p>

            <p>
              {shortName} {about.reason.paragraphs[1]}
            </p>
          </div>
        </section>

        <section
          className={styles.ecosystemSection}
          aria-labelledby="ecosystem-title"
        >
          <div className={styles.sectionHeadingCentered}>
            <span>UN MISMO SISTEMA</span>
            <h2 id="ecosystem-title">
              Descubrir, entender y mantener.
            </h2>
            <p>
              Tres partes distintas de la misma experiencia.
            </p>
          </div>

          <div className={styles.ecosystemGrid}>
            {about.ecosystem.map((item, index) => {
              const Icon = ecosystemIcons[index] ?? Compass;

              return (
                <article
                  key={`${item.title}-${index}`}
                  className={styles.ecosystemCard}
                >
                  <Icon
                    size={22}
                    aria-hidden="true"
                  />
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section
          className={styles.manifesto}
          aria-labelledby="manifesto-title"
        >
          <span className={styles.manifestoEyebrow}>
            MANIFIESTO {shortName.toUpperCase()}
          </span>

          <h2 id="manifesto-title">
            {about.manifesto.title}{" "}
            <span>{about.manifesto.highlight}</span>
          </h2>

          <p>{about.manifesto.text}</p>
        </section>

        <section
          className={styles.ctaSection}
          aria-labelledby="cta-title"
        >
          <div>
            <span>EMPEZÁ POR ACÁ</span>
            <h2 id="cta-title">
              {about.ctaTitle}
            </h2>
          </div>

          <div className={styles.ctaActions}>
            <Link
              href="/juegos"
              className={styles.primaryAction}
            >
              Ver todos los juegos
              <ArrowRight
                size={17}
                aria-hidden="true"
              />
            </Link>

            <Link
              href="/actualizaciones"
              className={styles.secondaryAction}
            >
              Últimas actualizaciones
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
