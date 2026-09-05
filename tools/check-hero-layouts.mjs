import assert from 'node:assert/strict';
import { resolveHomeConfig, sourceHomeConfig } from '../src/data/home-config.ts';
import { applyHeroLayout, applyPreset, carouselLayouts } from '../src/lib/home/hero-presets.ts';
import { homeHeroVisiblePositions, homeHeroAnchor, homeHeroSlotCSS, fitHomeHeroBounds } from '../src/lib/home/hero-layout.ts';
import { HOME_HERO_MAX_SLIDES } from '../src/lib/home/hero-contract.ts';
import { homeHeroEditorFormSchema } from '../src/lib/admin/home-config-forms.ts';
import { resolveHomeCollectionGames } from '../src/lib/home/ranking.ts';
import { editorialHomeConfigSchema } from '../src/lib/admin/content-validation-core.ts';
import { games } from '../src/data/games.ts';

const baseline = resolveHomeConfig(sourceHomeConfig).heroPresentation;
const original = structuredClone(baseline);
const parse = (presentation) => homeHeroEditorFormSchema.safeParse({ expectedRevision: '1', heroJson: JSON.stringify({ mode: 'manual', slugs: [], copy: sourceHomeConfig.copy.hero, presentation }) });
for (const { id } of carouselLayouts) {
  const presentation = applyHeroLayout(id, baseline);
  assert.ok(parse(presentation).success, `${id} must persist through the admin schema`);
  const saved = editorialHomeConfigSchema.safeParse({ ...sourceHomeConfig, heroPresentation: presentation });
  assert.ok(saved.success, `${id} must survive the draft/publication validation: ${saved.error?.message}`);
  assert.deepEqual(resolveHomeConfig(saved.data).heroPresentation, presentation);
  for (const device of ['desktop', 'tablet', 'mobile']) {
    const settings = presentation.responsive[device];
    for (const count of [0, 1, 2, 3, 4, 5]) {
      const slots = homeHeroVisiblePositions(settings, presentation.direction, count);
      assert.ok(slots.includes('main'));
      assert.ok(slots.length <= Math.max(count, 1));
      if (id === 'left' || id === 'duo') assert.ok(!slots.some(slot => slot.startsWith('left')));
      if (id === 'right') assert.ok(!slots.some(slot => slot.startsWith('right')));
      if (id === 'single') assert.deepEqual(slots, ['main']);
    }
    const hidden = { ...settings, hiddenPositions: ['left1', 'left2', 'right1', 'right2'] };
    assert.deepEqual(homeHeroVisiblePositions(hidden, presentation.direction, 5), ['main']);
  }
}
assert.deepEqual(baseline, original, 'Applying layouts must not mutate saved configuration');
const left = applyHeroLayout('left', baseline);
assert.equal(left.direction, 'forward');
assert.equal(homeHeroAnchor(left.responsive.desktop), 'calc(var(--hero-card-width) / 2)', 'Left layouts must align the main card to the Home content edge without a second inset');
assert.deepEqual(homeHeroVisiblePositions({ ...left.responsive.desktop, hiddenPositions: ['right1'] }, 'forward', 2), ['main'], 'Hidden positions must not produce duplicate games in short carousels');
const right = applyHeroLayout('right', baseline);
assert.equal(right.direction, 'reverse');
assert.equal(homeHeroAnchor(right.responsive.desktop), 'calc(100% - var(--hero-card-width) / 2)', 'Right layouts must align the main card to the opposite Home content edge');
assert.deepEqual(applyPreset('Classic', applyPreset('Spotlight', baseline)), applyPreset('Classic', baseline), 'Presets must reset the visual properties they own');
const old = structuredClone(baseline);
for (const settings of Object.values(old.responsive)) { delete settings.alignment; delete settings.hiddenPositions; }
assert.ok(parse(old).success, 'Existing saved drafts must remain valid');
assert.deepEqual(homeHeroVisiblePositions(old.responsive.desktop, 'forward', 5), ['left2', 'left1', 'main', 'right1', 'right2']);
const legacyManualAutoplay = resolveHomeConfig({
  ...sourceHomeConfig,
  heroPresentation: { ...baseline, autoplay: true, autoplayMs: 0 },
}).heroPresentation;
assert.equal(legacyManualAutoplay.autoplayMs, 0);
assert.equal(legacyManualAutoplay.autoplay, false, 'Legacy autoplayMs=0 must remain manual instead of inheriting an enabled autoplay switch');
assert.equal(parse({ ...left, responsive: { ...left.responsive, desktop: { ...left.responsive.desktop, hiddenPositions: ['main'] } } }).success, false);
assert.equal(parse({ ...left, responsive: { ...left.responsive, desktop: { ...left.responsive.desktop, visibleCards: 0 } } }).success, false);
const pinned = games.slice(0, 5).map(game => game.slug);
assert.equal(resolveHomeCollectionGames(games, 'hero', 'hybrid', pinned, 5).length, 5, 'A full mixed selection must not grow beyond the limit');
assert.deepEqual(resolveHomeCollectionGames(games, 'hero', 'manual', pinned, 5).map(game => game.slug), pinned);
const tooManySlugs = games.slice(0, HOME_HERO_MAX_SLIDES + 1).map(game => game.slug);
assert.equal(homeHeroEditorFormSchema.safeParse({
  expectedRevision: '1',
  heroJson: JSON.stringify({ mode: 'manual', slugs: tooManySlugs, copy: sourceHomeConfig.copy.hero, presentation: baseline }),
}).success, false, 'The unified Hero editor must reject more games than the public Hero can display');
console.log('Hero layouts: OK (persistence, legacy drafts, layouts, hidden slots, presets, autoplay compatibility, five-slide contract and mixed selection).');

// Large/translated compositions must keep every enabled card within the frame.
for (const alignment of ['left', 'center', 'right']) {
  for (const [width, height] of [[300, 400], [680, 500], [1440, 700]]) {
    for (const bounds of [
      { left: -800, top: -100, right: 1900, bottom: 800 },
      { left: 100, top: 50, right: 600, bottom: 400 },
      { left: -2000, top: -1000, right: 4000, bottom: 3000 },
    ]) {
      const fit = fitHomeHeroBounds(bounds, width, height, alignment);
      assert.ok(fit.scale > 0 && fit.scale <= 1);
      assert.ok(bounds.left * fit.scale + fit.x >= -1e-6);
      assert.ok(bounds.right * fit.scale + fit.x <= width + 1e-6);
      assert.ok(bounds.top * fit.scale + fit.y >= 48 - 1e-6);
      assert.ok(bounds.bottom * fit.scale + fit.y <= height - 48 + 1e-6);
    }
  }
}
assert.equal(homeHeroSlotCSS('main'), '0px');
assert.ok(homeHeroSlotCSS('right2').includes('var(--hero-card-width)'));
console.log('Hero fitting: OK (Home-grid horizontal alignment, vertical control clearance, perspective overflow and all alignments).');

assert.deepEqual(fitHomeHeroBounds({ left: 100, top: 60, right: 600, bottom: 400 }, 1440, 700), { scale: 1, x: 0, y: 0 }, 'Fitting must not cancel manual translations when the cards already fit');
