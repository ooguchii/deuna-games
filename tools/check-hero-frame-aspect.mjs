import assert from 'node:assert/strict';

import { simplifyHeroFrameRatio } from '../src/lib/home/hero-frame-aspect.ts';

function ratioOf(terms) {
  return terms.width / terms.height;
}

function assertBounded(terms) {
  assert.ok(Number.isInteger(terms.width));
  assert.ok(Number.isInteger(terms.height));
  assert.ok(terms.width >= 1 && terms.width <= 100);
  assert.ok(terms.height >= 1 && terms.height <= 100);
}

assert.deepEqual(simplifyHeroFrameRatio(1600, 900), { width: 16, height: 9 });
assert.deepEqual(simplifyHeroFrameRatio(1800, 220), { width: 90, height: 11 });
assert.deepEqual(simplifyHeroFrameRatio(260, 1200), { width: 13, height: 60 });

const coprime = simplifyHeroFrameRatio(901, 500);
assertBounded(coprime);
assert.notDeepEqual(coprime, { width: 1, height: 1 });
assert.ok(
  Math.abs(ratioOf(coprime) - 901 / 500) < 0.002,
  `901:500 must remain close to its real aspect ratio, got ${coprime.width}:${coprime.height}`
);

for (const [width, height] of [
  [901, 500],
  [1000, 333],
  [777, 1000],
  [1800, 220],
  [260, 1200],
]) {
  const terms = simplifyHeroFrameRatio(width, height);
  assertBounded(terms);
  const relativeError = Math.abs(ratioOf(terms) - width / height) / (width / height);
  assert.ok(
    relativeError < 0.002,
    `${width}:${height} approximation error is too large: ${terms.width}:${terms.height}`
  );
}

assert.deepEqual(simplifyHeroFrameRatio(0, 500), { width: 1, height: 1 });
assert.deepEqual(simplifyHeroFrameRatio(Number.NaN, 500), { width: 1, height: 1 });

console.log('Hero frame aspect: OK (exact ratios preserved; bounded approximations do not collapse valid frames).');
