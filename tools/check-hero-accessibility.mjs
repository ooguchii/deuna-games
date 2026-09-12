import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [
  source,
  css,
  schema,
  adminControls,
  heroSource,
  motionCss,
  livePreview,
  deviceDesign,
  homeContentService,
] = await Promise.all([
  readFile(
    new URL('../src/components/home/HeroNavigation.tsx', import.meta.url),
    'utf8'
  ),
  readFile(
    new URL('../src/components/home/HeroNavigation.module.css', import.meta.url),
    'utf8'
  ),
  readFile(
    new URL('../src/lib/home/hero-schema.ts', import.meta.url),
    'utf8'
  ),
  readFile(
    new URL('../src/components/admin/HomeHeroNavigationControls.tsx', import.meta.url),
    'utf8'
  ),
  readFile(
    new URL('../src/components/home/HeroSection.tsx', import.meta.url),
    'utf8'
  ),
  readFile(
    new URL('../src/components/home/HeroMotion.module.css', import.meta.url),
    'utf8'
  ),
  readFile(
    new URL('../src/components/admin/HomeHeroLivePreview.tsx', import.meta.url),
    'utf8'
  ),
  readFile(
    new URL('../src/lib/home/hero-device-design.ts', import.meta.url),
    'utf8'
  ),
  readFile(
    new URL('../src/lib/admin/home-content-service.ts', import.meta.url),
    'utf8'
  ),
]);

assert.match(
  source,
  /const announceSlideChanges = isPaused;/,
  'Hero slide announcements must only become live while rotation is paused by user attention, reduced motion, or explicit suspension.'
);
assert.match(
  source,
  /aria-live=\{announceSlideChanges \? "polite" : "off"\}/,
  'Hero navigation must disable live announcements while autoplay is actively rotating.'
);
assert.match(
  source,
  /\$\{activeIndex \+ 1\} de \$\{games\.length\}: \$\{activeGame\.title\}/,
  'The live region must identify the current position and game title.'
);
assert.doesNotMatch(
  source,
  /aria-live="polite"/,
  'Hero live announcements must not be permanently polite during autoplay.'
);
assert.doesNotMatch(
  source,
  /announceSlideChanges = isPaused \|\| atAutoplayEnd/,
  'The final autoplay transition must remain silent unless the carousel is otherwise paused.'
);
assert.match(source, /aria-current=\{active \? "true" : undefined\}/);
assert.match(source, /aria-pressed=\{manualPaused\}/);

