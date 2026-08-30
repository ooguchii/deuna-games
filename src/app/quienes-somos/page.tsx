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
  absoluteUrl,
} from "@/lib/site";
import {
  getPublicSiteConfig,
} from "@/lib/site/public-site-config";
import {
  safeJsonLd,
} from "@/lib/safe-json-ld";

import styles from "./page.module.css";

const principles = [
  {
    icon: Search,
    eyebrow: "CLARIDAD",
    title: "Menos ruido. Más respuesta.",
    text:
      "La información importante tiene que encontrarse rápido: qué es el juego, qué necesita y en qué versión está.",
  },
  {
    icon: Monitor,
    eyebrow: "COMPATIBILIDAD",
    title: "Entender tu PC sin complicarte.",
    text:
      "Queremos traducir requisitos y hardware a decisiones simples para que sepas qué puedes jugar antes de perder tiempo.",
  },
  {
    icon: RefreshCcw,
    eyebrow: "ACTUALIZACIÓN",
    title: "Una versión clara por juego.",
    text:
      "Cada título puede mantener su información y su versión vigente en un mismo lugar, sin mezclar publicaciones innecesarias.",
  },
];

const ecosystem = [
  {
    icon: Compass,
    title: "Descubrimiento",
    text:
      "Catálogo, categorías, recomendaciones y filtros para encontrar algo que realmente quieras jugar.",
  },
  {
    icon: Layers3,
    title: "Información ordenada",
    text:
      "Juego, requisitos, versión y actualización pensados como partes de una misma experiencia.",
  },
  {
    icon: RefreshCcw,
    title: "Versiones al día",
    text:
      "Cada juego mantiene su información, su versión vigente y sus actualizaciones dentro de una experiencia coherente.",
  },
];

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
  const config = await getPublicSiteConfig();
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
              Encontrar qué jugar
              <span> debería ser simple.</span>
            </h1>

            <p>
              {config.name} nace con una idea concreta:
              ordenar lo que hoy suele estar disperso.
              Juegos, requisitos, versiones y actualizaciones
              en una experiencia directa, clara y fácil de usar.
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

            <div className={styles.signalLine}>
              <span className={styles.signalNumber}>
                01
              </span>
              <div>
                <strong>Encontrar</strong>
                <p>
                  Descubre opciones sin recorrer
                  información desordenada.
                </p>
              </div>
            </div>

            <div className={styles.signalLine}>
              <span className={styles.signalNumber}>
                02
              </span>
              <div>
                <strong>Entender</strong>
                <p>
                  Requisitos y versiones presentados
                  de forma simple.
                </p>
              </div>
            </div>

            <div className={styles.signalLine}>
              <span className={styles.signalNumber}>
                03
              </span>
              <div>
                <strong>Jugar</strong>
                <p>
                  Menos vueltas entre descubrir un juego
                  y decidir si es para ti.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section
          className={styles.introSection}
          aria-labelledby="what-is-title"
        >
          <div className={styles.sectionHeading}>
            <span>QUÉ ES {shortName.toUpperCase()}</span>
            <h2 id="what-is-title">
              Un lugar pensado para
              <strong> decidir mejor.</strong>
            </h2>
          </div>

          <div className={styles.introCopy}>
            <p>
              No queremos sumar otra pantalla llena de datos.
              Queremos que cada pieza tenga un propósito:
              ayudarte a encontrar un juego, entenderlo y saber
              qué necesitás para disfrutarlo.
            </p>

            <p>
              Por eso el catálogo, los requisitos, las versiones
              y las actualizaciones se diseñan como partes de un
              mismo sistema, no como secciones aisladas.
            </p>
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
            {principles.map((item) => {
              const Icon = item.icon;

              return (
                <article
                  key={item.eyebrow}
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
              La información sirve cuando
              <span> te ayuda a decidir.</span>
            </h2>

            <p>
              Buscar un juego no debería significar abrir diez
              pestañas para descubrir qué versión existe, qué pide
              o si puede funcionar en tu equipo.
            </p>

            <p>
              {shortName} intenta reducir esa fricción: presentar lo
              importante con jerarquía, mantener cada juego ligado
              a su información y hacer que la navegación tenga una
              lógica clara de principio a fin.
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
            {ecosystem.map((item) => {
              const Icon = item.icon;

              return (
                <article
                  key={item.title}
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
            No queremos que pases más tiempo buscando
            información que <span>encontrando tu próximo juego.</span>
          </h2>

          <p>
            Ese es el criterio que queremos mantener a medida que
            {" "}{shortName} crezca: claridad, utilidad y una experiencia que
            no te haga dar vueltas de más.
          </p>
        </section>

        <section
          className={styles.ctaSection}
          aria-labelledby="cta-title"
        >
          <div>
            <span>EMPEZÁ POR ACÁ</span>
            <h2 id="cta-title">
              Encuentra algo que quieras jugar hoy.
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
