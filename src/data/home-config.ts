export type HomeConfig = {
  heroSlugs: string[];
  popularSlugs: string[];
  lowSpecSlugs: string[];
  recommendedSlugs: string[];
};

export const sourceHomeConfig: HomeConfig = {
  heroSlugs: [
    "dragon-ball-sparking-zero",
    "god-of-war-ragnarok",
    "forza-horizon-5",
    "resident-evil-4",
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
};
