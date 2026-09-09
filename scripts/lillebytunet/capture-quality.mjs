#!/usr/bin/env node
/**
 * Repeatable Google 3D model screenshots. Requires Playwright + system Chrome.
 * node scripts/lillebytunet/capture-quality.mjs --base-url http://localhost:3002 \
 *   --model /models/lillebytunet/husB-before.glb --output /absolute/output \
 *   --playwright /absolute/node_modules/playwright/index.mjs
 * Optional: --views n,near,render-0 --settle-ms 5000 --orbit
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
} });
if (!values['base-url'] || !values.model || !values.output) {
  throw new Error('--base-url, --model and --output are required; see script header.');
}
const settleMs = Number(values['settle-ms']);
if (!Number.isFinite(settleMs) || settleMs < 1000) throw new Error('--settle-ms must be >=1000');
const { chromium } = await import(values.playwright
  ? pathToFileURL(resolve(values.playwright)).href : 'playwright');
const output = resolve(values.output);
await mkdir(output, { recursive: true });
const viewport = { width: 1920, height: 1080 };
const placement = { lat: 63.441359, lng: 10.440215, heading: 115,
  alt: 0, altmode: 'CLAMP_TO_GROUND', scale: 1 };
const viewIds = ['n', 'e', 's', 'w', 'mid', 'near',
  'render-0', 'render-24', 'render-36', 'render-48', 'render-72'];
const selectedViews = values.views ? values.views.split(',') : viewIds;
if (selectedViews.some(id => !viewIds.includes(id))) throw new Error('Unknown --views id');
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
  model: values.model, viewport, deviceScaleFactor: 1, placement,
  browser: browser.version(), settleMs, screenshotFormat: 'jpeg', screenshotQuality: 90, views: [], errors,
  caveats: ['Google phototiles and lighting can change between sessions.',
    'Render-rig direction is approximate; FOV is not calibrated to original renders.',
    'Model3DElement attachment and HTTP success do not confirm visually correct rendering.'],
};
try {
  for (const id of selectedViews) {
    const url = new URL('/demo/lillebytunet-3d', values['base-url']);
    for (const [key, value] of Object.entries(placement)) url.searchParams.set(key, String(value));
    url.searchParams.set('model', values.model);
    url.searchParams.set('cam', id.startsWith('render-') ? 'render' : id);
    if (id.startsWith('render-')) url.searchParams.set('dir', id.slice(7));
    let modelResponse = null;
    const onResponse = async response => {
      if (new URL(response.url()).pathname !== values.model) return;
      try {
        const body = await response.body();
        modelResponse = { status: response.status(), bytes: body.length,
          sha256: createHash('sha256').update(body).digest('hex') };
      } catch (error) { modelResponse = { status: response.status(), error: error.message }; }
    };
    page.on('response', onResponse);
    const started = Date.now();
    await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => document.querySelector('gmp-model-3d')?.parentElement
      ?.tagName === 'GMP-MAP-3D', null, { timeout: 60000 });
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
      statusText: document.querySelector('[data-testid="model-status"]')?.textContent };
    });
    if (!modelResponse || modelResponse.status !== 200) {
      throw new Error(`No successful model response for ${id}: ${JSON.stringify(modelResponse)}`);
    }
    await page.screenshot({ path: join(output, `${id}.jpg`), quality: 90 });
    page.off('response', onResponse);
    report.views.push({ id, url: url.href, attachedMs, modelResponse, ...observed });
    await writeFile(join(output, 'capture.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(`Captured ${id}: GLB ${modelResponse.bytes} bytes, element attached in ${attachedMs}ms`);
  }
  if (values.orbit) {
    const orbitFrames = [];
    const orbitStarted = performance.now();
    await page.evaluate(() => {
      const map = document.querySelector('gmp-map-3d');
      map.center = { lat: 63.441359, lng: 10.440215, altitude: 26.2 };
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
    });
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
      range: 80, tilt: 60, centerAltitude: 26.2, screenshots: orbitFrames,
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
    if (reset.heading !== 25 || reset.tilt !== 60 || reset.range !== 65 || reset.altitude !== 28.2) {
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
