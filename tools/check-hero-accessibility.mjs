import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(
  new URL('../src/components/home/HeroNavigation.tsx', import.meta.url),
  'utf8'
);

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

console.log('Hero accessibility: OK (paused/manual slide changes are announced while autoplay transitions stay silent).');
