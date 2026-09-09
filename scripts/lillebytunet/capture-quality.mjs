#!/usr/bin/env node
/**
 * Repeatable Google 3D model screenshots. Requires Playwright + system Chrome.
 * node scripts/lillebytunet/capture-quality.mjs --base-url http://localhost:3002 \
 *   --model /models/lillebytunet/husB-before.glb --output /absolute/output \
 *   --playwright /absolute/node_modules/playwright/index.mjs
 * Optional: --views n,near,render-0 --settle-ms 5000 --orbit
 * Per building: --lat --lng --heading --dir0bearing --orbit-altitude
 *   --expect-near-altitude is an assertion on the post-orbit reset, not a camera setting.
 * Several delivered buildings at once, from the demo's registry, with the 'site' view
 * available and every other view aimed at --focus:
 *   --buildings husB,husC --focus husC --views site,n,near
 *   In this mode --model/--lat/--lng/--heading are ignored, because the placement is the
 *   registry's, and the run asserts one attached element and one 200 GLB per building.
 * A successful GLB response is recorded separately from element attachment and
 * visual evidence. Neither network success nor a screenshot proves correctness.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';

const { values } = parseArgs({ options: {
  'base-url': { type: 'string' }, model: { type: 'string' },
  output: { type: 'string' }, playwright: { type: 'string' },
  views: { type: 'string' }, 'settle-ms': { type: 'string', default: '5000' },
  orbit: { type: 'boolean', default: false },
  // Placement is per building; the defaults are Hus B's.
  lat: { type: 'string', default: '63.441359' }, lng: { type: 'string', default: '10.440215' },
  heading: { type: 'string', default: '115' },
  'orbit-altitude': { type: 'string', default: '26.2' },
  // Not a setting: this is the aim altitude the near preset is EXPECTED to reset to
  // after the orbit. The demo derives the real value from the ground constant plus the
  // preset's aim height; use ?calt= to move it. A wrong value here fails the run late.
  'expect-near-altitude': { type: 'string', default: '28.2' },
  'dir0bearing': { type: 'string' },
  // Registry mode: ids from lib/map/lillebytunet-buildings.ts.
  buildings: { type: 'string' }, focus: { type: 'string' },
} });
const buildingIds = values.buildings
  ? values.buildings.split(',').map(id => id.trim()).filter(Boolean) : [];
if (!values['base-url'] || !values.output || (!values.model && !buildingIds.length)) {
  throw new Error('--base-url, --output and one of --model/--buildings are required; see header.');
}
if (values.focus && !buildingIds.includes(values.focus)) {
  throw new Error('--focus must name one of --buildings');
}
const settleMs = Number(values['settle-ms']);
if (!Number.isFinite(settleMs) || settleMs < 1000) throw new Error('--settle-ms must be >=1000');
const { chromium } = await import(values.playwright
  ? pathToFileURL(resolve(values.playwright)).href : 'playwright');
const output = resolve(values.output);
await mkdir(output, { recursive: true });
const viewport = { width: 1920, height: 1080 };
const placement = { lat: Number(values.lat), lng: Number(values.lng),
  heading: Number(values.heading), alt: 0, altmode: 'CLAMP_TO_GROUND', scale: 1 };
for (const [key, value] of Object.entries(placement)) {
  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new Error(`--${key} must be a number`);
  }
}
const orbitAltitude = Number(values['orbit-altitude']);
const expectedNearAltitude = Number(values['expect-near-altitude']);
if (!Number.isFinite(orbitAltitude) || !Number.isFinite(expectedNearAltitude)) {
  throw new Error('--orbit-altitude and --expect-near-altitude must be numbers');
}
const viewIds = ['n', 'e', 's', 'w', 'mid', 'near',
  'render-0', 'render-24', 'render-36', 'render-48', 'render-72'];
// The site view only exists when the demo has more than one model to frame. Asking for it
// with fewer would silently capture the first preset instead, which reads as the site view.
const siteAvailable = buildingIds.length > 1;
const allViewIds = siteAvailable ? ['site', ...viewIds] : viewIds;
const selectedViews = values.views ? values.views.split(',') : allViewIds;
if (selectedViews.some(id => !allViewIds.includes(id))) {
  throw new Error(siteAvailable ? 'Unknown --views id'
    : "Unknown --views id ('site' needs --buildings with at least two ids)");
}
// One element and one successful GLB per building, asserted per view.
const expectedModels = buildingIds.length || 1;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport, deviceScaleFactor: 1,
  ...(values.orbit ? { recordVideo: { dir: join(output, 'video'), size: viewport } } : {}),
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push({ type: 'pageerror', message: error.message }));
page.on('console', message => {
  if (message.type() === 'error') errors.push({ type: 'console', message: message.text() });
});
const report = { capturedAt: new Date().toISOString(), baseUrl: values['base-url'],
  model: buildingIds.length ? null : values.model,
  buildings: buildingIds.length ? buildingIds : null,
  focus: buildingIds.length ? (values.focus ?? buildingIds[0]) : null,
  expectedModels, viewport, deviceScaleFactor: 1,
  placement: buildingIds.length ? 'from the demo registry, per building' : placement,
  orbitAltitude, expectedNearAltitude, dir0bearing: values.dir0bearing ?? 'default (Hus B, 222)',
  browser: browser.version(), settleMs, screenshotFormat: 'jpeg', screenshotQuality: 90, views: [], errors,
  caveats: ['Google phototiles and lighting can change between sessions.',
    'Render-rig direction is approximate; FOV is not calibrated to original renders.',
    'Model3DElement attachment and HTTP success do not confirm visually correct rendering.'],
};
try {
  for (const id of selectedViews) {
    const url = new URL('/demo/lillebytunet-3d', values['base-url']);
    if (buildingIds.length) {
      url.searchParams.set('buildings', buildingIds.join(','));
      if (values.focus) url.searchParams.set('focus', values.focus);
    } else {
      for (const [key, value] of Object.entries(placement)) {
        url.searchParams.set(key, String(value));
      }
      url.searchParams.set('model', values.model);
    }
    if (values.dir0bearing) url.searchParams.set('dir0bearing', values.dir0bearing);
    url.searchParams.set('cam', id.startsWith('render-') ? 'render' : id);
    if (id.startsWith('render-')) url.searchParams.set('dir', id.slice(7));
    // Keyed by path: several models load in the same view, and a repeated path would
    // otherwise hide that one of them never arrived.
    const modelResponses = new Map();
    const onResponse = async response => {
      const path = new URL(response.url()).pathname;
      if (!path.toLowerCase().endsWith('.glb')) return;
      if (values.model && !buildingIds.length && path !== values.model) return;
      try {
        const body = await response.body();
        modelResponses.set(path, { path, status: response.status(), bytes: body.length,
          sha256: createHash('sha256').update(body).digest('hex') });
      } catch (error) {
        modelResponses.set(path, { path, status: response.status(), error: error.message });
      }
    };
    page.on('response', onResponse);
    const started = Date.now();
    await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(expected => {
      const models = [...document.querySelectorAll('gmp-model-3d')];
      return models.length === expected
        && models.every(model => model.parentElement?.tagName === 'GMP-MAP-3D');
    }, expectedModels, { timeout: 60000 });
    const attachedMs = Date.now() - started;
    // Map tiles need additional settling after model attachment. Record this
    // bounded wait explicitly rather than calling it a model-loaded event.
    await page.waitForTimeout(settleMs);
    const observed = await page.evaluate(() => {
      const map = document.querySelector('gmp-map-3d');
      const model = document.querySelector('gmp-model-3d');
      return { camera: { heading: map.heading, tilt: map.tilt, range: map.range,
        center: { lat: map.center.lat, lng: map.center.lng, altitude: map.center.altitude } },
      modelElementAttached: model.parentElement === map,
      modelElements: [...document.querySelectorAll('gmp-model-3d')].map(element => ({
        src: element.src,
        attached: element.parentElement === map,
        position: { lat: element.position.lat, lng: element.position.lng },
        heading: element.orientation.heading,
      })),
      statusText: document.querySelector('[data-testid="model-status"]')?.textContent };
    });
    const modelResponseList = [...modelResponses.values()];
    const served = modelResponseList.filter(response => response.status === 200);
    if (served.length !== expectedModels) {
      throw new Error(`Expected ${expectedModels} served GLBs for ${id}, got `
        + JSON.stringify(modelResponseList));
    }
    await page.screenshot({ path: join(output, `${id}.jpg`), quality: 90 });
    page.off('response', onResponse);
    report.views.push({ id, url: url.href, attachedMs,
      modelResponses: modelResponseList, ...observed });
    await writeFile(join(output, 'capture.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(`Captured ${id}: ${served.length} GLB(s), `
      + `${served.map(response => response.bytes).join('+')} bytes, attached in ${attachedMs}ms`);
  }
  if (values.orbit) {
    const orbitFrames = [];
    const orbitStarted = performance.now();
    await page.evaluate(({ lat, lng, altitude }) => {
      const map = document.querySelector('gmp-map-3d');
      map.center = { lat, lng, altitude };
      map.tilt = 60; map.range = 80;
      map.dataset.qualityOrbitComplete = 'false';
      const started = performance.now();
      const rotate = now => {
        const fraction = Math.min((now - started) / 18000, 1);
        map.heading = (fraction * 360) % 360;
        if (fraction < 1) requestAnimationFrame(rotate);
        else map.dataset.qualityOrbitComplete = 'true';
      };
      requestAnimationFrame(rotate);
    }, { lat: placement.lat, lng: placement.lng, altitude: orbitAltitude });
    for (let frame = 0; frame < 12; frame++) {
      // Absolute deadlines keep screenshot overhead from accumulating beyond
      // the 18-second animation. Sample the middle of each 30-degree interval.
      const remaining = orbitStarted + (frame + 0.5) * 1500 - performance.now();
      if (remaining > 0) await page.waitForTimeout(remaining);
      const filename = `orbit-${String(frame).padStart(2, '0')}.jpg`;
      const heading = await page.evaluate(() => document.querySelector('gmp-map-3d').heading);
      await page.screenshot({ path: join(output, filename), quality: 90 });
      orbitFrames.push({ filename, heading });
    }
    await page.waitForFunction(() => document.querySelector('gmp-map-3d')
      ?.dataset.qualityOrbitComplete === 'true');
    report.orbit = { durationMs: 18000, interpolation: 'requestAnimationFrame',
      range: 80, tilt: 60, centerAltitude: orbitAltitude, screenshots: orbitFrames,
      video: 'video/ (Playwright WebM recording; includes setup and fixed views)' };
    const observedHeadings = orbitFrames.map(frame => Math.round(frame.heading));
    if (new Set(observedHeadings).size < 9 ||
        Math.max(...observedHeadings) - Math.min(...observedHeadings) < 270) {
      throw new Error('Orbit did not cover the building; camera may be snapping to controlled props.');
    }
    await page.getByRole('button', { name: 'Nærvisning', exact: true }).click();
    await page.waitForTimeout(300);
    report.orbit.presetReset = await page.evaluate(() => {
      const map = document.querySelector('gmp-map-3d');
      return { heading: map.heading, tilt: map.tilt, range: map.range, altitude: map.center.altitude };
    });
    const reset = report.orbit.presetReset;
    if (reset.heading !== 25 || reset.tilt !== 60 || reset.range !== 65 ||
        reset.altitude !== expectedNearAltitude) {
      throw new Error(`Preset did not reset after orbit: ${JSON.stringify(reset)}`);
    }
  }
} catch (error) {
  report.failure = error.message;
  throw error;
} finally {
  await writeFile(join(output, 'capture.json'), JSON.stringify(report, null, 2) + '\n');
  await context.close();
  await browser.close();
}
