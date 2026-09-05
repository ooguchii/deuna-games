import assert from 'node:assert/strict';
import { sourceHomeConfig, resolveHomeConfig } from '../src/data/home-config.ts';
import { applyHeroLayout, applyPreset } from '../src/lib/home/hero-presets.ts';
import { resolveHeroDeviceDesign, updateHeroDeviceDesign } from '../src/lib/home/hero-device-design.ts';
import { homeHeroPresentationEditorSchema, homeHeroPresentationInputSchema } from '../src/lib/home/hero-schema.ts';
import { homeHeroEditorFormSchema } from '../src/lib/admin/home-config-forms.ts';
import { editorialHomeConfigSchema } from '../src/lib/admin/content-validation-core.ts';
const original = structuredClone(sourceHomeConfig.heroPresentation);
const mobile = updateHeroDeviceDesign(original, 'mobile', p => applyPreset('Cinema', applyHeroLayout('single', p)));
assert.deepEqual(resolveHeroDeviceDesign(mobile, 'desktop'), original);
assert.deepEqual(resolveHeroDeviceDesign(mobile, 'tablet'), original);
assert.equal(resolveHeroDeviceDesign(mobile, 'mobile').responsive.mobile.visibleCards, 1);
assert.equal(resolveHeroDeviceDesign(mobile, 'mobile').composition, 'cinema');
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
console.log('Hero device design: OK (isolated presets/layouts, shared edits, persistence, legacy fallback, bounded validation).');

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
