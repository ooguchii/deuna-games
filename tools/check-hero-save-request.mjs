import assert from 'node:assert/strict';
import { readTrustedAdminForm, hasExactAdminFormFields } from '../src/lib/admin/request-security.ts';
import { sourceHomeConfig } from '../src/data/home-config.ts';
import { updateHeroDeviceDesign } from '../src/lib/home/hero-device-design.ts';
import { homeHeroEditorFormSchema } from '../src/lib/admin/home-config-forms.ts';
import { HOME_HERO_MAX_FORM_BYTES } from '../src/lib/home/hero-contract.ts';

const origin = 'https://editor.example';
let presentation = structuredClone(sourceHomeConfig.heroPresentation);
for (const device of ['desktop', 'tablet', 'mobile']) {
  presentation = updateHeroDeviceDesign(presentation, device, design => {
    design.radius = 25;
    return design;
  });
}

const payload = { mode: 'manual', slugs: sourceHomeConfig.heroSlugs, presentation };
const body = new URLSearchParams({ expectedRevision: '1', heroJson: JSON.stringify(payload) }).toString();
assert.ok(Buffer.byteLength(body) > 8192, 'Reproduce the rejected multi-device form');

const request = (value = body, headers = {}) => new Request(`${origin}/api/admin/content/home/hero`, {
  method: 'POST',
  body: value,
  headers: { origin, 'content-type': 'application/x-www-form-urlencoded', ...headers },
});

assert.equal(await readTrustedAdminForm(request(), origin), null, 'Other forms retain their existing limit');
for (const headers of [{}, { 'content-length': String(Buffer.byteLength(body)) }]) {
  const form = await readTrustedAdminForm(request(body, headers), origin, HOME_HERO_MAX_FORM_BYTES);
  assert.ok(form);
  assert.ok(hasExactAdminFormFields(form, ['expectedRevision', 'heroJson']));
  assert.deepEqual(homeHeroEditorFormSchema.parse(Object.fromEntries(form)).heroJson, payload);
}

for (const headers of [
  { origin: 'https://other.example' },
  { 'sec-fetch-site': 'cross-site' },
  { 'content-type': 'application/json' },
  { 'content-length': String(HOME_HERO_MAX_FORM_BYTES + 1) },
]) {
  assert.equal(await readTrustedAdminForm(request(body, headers), origin, HOME_HERO_MAX_FORM_BYTES), null);
}

assert.equal(await readTrustedAdminForm(request('x'.repeat(HOME_HERO_MAX_FORM_BYTES + 1)), origin, HOME_HERO_MAX_FORM_BYTES), null);
assert.equal(await readTrustedAdminForm(
  request('x'.repeat(HOME_HERO_MAX_FORM_BYTES + 1), { 'content-length': '1' }),
  origin,
  HOME_HERO_MAX_FORM_BYTES
), null);

let cancelled = false;
const stream = new ReadableStream({
  pull(controller) { controller.enqueue(new Uint8Array(4096)); },
  cancel() { cancelled = true; },
});
assert.equal(await readTrustedAdminForm(new Request(`${origin}/save`, {
  method: 'POST',
  body: stream,
  duplex: 'half',
  headers: { origin, 'content-type': 'application/x-www-form-urlencoded' },
}), origin), null);
assert.ok(cancelled, 'Stop reading oversized streams instead of buffering unbounded input');

assert.equal(hasExactAdminFormFields(new URLSearchParams(`${body}&expectedRevision=2`), ['expectedRevision', 'heroJson']), false);
console.log(`Hero save request: OK (${Buffer.byteLength(body)} bytes; multi-device payload, origin, size, stream and duplicate-field checks).`);