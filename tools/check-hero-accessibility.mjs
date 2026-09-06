import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [source, css, schema, adminControls] = await Promise.all([
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

for (const scale of [50, 92, 100, 180]) {
  const preTransformTarget = Math.max(24, 2400 / scale);
  const finalTarget = preTransformTarget * (scale / 100);
  assert.ok(
    finalTarget >= 24 - Number.EPSILON,
    `Navigation scale ${scale}% would shrink the effective pointer target below 24px.`
  );
}

console.log('Hero accessibility: OK (autoplay always exposes pause/resume, reduced motion is respected before hydration, paused changes are announced, autoplay stays silent, and navigation keeps 24px pointer targets across the full scale contract).');
