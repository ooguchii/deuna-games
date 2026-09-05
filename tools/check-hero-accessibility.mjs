import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [source, css] = await Promise.all([
  readFile(
    new URL('../src/components/home/HeroNavigation.tsx', import.meta.url),
    'utf8'
  ),
  readFile(
    new URL('../src/components/home/HeroNavigation.module.css', import.meta.url),
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
  css,
  /\.indicator::after\s*\{[\s\S]*?width:\s*24px;[\s\S]*?height:\s*24px;/,
  'Every compact Hero indicator must expose at least a 24×24 pointer hit area without inflating its visual mark.'
);
assert.match(
  css,
  /\.indicator\s*\{[\s\S]*?overflow:\s*visible;/,
  'The expanded indicator hit area must not be clipped by the visual button box.'
);
assert.match(
  css,
  /\.navigation\[data-style="dots"\] \.indicators\s*\{\s*gap:\s*15px;/,
  'Dot indicators need enough center spacing that their 24px hit areas do not overlap.'
);
assert.match(
  css,
  /\.integratedProgress\s*\{[\s\S]*?border-radius:\s*inherit;/,
  'Expanding hit areas must preserve clipping semantics for the integrated rounded progress mark.'
);

console.log('Hero accessibility: OK (paused changes are announced, autoplay stays silent, and compact navigation exposes non-overlapping touch targets).');