assert.match(
  source,
  /const pauseVisible = autoplayDelay !== null;/,
  'Any active Hero autoplay must expose its pause/resume control even for historical configs.'
);
assert.doesNotMatch(
  source,
  /pauseVisible = config\.showPause && autoplayDelay !== null/,
  'Historical showPause=false data must not be able to hide the required autoplay control.'
);
assert.match(
  schema,
  /showPause:\s*autoplay \|\| presentation\.navigation\.showPause/,
  'New Hero editor payloads must normalize pause/resume on whenever autoplay is active.'
);
assert.match(
  schema,
  /motionEngine:\s*z\.enum\(homeHeroMotionEngineIds\)\.default\("legacy"\)/,
  'The editor schema must normalize pre-V2 drafts to legacy instead of silently opting them into physical motion.'
);
assert.doesNotMatch(
  adminControls,
  /onToggle\("showPause"/,
  'The Hero Admin must not offer an independent switch that can hide pause while autoplay is active.'
);
assert.match(
  adminControls,
  /Pausa \/ reanudar se muestra automáticamente siempre que el avance automático está activo\./,
  'The Hero Admin must explain that pause/resume is required by autoplay.'
);

assert.match(
  schema,
  /scale:\s*z\.number\(\)\.int\(\)\.min\(50\)\.max\(180\)/,
  'The accessibility calculation must stay aligned with the persisted 50–180% navigation scale contract.'
);
assert.match(
  css,
  /--hero-navigation-target-size:\s*max\(24px,\s*calc\(2400px \/ var\(--hero-navigation-scale\)\)\);/,
  'Hero hit areas must compensate inversely for the editorial navigation scale.'
);
assert.match(
  css,
  /\.indicator::after,\s*\.pauseButton::after,\s*\.dragHandle::after\s*\{[\s\S]*?width:\s*var\(--hero-navigation-target-size\);[\s\S]*?height:\s*var\(--hero-navigation-target-size\);/,
  'Indicators, pause and editor drag controls must share the scale-compensated pointer target.'
);
assert.match(
  css,
  /\.navigation\[data-style="dots"\] \.indicators\s*\{\s*gap:\s*max\(15px,\s*calc\(var\(--hero-navigation-target-size\) - 9px\)\);/,
  'Dot spacing must grow with target compensation so adjacent hit areas cannot overlap at low scale.'
);
assert.match(
  css,
  /\.integratedProgress\s*\{[\s\S]*?border-radius:\s*inherit;/,
  'Expanding hit areas must preserve clipping semantics for the integrated rounded progress mark.'
);
assert.match(
  css,
  /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\.progressBar,\s*\.integratedProgress\s*\{\s*animation:\s*none;/,
  'Reduced-motion users must not see Hero progress animation before client hydration pauses autoplay.'
);
assert.match(
  css,
  /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\.navigation,[\s\S]*?transition:\s*none;/,
  'Reduced motion must also suppress navigation transitions from the first paint.'
);
assert.match(css, /--hero-navigation-scale:\s*var\(--hero-tablet-navigation-scale, 100\);/);
assert.match(css, /--hero-navigation-scale:\s*var\(--hero-mobile-navigation-scale, 92\);/);

assert.match(
  heroSource,
  /const physicalMotion = presentation\.motionEngine === "physical";/,
  'Physical motion must be opt-in from the resolved editorial presentation.'
);
assert.match(
  heroSource,
  /key=\{physicalMotion \? game\.id : `\$\{normalizedActiveIndex\}-\$\{position\}-\$\{game\.id\}`\}/,
  'Physical cards need stable game identity while legacy snapshots keep their historical remount identity.'
);
assert.match(
  heroSource,
  /const renderPositions = physicalMotion\s*\? visiblePositions\s*:\s*HOME_HERO_VISUAL_POSITIONS;/,
  'Physical motion must use canonical visible slots without changing the legacy renderer footprint.'
);
assert.match(
  heroSource,
  /homeHeroVisiblePositions\(/,
  'The physical-motion renderer must reuse the canonical responsive slot resolver.'
);
assert.match(
  heroSource,
  /onSelect=\{selectSlide\}/,
  'Indicator navigation must flow through the same direction-aware transition path as arrows, drag and wheel navigation.'
);
assert.match(
  heroSource,
  /onSelectPosition \? `Editar posición de \$\{game\.title\}` : `Mostrar \$\{game\.title\}`/,
  'Admin edit mode must not conflate selecting a visual slot with navigating the public carousel.'
);
assert.match(
  motionCss,
  /\.motionFrame\s*\{\s*display:\s*contents;/,
  'The physical wrapper must be layout-neutral for legacy snapshots.'
);
assert.match(
  motionCss,
  /\.motionRoot \.motionFrame\s*\{[\s\S]*?display:\s*block;[\s\S]*?will-change:\s*transform, opacity;/,
  'Only the opted-in physical engine may create the additional transform layer.'
);
assert.match(
  motionCss,
  /data-transition="slide"[\s\S]*?--hero-motion-x:/,
  'Slide must have a dedicated physical-motion accent instead of sharing a generic entrance keyframe.'
);
assert.match(
  motionCss,
  /data-transition="coverflow"[\s\S]*?--hero-motion-rotate-y:/,
  'Coverflow must preserve a distinct rotation/depth signature while cards move between real slots.'
);
assert.match(
  motionCss,
  /data-transition="perspective"[\s\S]*?--hero-motion-z:/,
  'Perspective must preserve a distinct depth signature.'
);
assert.match(
  motionCss,
  /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.motionCard,[\s\S]*?transition:\s*none !important;/,
  'The physical-motion layer must fully disappear for reduced-motion users.'
);

assert.match(
  deviceDesign,
  /motionEngine:\s*base\.motionEngine/,
  'Device overrides must never choose the runtime motion engine independently from the revision-level presentation.'
);
assert.match(
  livePreview,
  /const simulatingPhysicalMotion =\s*playing && presentation\.motionEngine !== "physical";/,
  'Admin preview must derive local V2 simulation from explicit preview mode without effect-driven state.'
);
assert.match(
  livePreview,
  /simulatingPhysicalMotion[\s\S]*?motionEngine:\s*"physical"/,
  'Admin preview must be able to simulate V2 locally before changing the draft.'
);
assert.match(
  livePreview,
  /form\[action=\\?"\/api\/admin\/content\/home\/hero\\?"\]/,
  'Changing motion engines must reuse the canonical Hero draft form instead of a parallel endpoint.'
);
assert.match(
  livePreview,
  /form\.requestSubmit\(\);/,
  'Motion engine activation must pass through the existing revision-aware save boundary.'
);
assert.match(
  livePreview,
  /Repetir transición ahora/,
  'The transition preview must expose a deterministic replay action instead of relying on autoplay timing.'
);
assert.match(
  livePreview,
  /La web pública cambia sólo al publicar Inicio\./,
  'The Admin must communicate that saving the engine changes a draft, not the published Home.'
);
assert.match(
  homeContentService,
  /export async function saveHomeHeroDraft\(/,
  'Hero presentation changes must remain owned by the canonical atomic Hero draft save.'
);
assert.doesNotMatch(
  homeContentService,
  /saveHomeHeroMotionEngineDraft/,
  'A second motion-engine mutation path would duplicate Hero ownership and create revision races.'
);

for (const scale of [50, 92, 100, 180]) {
  const preTransformTarget = Math.max(24, 2400 / scale);
  const finalTarget = preTransformTarget * (scale / 100);
  assert.ok(
    finalTarget >= 24 - Number.EPSILON,
    `Navigation scale ${scale}% would shrink the effective pointer target below 24px.`
  );
}

console.log('Hero accessibility/motion: OK (autoplay accessibility, reduced motion, legacy compatibility, physical opt-in, stable slot motion, canonical draft activation and deterministic Admin replay are guarded).');
