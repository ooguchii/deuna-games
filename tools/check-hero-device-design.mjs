import assert from 'node:assert/strict';
import { sourceHomeConfig, resolveHomeConfig } from '../src/data/home-config.ts';
import { applyHeroLayout, applyPreset } from '../src/lib/home/hero-presets.ts';
import { resolveHeroDeviceDesign, updateHeroDeviceDesign } from '../src/lib/home/hero-device-design.ts';
import { homeHeroPresentationEditorSchema, homeHeroPresentationInputSchema } from '../src/lib/home/hero-schema.ts';
import { homeHeroEditorFormSchema } from '../src/lib/admin/home-config-forms.ts';
import { editorialHomeConfigSchema } from '../src/lib/admin/content-validation-core.ts';
const original = structuredClone(sourceHomeConfig.heroPresentation);
const mobile = updateHeroDeviceDesign(original, 'mobile', p => applyPreset('Cinema', applyHeroLayout('single', p)));
const resolvedDesktop = resolveHeroDeviceDesign(mobile, 'desktop');
const resolvedTablet = resolveHeroDeviceDesign(mobile, 'tablet');
const resolvedMobile = resolveHeroDeviceDesign(mobile, 'mobile');
assert.equal(resolvedDesktop.composition, original.composition);
assert.equal(resolvedTablet.composition, original.composition);
assert.deepEqual(resolvedDesktop.positions, original.positions);
assert.deepEqual(resolvedTablet.positions, original.positions);
assert.deepEqual(resolvedDesktop.responsive.desktop, original.responsive.desktop);
assert.deepEqual(resolvedTablet.responsive.tablet, original.responsive.tablet);
assert.deepEqual(resolvedDesktop.responsive.mobile, resolvedMobile.responsive.mobile);
assert.deepEqual(resolvedTablet.responsive.mobile, resolvedMobile.responsive.mobile);
assert.deepEqual(
  resolvedDesktop.navigation.responsive.mobile,
  resolvedMobile.navigation.responsive.mobile
);
assert.equal(resolvedMobile.responsive.mobile.visibleCards, 1);
assert.equal(resolvedMobile.composition, 'cinema');
const stored = homeHeroPresentationInputSchema.parse(JSON.parse(JSON.stringify(homeHeroPresentationEditorSchema.parse(mobile))));
assert.deepEqual(resolveHomeConfig({...sourceHomeConfig, heroPresentation: stored}).heroPresentation, mobile);
const all = updateHeroDeviceDesign(mobile, 'all', p => { p.radius = 25; p.responsive.mobile.gap = 43; return p; }, 'mobile');
for (const device of ['desktop','tablet','mobile']) {
 assert.equal(resolveHeroDeviceDesign(all,device).radius,25);
 assert.equal(resolveHeroDeviceDesign(all,device).responsive[device].gap,43);
}
assert.equal(resolveHeroDeviceDesign(all,'mobile').composition,'cinema');
assert.deepEqual(original,sourceHomeConfig.heroPresentation);
assert.equal(homeHeroPresentationEditorSchema.safeParse({...mobile,deviceOverrides:{mobile:{...original,deviceOverrides:{mobile:original}}}}).success,false);
console.log('Hero device design: OK (isolated presets/layouts, effective cross-device slots, shared edits, persistence, legacy fallback, bounded validation).');

let full = original;
for (const device of ['desktop','tablet','mobile']) full = updateHeroDeviceDesign(full, device, p => applyPreset('Cinema', p));
assert.ok(homeHeroEditorFormSchema.safeParse({expectedRevision:'1',heroJson:JSON.stringify({mode:'manual',slugs:sourceHomeConfig.heroSlugs,presentation:full})}).success);
console.log('Hero form: OK (all three device designs fit and survive form validation).');
const persistedHome = editorialHomeConfigSchema.parse({ ...sourceHomeConfig, heroPresentation: full });
assert.deepEqual(persistedHome.heroPresentation, full);
assert.deepEqual(resolveHomeConfig(JSON.parse(JSON.stringify(persistedHome))).heroPresentation, full);
assert.equal(editorialHomeConfigSchema.safeParse({
  ...sourceHomeConfig,
  heroPresentation: { ...full, deviceOverrides: { mobile: { ...original, deviceOverrides: { mobile: original } } } },
}).success, false);
console.log('Hero editorial persistence: OK (device designs survive Home validation and reload; nested overrides rejected).');

