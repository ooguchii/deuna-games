export const homeSectionIds = [
  "hero",
  "popular",
  "finder",
  "classifications",
  "recent",
  "updates",
  "lowSpec",
  "recommended",
  "trust",
] as const;

export type HomeSectionId =
  (typeof homeSectionIds)[number];

export type HomeSectionConfig = {
  id: HomeSectionId;
  visible: boolean;
};

export const homeCurationCollectionIds = [
  "hero",
  "popular",
  "lowSpec",
  "recommended",
] as const;

export type HomeCurationCollectionId =
  (typeof homeCurationCollectionIds)[number];

export type HomeCurationMode =
  | "manual"
  | "automatic"
  | "hybrid";

export type HomeCurationConfig = Record<
  HomeCurationCollectionId,
  {
    mode: HomeCurationMode;
  }
>;

export type HomeCopy = {
  hero: {
    accessibleTitle: string;
    primaryCta: string;
    secondaryCta: string;
  };
  popular: {
    title: string;
    highlight: string;
    linkLabel: string;
  };
  finder: {
    eyebrow: string;
    title: string;
    highlight: string;
    text: string;
    features: [string, string, string];
    cta: string;
  };
  classifications: {
    title: string;
    highlight: string;
    linkLabel: string;
  };
  recent: {
    title: string;
    highlight: string;
    linkLabel: string;
  };
  updates: {
    title: string;
    highlight: string;
    linkLabel: string;
    badgeLabel: string;
    detailsLabel: string;
  };
  lowSpec: {
    eyebrow: string;
    title: string;
    highlight: string;
    text: string;
    cta: string;
    optionTitles: [string, string, string, string];
    optionSubtitles: [string, string, string, string];
    listTitle: string;
    listHighlight: string;
    listLinkLabel: string;
  };
  recommended: {
    eyebrow: string;
    title: string;
    highlight: string;
    text: string;
    linkLabel: string;
  };
  trust: {
    items: [
      { title: string; text: string },
      { title: string; text: string },
      { title: string; text: string },
      { title: string; text: string },
    ];
  };
};

export const homeHeroCompositionIds = [
  "studio",
  "cinema",
  "focus",
] as const;

export type HomeHeroPresentation = {
  composition: (typeof homeHeroCompositionIds)[number];
  previewCount: 1 | 2 | 3;
  motion: "depth" | "slide" | "fade";
  autoplayMs: 0 | 4000 | 6500 | 8000;
};

export type HomeConfig = {
  /*
   * Estas listas conservan compatibilidad con todas las revisiones ya
   * publicadas. En modo manual representan la selección exacta; en híbrido
   * son los juegos fijados por el editor; en automático se conservan pero el
   * ranking decide la colección visible.
   */
  heroSlugs: string[];
  popularSlugs: string[];
  lowSpecSlugs: string[];
  recommendedSlugs: string[];
  curation?: HomeCurationConfig;
  heroPresentation?: HomeHeroPresentation;
  sections?: HomeSectionConfig[];
  copy?: HomeCopy;
};

export type ResolvedHomeConfig = Omit<
  HomeConfig,
  "curation" | "heroPresentation" | "sections" | "copy"
> & {
  curation: HomeCurationConfig;
  heroPresentation: HomeHeroPresentation;
  sections: HomeSectionConfig[];
  copy: HomeCopy;
};

/*
 * Las revisiones antiguas no guardaban `curation`. Hero, Populares y
 * Recomendados funcionaban como prioridades + relleno automático; por eso se
 * resuelven como híbridos. Bajos recursos nunca se rellenaba arbitrariamente.
 */
const defaultHomeCuration: HomeCurationConfig = {
  hero: { mode: "hybrid" },
  popular: { mode: "hybrid" },
  lowSpec: { mode: "manual" },
  recommended: { mode: "hybrid" },
};

const defaultHeroPresentation: HomeHeroPresentation = {
  composition: "studio",
  previewCount: 2,
  motion: "depth",
  autoplayMs: 6500,
};

