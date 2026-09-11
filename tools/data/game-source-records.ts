export type GameSourceRecord = {
  slug: string;
  verifiedAt: string;
  sources: string[];
};

/*
 * Procedencia de los datos factuales incluidos en games.ts.
 *
 * Este registro no se publica como contenido del juego: existe para que el
 * fixture bundled sea auditable y para evitar que datos de demostración se
 * confundan con información real. Ratings, conteos de reseñas, versiones y
 * benchmarks cambian con el tiempo y quedan deliberadamente fuera del fixture.
 */
export const gameSourceRecords: GameSourceRecord[] = [
  {
    slug: "dragon-ball-sparking-zero",
    verifiedAt: "2026-09-10",
    sources: [
      "https://store.steampowered.com/app/1790600/DRAGON_BALL_Sparking_ZERO/",
    ],
  },
  {
    slug: "god-of-war-ragnarok",
    verifiedAt: "2026-09-10",
    sources: [
      "https://www.playstation.com/es-ar/games/god-of-war-ragnarok/pc/",
      "https://store.steampowered.com/app/2322010/God_of_War_Ragnarok/",
    ],
  },
  {
    slug: "elden-ring",
    verifiedAt: "2026-09-10",
    sources: [
      "https://store.steampowered.com/app/1245620/ELDEN_RING/",
    ],
  },
  {
    slug: "forza-horizon-5",
    verifiedAt: "2026-09-10",
    sources: [
      "https://store.steampowered.com/app/1551360/Forza_Horizon_5/",
    ],
  },
  {
    slug: "resident-evil-4",
    verifiedAt: "2026-09-10",
    sources: [
      "https://store.steampowered.com/app/2050650/Resident_Evil_4/",
    ],
  },
  {
    slug: "hogwarts-legacy",
    verifiedAt: "2026-09-10",
    sources: [
      "https://store.steampowered.com/app/990080/Hogwarts_Legacy/",
    ],
  },
  {
    slug: "cyberpunk-2077",
    verifiedAt: "2026-09-10",
    sources: [
      "https://www.cyberpunk.net/en/news/48271/update-to-pc-system-requirements",
      "https://store.steampowered.com/app/1091500/Cyberpunk_2077/",
    ],
  },
  {
    slug: "baldurs-gate-3",
    verifiedAt: "2026-09-10",
    sources: [
      "https://store.steampowered.com/app/1086940/Baldurs_Gate_3/",
    ],
  },
  {
    slug: "red-dead-redemption-2",
    verifiedAt: "2026-09-10",
    sources: [
      "https://ir.take2games.com/node/26451/pdf",
      "https://store.steampowered.com/app/1174180/Red_Dead_Redemption_2/",
    ],
  },
  {
    slug: "lies-of-p",
    verifiedAt: "2026-09-10",
    sources: [
      "https://store.steampowered.com/app/1627720/Lies_of_P/",
    ],
  },
  {
    slug: "armored-core-vi",
    verifiedAt: "2026-09-10",
    sources: [
      "https://store.steampowered.com/app/1888160/ARMORED_CORE_VI_FIRES_OF_RUBICON/",
      "https://www.bandainamcoent.com/news/armored-core-vi-fires-of-rubicon-available-now",
    ],
  },
  {
    slug: "stellar-blade",
    verifiedAt: "2026-09-10",
    sources: [
      "https://store.steampowered.com/app/3489700/Stellar_Blade/",
    ],
  },
  {
    slug: "palworld",
    verifiedAt: "2026-09-10",
    sources: [
      "https://store.steampowered.com/app/1623730/Palworld/",
    ],
  },
  {
    slug: "enshrouded",
    verifiedAt: "2026-09-10",
    sources: [
      "https://store.steampowered.com/app/1203620/Enshrouded/",
      "https://enshrouded.zendesk.com/hc/en-us/articles/9223643120541-System-Requirements",
    ],
  },
  {
    slug: "helldivers-2",
    verifiedAt: "2026-09-10",
    sources: [
      "https://www.playstation.com/en-us/games/helldivers-2/pc/",
      "https://store.steampowered.com/app/553850/HELLDIVERS_2/",
    ],
  },
  {
    slug: "the-talos-principle-2",
    verifiedAt: "2026-09-10",
    sources: [
      "https://store.steampowered.com/app/835960/The_Talos_Principle_2/",
    ],
  },
  {
    slug: "minecraft-java-edition",
    verifiedAt: "2026-09-10",
    sources: [
      "https://www.minecraft.net/en-us/article/minecraft-java-edition-system-requirements",
    ],
  },
  {
    slug: "left-4-dead-2",
    verifiedAt: "2026-09-10",
    sources: [
      "https://store.steampowered.com/app/550/Left_4_Dead_2/",
    ],
  },
  {
    slug: "gta-san-andreas",
    verifiedAt: "2026-09-10",
    sources: [
      "https://support.rockstargames.com/articles/5Tp0lg9AU5dQZO3M9Tp9vr/grand-theft-auto-san-andreas-pc-system-requirements",
    ],
  },
  {
    slug: "terraria",
    verifiedAt: "2026-09-10",
    sources: [
      "https://store.steampowered.com/app/105600/Terraria/",
    ],
  },
  {
    slug: "half-life-2",
    verifiedAt: "2026-09-10",
    sources: [
      "https://store.steampowered.com/app/220/HalfLife_2/",
    ],
  },
  {
    slug: "portal-2",
    verifiedAt: "2026-09-10",
    sources: [
      "https://store.steampowered.com/app/620/Portal_2/",
    ],
  },
  {
    slug: "stardew-valley",
    verifiedAt: "2026-09-10",
    sources: [
      "https://store.steampowered.com/app/413150/Stardew_Valley/",
    ],
  },
];
