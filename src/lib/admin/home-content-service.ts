import "server-only";

import {
  resolveHomeConfig,
  type HomeCopy,
  type HomeCurationMode,
  type HomeHeroPresentation,
  type HomeSectionConfig,
} from "@/data/home-config";

import {
  getEditorialItem,
  saveHomeConfigDraft,
  type EditorialMutationResult,
} from "./content-service";

export type HomeCurationDraftInput = {
  hero: { mode: HomeCurationMode; slugs: string[] };
  popular: { mode: HomeCurationMode; slugs: string[] };
  lowSpec: { mode: HomeCurationMode; slugs: string[] };
  recommended: { mode: HomeCurationMode; slugs: string[] };
};

export type HomePresentationDraftInput = {
  sections: HomeSectionConfig[];
  copy: Omit<HomeCopy, "hero">;
};

export type HomeHeroDraftInput = {
  mode: HomeCurationMode;
  slugs: string[];
  presentation: HomeHeroPresentation;
};

async function getResolvedHomeDraft() {
  const item = await getEditorialItem(
    "home_config",
    "home"
  );

  if (!item) return null;

  return {
    item,
    current: resolveHomeConfig(item.payload),
  };
}

export async function saveHomeCurationDraft(
  expectedRevision: number,
  actorUserId: string,
  input: HomeCurationDraftInput
): Promise<EditorialMutationResult> {
  const resolved = await getResolvedHomeDraft();
  if (!resolved) return { outcome: "not_found" };

  const { current } = resolved;

  return saveHomeConfigDraft(
    expectedRevision,
    actorUserId,
    {
      heroSlugs: input.hero.slugs,
      popularSlugs: input.popular.slugs,
      lowSpecSlugs: input.lowSpec.slugs,
      recommendedSlugs: input.recommended.slugs,
      curation: {
        hero: { mode: input.hero.mode },
        popular: { mode: input.popular.mode },
        lowSpec: { mode: input.lowSpec.mode },
        recommended: { mode: input.recommended.mode },
      },
      heroPresentation: current.heroPresentation,
      sections: current.sections,
      copy: current.copy,
    }
  );
}

export async function saveHomePresentationDraft(
  expectedRevision: number,
  actorUserId: string,
  input: HomePresentationDraftInput
): Promise<EditorialMutationResult> {
  const resolved = await getResolvedHomeDraft();
  if (!resolved) return { outcome: "not_found" };

  const { current } = resolved;

  return saveHomeConfigDraft(
    expectedRevision,
    actorUserId,
    {
      heroSlugs: current.heroSlugs,
      popularSlugs: current.popularSlugs,
      lowSpecSlugs: current.lowSpecSlugs,
      recommendedSlugs: current.recommendedSlugs,
      curation: current.curation,
      heroPresentation: current.heroPresentation,
      sections: input.sections,
      copy: {
        hero: current.copy.hero,
        ...input.copy,
      },
    }
  );
}

export async function saveHomeHeroDraft(
  expectedRevision: number,
  actorUserId: string,
  input: HomeHeroDraftInput
): Promise<EditorialMutationResult> {
  const resolved = await getResolvedHomeDraft();
  if (!resolved) return { outcome: "not_found" };

  const { current } = resolved;

  return saveHomeConfigDraft(
    expectedRevision,
    actorUserId,
    {
      heroSlugs: input.slugs,
      popularSlugs: current.popularSlugs,
      lowSpecSlugs: current.lowSpecSlugs,
      recommendedSlugs: current.recommendedSlugs,
      curation: {
        ...current.curation,
        hero: { mode: input.mode },
      },
      heroPresentation: input.presentation,
      sections: current.sections,
      copy: current.copy,
    }
  );
}