export const sourceHomeConfig: ResolvedHomeConfig = {
  heroSlugs: [
    "dragon-ball-sparking-zero",
    "god-of-war-ragnarok",
    "forza-horizon-5",
    "resident-evil-4",
    "cyberpunk-2077",
  ],
  popularSlugs: [
    "god-of-war-ragnarok",
    "elden-ring",
    "forza-horizon-5",
    "resident-evil-4",
    "hogwarts-legacy",
    "cyberpunk-2077",
    "baldurs-gate-3",
  ],
  lowSpecSlugs: [
    "minecraft-java-edition",
    "left-4-dead-2",
    "gta-san-andreas",
    "terraria",
    "half-life-2",
    "portal-2",
    "stardew-valley",
  ],
  recommendedSlugs: [
    "cyberpunk-2077",
    "baldurs-gate-3",
    "red-dead-redemption-2",
    "lies-of-p",
    "armored-core-vi",
    "god-of-war-ragnarok",
    "elden-ring",
  ],
  curation: structuredClone(defaultHomeCuration),
  heroPresentation: structuredClone(defaultHeroPresentation),
  sections: homeSectionIds.map((id) => ({
    id,
    visible: true,
  })),
  copy: {
    hero: {
      accessibleTitle: "Descubre juegos para PC",
      primaryCta: "Ver juego",
      secondaryCta: "Más información",
    },
    popular: {
      title: "JUEGOS",
      highlight: "POPULARES",
      linkLabel: "Ver todos",
    },
    finder: {
      eyebrow: "COMPATIBILIDAD DE JUEGOS",
      title: "¿Buscas algo que",
      highlight: "funcione en tu PC?",
      text:
        "Detectamos lo que tu navegador permita identificar y, si falta algún dato, completas CPU, GPU y RAM para obtener FPS orientativos según resolución y calidad.",
      features: [
        "Detección local",
        "FPS orientativos",
        "Configuración manual",
      ],
      cta: "Descubrir qué puedo jugar",
    },
    classifications: {
      title: "CLASIFICACIONES",
      highlight: "DESTACADAS",
      linkLabel: "Ver todo el catálogo",
    },
    recent: {
      title: "AÑADIDOS",
      highlight: "RECIENTEMENTE",
      linkLabel: "Ver todos los añadidos",
    },
    updates: {
      title: "ÚLTIMAS",
      highlight: "ACTUALIZACIONES",
      linkLabel: "Ver todas las actualizaciones",
      badgeLabel: "ACTUALIZADO",
      detailsLabel: "Ver juego",
    },
    lowSpec: {
      eyebrow: "SEGÚN TU EQUIPO",
      title: "Encuentra juegos para",
      highlight: "tu PC",
      text:
        "Explora el catálogo usando los requisitos disponibles, el rendimiento esperado y filtros que ya funcionan hoy.",
      cta: "Probar recomendador",
      optionTitles: [
        "Bajos recursos",
        "Con requisitos cargados",
        "Mejor puntuados",
        "Añadidos recientemente",
      ],
      optionSubtitles: [
        "Juegos pensados para equipos modestos",
        "Compara memoria, gráficos y sistema",
        "Ordenados por valoración",
        "Los últimos títulos incorporados",
      ],
      listTitle: "RECOMENDADOS PARA EQUIPOS",
      listHighlight: "DE BAJOS RECURSOS",
      listLinkLabel: "Ver todos",
    },
    recommended: {
      eyebrow: "PARA DESCUBRIR",
      title: "JUEGOS",
      highlight: "RECOMENDADOS",
      text:
        "Una selección de juegos que creemos que vale la pena conocer.",
      linkLabel: "Ver catálogo",
    },
    trust: {
      items: [
        {
          title: "Versiones identificadas",
          text:
            "Cuando un juego tiene una versión registrada, la mostramos junto con su información.",
        },
        {
          title: "Requisitos claros",
          text:
            "Cuando hay requisitos disponibles, puedes consultarlos rápidamente desde el catálogo.",
        },
        {
          title: "Contenido organizado",
          text: "Cada juego, versión y actualización en su lugar.",
        },
        {
          title: "Rápido y directo",
          text:
            "Menos vueltas y más tiempo descubriendo qué jugar.",
        },
      ],
    },
  },
};

function resolveSections(
  sections: HomeSectionConfig[] | undefined
) {
  const known = new Set<HomeSectionId>();
  const ordered: HomeSectionConfig[] = [];

  for (const section of sections ?? []) {
    if (
      !homeSectionIds.includes(section.id) ||
      known.has(section.id)
    ) {
      continue;
    }

    known.add(section.id);
    ordered.push({ ...section });
  }

  for (const section of sourceHomeConfig.sections) {
    if (!known.has(section.id)) {
      ordered.push({ ...section });
    }
  }

  return ordered;
}

function resolveCuration(
  curation: HomeCurationConfig | undefined
): HomeCurationConfig {
  return {
    hero: {
      ...defaultHomeCuration.hero,
      ...curation?.hero,
    },
    popular: {
      ...defaultHomeCuration.popular,
      ...curation?.popular,
    },
    lowSpec: {
      ...defaultHomeCuration.lowSpec,
      ...curation?.lowSpec,
    },
    recommended: {
      ...defaultHomeCuration.recommended,
      ...curation?.recommended,
    },
  };
}

export function resolveHomeConfig(
  config: HomeConfig
): ResolvedHomeConfig {
  return {
    heroSlugs: [...config.heroSlugs],
    popularSlugs: [...config.popularSlugs],
    lowSpecSlugs: [...config.lowSpecSlugs],
    recommendedSlugs: [...config.recommendedSlugs],
    curation: resolveCuration(config.curation),
    heroPresentation: {
      ...defaultHeroPresentation,
      ...config.heroPresentation,
    },
    sections: resolveSections(config.sections),
    copy: config.copy
      ? {
          ...sourceHomeConfig.copy,
          ...config.copy,
        }
      : structuredClone(sourceHomeConfig.copy),
  };
}