// Reproduce a subtle shared-edit case: an override can already have the requested
// source-device value in its copied desktop slot while its own slot is divergent.
// A later "all devices" edit must still propagate the source change to that slot.
let divergent = updateHeroDeviceDesign(original, 'all', design => {
  design.responsive.desktop.gap = 79;
  design.navigation.responsive.desktop.y = 20;
  return design;
}, 'desktop');
divergent = updateHeroDeviceDesign(divergent, 'mobile', design => {
  design.responsive.mobile.gap = 31;
  design.navigation.responsive.mobile.y = 80;
  return design;
});
divergent = updateHeroDeviceDesign(divergent, 'desktop', design => {
  design.responsive.desktop.gap = 42;
  design.navigation.responsive.desktop.y = 40;
  return design;
});
divergent = updateHeroDeviceDesign(divergent, 'all', design => {
  design.responsive.desktop.gap = 79;
  design.navigation.responsive.desktop.y = 20;
  return design;
}, 'desktop');
for (const device of ['desktop', 'tablet', 'mobile']) {
  assert.equal(resolveHeroDeviceDesign(divergent, device).responsive[device].gap, 79);
  assert.equal(resolveHeroDeviceDesign(divergent, device).navigation.responsive[device].y, 20);
}
console.log('Hero shared edits: OK (divergent device snapshots receive the same requested change).');

// Linking spacing is different from changing one numeric control: the editor
// copies the selected device spacing into all three responsive slots at once.
// Before linking, a selected override must already expose the effective slots
// owned by the other devices instead of historical copies inside that snapshot.
let linkedSpacing = original;
linkedSpacing = updateHeroDeviceDesign(linkedSpacing, 'desktop', design => {
  design.responsive.desktop.spaceBefore = 11;
  design.responsive.desktop.spaceAfter = 17;
  design.responsive.desktop.spacingReference = 'canvas';
  design.navigation.responsive.desktop.y = 24;
  return design;
});
linkedSpacing = updateHeroDeviceDesign(linkedSpacing, 'tablet', design => {
  design.responsive.tablet.spaceBefore = 33;
  design.responsive.tablet.spaceAfter = 47;
  design.responsive.tablet.spacingReference = 'visual';
  design.navigation.responsive.tablet.y = 66;
  return design;
});
linkedSpacing = updateHeroDeviceDesign(linkedSpacing, 'mobile', design => {
  design.responsive.mobile.spaceBefore = 55;
  design.responsive.mobile.spaceAfter = 69;
  design.responsive.mobile.spacingReference = 'canvas';
  design.navigation.responsive.mobile.y = 82;
  return design;
});
const effectiveDesktop = resolveHeroDeviceDesign(linkedSpacing, 'desktop');
const effectiveTablet = resolveHeroDeviceDesign(linkedSpacing, 'tablet');
const effectiveMobile = resolveHeroDeviceDesign(linkedSpacing, 'mobile');
assert.deepEqual(effectiveTablet.responsive.desktop, effectiveDesktop.responsive.desktop);
assert.deepEqual(effectiveTablet.responsive.mobile, effectiveMobile.responsive.mobile);
assert.deepEqual(
  effectiveTablet.navigation.responsive.desktop,
  effectiveDesktop.navigation.responsive.desktop
);
assert.deepEqual(
  effectiveTablet.navigation.responsive.mobile,
  effectiveMobile.navigation.responsive.mobile
);
const selectedTabletSpacing = structuredClone(effectiveTablet.responsive.tablet);
linkedSpacing = updateHeroDeviceDesign(linkedSpacing, 'all', design => {
  const source = design.responsive.tablet;
  for (const device of ['desktop', 'tablet', 'mobile']) {
    design.responsive[device].spaceBefore = source.spaceBefore;
    design.responsive[device].spaceAfter = source.spaceAfter;
    design.responsive[device].spacingReference = source.spacingReference;
  }
  return design;
}, 'tablet');
for (const device of ['desktop', 'tablet', 'mobile']) {
  const effective = resolveHeroDeviceDesign(linkedSpacing, device).responsive[device];
  assert.equal(effective.spaceBefore, selectedTabletSpacing.spaceBefore);
  assert.equal(effective.spaceAfter, selectedTabletSpacing.spaceAfter);
  assert.equal(effective.spacingReference, selectedTabletSpacing.spacingReference);
}
console.log('Hero linked spacing: OK (effective cross-device baselines stay current and the selected device remains the single source).');
