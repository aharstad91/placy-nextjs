#!/usr/bin/env node
/**
 * Henter alle arkitekturrender-serier fra Skanskas Lillebytunet-boligvelger
 * (Newbuilds "property explorer") og skriver et manifest.
 *
 * Kilde:  https://bolig.skanska.no/prosjekter/lillebytunet#kart
 * API:    https://storefront.newbuilds.com/api/v1
 *
 * Auth:   API-et krever `Authorization: Bearer <jwt>`. Token hentes ANONYMT fra
 *         det offentlige endepunktet /clients/<company>/credentials — det er
 *         ingen hemmelighet og lagres ikke på disk. Levetid ~24t.
 *
 * Ingen eksterne avhengigheter. Node 20+ (global fetch).
 *
 * Bruk:
 *   node scripts/lillebytunet/fetch-scenes.mjs
 *   node scripts/lillebytunet/fetch-scenes.mjs --out /annen/sti
 *   node scripts/lillebytunet/fetch-scenes.mjs --variant optimized_url
 *   node scripts/lillebytunet/fetch-scenes.mjs --probe-only   (bare url-variant-måling)
 */

import { createHash } from "node:crypto";
import { mkdir, writeFile, readFile, stat } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const API = "https://storefront.newbuilds.com/api/v1";
const PICKER = "f16ffe9e-1bb7-451e-b9e3-fb9781d10e8f";
const COMPANY = "f0f13804-d3a0-4982-ba7b-8e128360ffa4";

// Bildevariant. `original_url` er minst komprimert av de tre (alle er 1920x1080).
const DEFAULT_VARIANT = "original_url";
const CONCURRENCY = 6;

// ---------------------------------------------------------------- CLI
const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const OUT_ROOT = path.resolve(
  arg("out", path.join(os.homedir(), "klienter/placy/lillebytunet")),
);
const VARIANT = arg("variant", DEFAULT_VARIANT);
const PROBE_ONLY = argv.includes("--probe-only");

const DIR = {
  api: path.join(OUT_ROOT, "api"),
  renders: path.join(OUT_ROOT, "renders"),
  probe: path.join(OUT_ROOT, "probe"),
};

// ---------------------------------------------------------------- helpers
const log = (...a) => console.log(...a);

/** Slugger et parent_path til et serienavn: "." -> "oversikt", "Bygg-A" -> "bygg-a". */
function seriesSlug(parentPath) {
  if (!parentPath || parentPath === ".") return "oversikt";
  return parentPath
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const EXT_BY_CONTENT_TYPE = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/avif": "avif",
};

/**
 * Leser bildedimensjoner fra bytes uten eksterne avhengigheter.
 * Støtter WebP (VP8/VP8L/VP8X), PNG og JPEG — nok for det dette API-et leverer.
 */
function readDimensions(buf) {
  // PNG
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), kind: "png" };
  }
  // WebP: RIFF....WEBP
  if (buf.length > 30 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
    const chunk = buf.toString("ascii", 12, 16);
    if (chunk === "VP8X") {
      // 24-bit canvas width/height minus one, little endian, ved offset 24
      const w = (buf[24] | (buf[25] << 8) | (buf[26] << 16)) + 1;
      const h = (buf[27] | (buf[28] << 8) | (buf[29] << 16)) + 1;
      return { width: w, height: h, kind: "webp/vp8x" };
    }
    if (chunk === "VP8 ") {
      // lossy: 16-bit width/height (14 bit brukt) ved offset 26
      const w = buf.readUInt16LE(26) & 0x3fff;
      const h = buf.readUInt16LE(28) & 0x3fff;
      return { width: w, height: h, kind: "webp/vp8" };
    }
    if (chunk === "VP8L") {
      const b = buf.readUInt32LE(21);
      return {
        width: (b & 0x3fff) + 1,
        height: ((b >> 14) & 0x3fff) + 1,
        kind: "webp/vp8l",
      };
    }
  }
  // JPEG
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length - 9) {
      if (buf[i] !== 0xff) { i++; continue; }
      const marker = buf[i + 1];
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { width: buf.readUInt16BE(i + 7), height: buf.readUInt16BE(i + 5), kind: "jpeg" };
      }
      i += 2 + buf.readUInt16BE(i + 2);
    }
  }
  return { width: null, height: null, kind: "unknown" };
}

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

async function getJson(url, token) {
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.json();
}

/** Hent anonymt storefront-token. Returneres i minne, aldri skrevet til disk. */
async function getToken() {
  const res = await fetch(`${API}/clients/${COMPANY}/credentials`);
  if (!res.ok) throw new Error(`credentials: ${res.status} ${res.statusText}`);
  const body = await res.json();
  const token = Array.isArray(body) ? body[0] : body?.token;
  if (typeof token !== "string" || !token) throw new Error("uventet credentials-format");
  return token;
}

/** Skriv rå API-respons til api/<navn>.json. Ingen tokens/cookies i innholdet. */
async function saveApi(name, data) {
  await writeFile(path.join(DIR.api, `${name}.json`), JSON.stringify(data, null, 2));
}

async function downloadTo(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(dest, buf);
  return buf;
}

/** Kjør oppgaver med begrenset parallellitet. */
async function pool(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await worker(items[i], i);
    }
  });
  await Promise.all(runners);
  return results;
}

// ---------------------------------------------------------------- probe
/**
 * Måler faktisk oppløsning og filstørrelse for url / optimized_url / original_url
 * på et utvalg scener, slik at variantvalget er dokumentert og ikke antatt.
 */
async function probeVariants(sceneSets) {
  const picks = [];
  for (const set of sceneSets) {
    const first = [...set.scenes].sort((a, b) => a.direction - b.direction)[0];
    if (first) picks.push({ series: set.slug, scene: first });
  }
  const rows = [];
  for (const { series, scene } of picks) {
    for (const variant of ["url", "optimized_url", "original_url"]) {
      const url = scene.asset[variant];
      if (!url) {
        rows.push({ series, variant, url: null, status: "missing" });
        continue;
      }
      const dest = path.join(DIR.probe, `${series}_${variant}.bin`);
      try {
        const buf = await downloadTo(url, dest);
        const d = readDimensions(buf);
        rows.push({
          series,
          variant,
          url,
          bytes: buf.length,
          width: d.width,
          height: d.height,
          container: d.kind,
          local_path: dest,
          status: "ok",
        });
      } catch (err) {
        rows.push({ series, variant, url, status: `error: ${err.message}` });
      }
    }
  }
  return rows;
}

// ---------------------------------------------------------------- main
async function main() {
  for (const d of Object.values(DIR)) await mkdir(d, { recursive: true });

  log("→ hent anonymt storefront-token");
  const token = await getToken();

  log("→ /data");
  const data = await getJson(`${API}/property_pickers/${PICKER}/data`, token);
  await saveApi("data", data);

  log("→ /scenes_per_level (rot)");
  const root = await getJson(`${API}/property_pickers/${PICKER}/scenes_per_level`, token);
  await saveApi("scenes_per_level_root", root);

  // Sub-visninger finnes som references[].target{type:"view"} i rot-scenene.
  const viewIds = [
    ...new Set(
      root.scenes.flatMap((s) =>
        (s.references ?? [])
          .filter((r) => r.target?.type === "view")
          .map((r) => r.target.id),
      ),
    ),
  ];
  log(`→ ${viewIds.length} sub-visninger funnet i rot-referansene`);

  const sceneSets = [
    { slug: seriesSlug(root.scenes[0]?.parent_path), viewId: null, payload: root },
  ];
  for (const id of viewIds) {
    const payload = await getJson(
      `${API}/property_pickers/${PICKER}/scenes_per_level?scene_uuid=${id}`,
      token,
    );
    const slug = seriesSlug(payload.scenes[0]?.parent_path);
    await saveApi(`scenes_per_level_${slug}`, payload);
    sceneSets.push({ slug, viewId: id, payload });
    log(`  ${slug}: ${payload.scenes.length} scener`);
  }

  // units_assets er ikke render-serier, men lagres for fullstendighet.
  try {
    const units = await getJson(`${API}/property_pickers/${PICKER}/units_assets`, token);
    await saveApi("units_assets", units);
  } catch (err) {
    log(`  advarsel: units_assets feilet (${err.message})`);
  }

  const sets = sceneSets.map((s) => ({ ...s, scenes: s.payload.scenes }));

  log("\n→ måler url-varianter");
  const probe = await probeVariants(sets);
  for (const r of probe) {
    log(
      `  ${r.series.padEnd(10)} ${r.variant.padEnd(14)} ${
        r.status === "ok" ? `${r.width}x${r.height} ${r.bytes} B` : r.status
      }`,
    );
  }
  await writeFile(
    path.join(OUT_ROOT, "variant-probe.json"),
    JSON.stringify(probe, null, 2),
  );
  if (PROBE_ONLY) return;

  // ------------------------------------------------------------ nedlasting
  const levels = data.levels ?? {};
  const buildingsByUuid = new Map(
    (data.project?.buildings ?? []).map((b) => [b.uuid, b]),
  );

  const manifest = {
    project: {
      name: (data.project?.name ?? "").trim(),
      picker_uuid: PICKER,
      company_uuid: COMPANY,
      external_id: data.project?.external_id ?? null,
      renderer_type: data.renderer_type ?? null,
      location: data.project?.location ?? null,
      source_page: "https://bolig.skanska.no/prosjekter/lillebytunet#kart",
      api_base: API,
    },
    fetched_at: new Date().toISOString(),
    image_variant: VARIANT,
    variant_probe: probe,
    series: [],
    images: [],
  };

  for (const set of sets) {
    const scenes = [...set.scenes].sort((a, b) => a.direction - b.direction);
    const parentPath = scenes[0]?.parent_path ?? ".";
    const levelMeta = levels[parentPath] ?? {};
    const promotable = scenes[0]?.promotable ?? {};
    const building = buildingsByUuid.get(promotable.uuid);
    const dir = path.join(DIR.renders, set.slug);
    await mkdir(dir, { recursive: true });

    log(`\n→ ${set.slug}: laster ned ${scenes.length} bilder`);

    const seen = new Map(); // sha256 -> første lokale sti
    const rows = await pool(scenes, CONCURRENCY, async (scene, i) => {
      const asset = scene.asset ?? {};
      const url = asset[VARIANT] ?? asset.url;
      const ext = EXT_BY_CONTENT_TYPE[asset.content_type] ?? "bin";
      const index = String(scene.direction).padStart(3, "0");
      const rel = path.join(set.slug, `${index}_${scene.uuid}.${ext}`);
      const dest = path.join(DIR.renders, rel);

      const row = {
        project: (data.project?.name ?? "").trim(),
        series: set.slug,
        series_label: building?.name ?? (parentPath === "." ? "Oversikt" : parentPath),
        parent_path: parentPath,
        scene_uuid: scene.uuid,
        asset_uuid: asset.uuid ?? null,
        order: scene.direction,
        direction_raw: scene.direction,
        compass_direction_raw: scene.compass_direction,
        is_main_scene: Boolean(scene.main),
        source_url: url ?? null,
        source_variant: VARIANT,
        source_filename: asset.filename ?? null,
        local_path: dest,
        content_type: asset.content_type ?? null,
        ext,
        width: null,
        height: null,
        bytes: null,
        sha256: null,
        duplicate_of: null,
        status: "pending",
      };

      if (!url) {
        row.status = "missing_url";
        return row;
      }
      try {
        let buf;
        try {
          // hopp over hvis fila alt finnes og er ikke-tom
          const st = await stat(dest);
          if (st.size > 0) {
            buf = await readFile(dest);
            row.status = "cached";
          }
        } catch {
          /* ikke lastet ned enda */
        }
        if (!buf) {
          buf = await downloadTo(url, dest);
          row.status = "downloaded";
        }
        const d = readDimensions(buf);
        row.width = d.width;
        row.height = d.height;
        row.bytes = buf.length;
        row.sha256 = sha256(buf);
        if (!d.width || !d.height) row.status = "unreadable_dimensions";
      } catch (err) {
        row.status = `error: ${err.message}`;
      }
      return row;
    });

    // duplikat-deteksjon etter nedlasting (deterministisk rekkefølge)
    for (const row of rows) {
      if (!row.sha256) continue;
      if (seen.has(row.sha256)) row.duplicate_of = seen.get(row.sha256);
      else seen.set(row.sha256, row.local_path);
    }

    const ok = rows.filter((r) => r.status === "downloaded" || r.status === "cached");
    const dims = [...new Set(ok.map((r) => `${r.width}x${r.height}`))];
    const missingDirections = [];
    for (let i = 0; i < (levelMeta.scene_count ?? scenes.length); i++) {
      if (!scenes.some((s) => s.direction === i)) missingDirections.push(i);
    }

    manifest.series.push({
      slug: set.slug,
      label: building?.name ?? (parentPath === "." ? "Oversikt" : parentPath),
      parent_path: parentPath,
      view_uuid: set.viewId,
      promotable: promotable,
      building_uuid: building?.uuid ?? null,
      scene_count_from_api: levelMeta.scene_count ?? null,
      north_scene: levelMeta.north_scene ?? null,
      favorable_angles_count: Object.keys(levelMeta.favorable_angles ?? {}).length,
      discovered: scenes.length,
      downloaded: ok.length,
      validated: ok.filter((r) => r.width && r.height).length,
      duplicates: rows.filter((r) => r.duplicate_of).length,
      failed: rows.filter((r) => r.status.startsWith("error") || r.status === "missing_url").length,
      missing_directions: missingDirections,
      resolutions: dims,
      direction_min: Math.min(...scenes.map((s) => s.direction)),
      direction_max: Math.max(...scenes.map((s) => s.direction)),
      degrees_per_step: 360 / (levelMeta.scene_count ?? scenes.length),
      local_dir: dir,
    });
    manifest.images.push(...rows);

    log(`  ferdig: ${ok.length}/${scenes.length} ok, oppløsning ${dims.join(", ")}`);
  }

  await writeFile(
    path.join(OUT_ROOT, "manifest.json"),
    JSON.stringify(manifest, null, 2),
  );
  await writeFile(path.join(OUT_ROOT, "manifest.md"), renderManifestMd(manifest));

  log(`\nManifest: ${path.join(OUT_ROOT, "manifest.json")}`);
  log(`           ${path.join(OUT_ROOT, "manifest.md")}`);
  const total = manifest.images.length;
  const okAll = manifest.images.filter(
    (r) => r.status === "downloaded" || r.status === "cached",
  ).length;
  log(`Totalt: ${okAll}/${total} bilder lastet ned i ${manifest.series.length} serier`);
}

function renderManifestMd(m) {
  const L = [];
  L.push(`# Lillebytunet — render-serier`);
  L.push("");
  L.push(`Prosjekt: **${m.project.name}** (external_id ${m.project.external_id})`);
  L.push(`Kilde: ${m.project.source_page}`);
  L.push(`API: \`${m.project.api_base}/property_pickers/${m.project.picker_uuid}\``);
  if (m.project.location) {
    const l = m.project.location;
    L.push(
      `Adresse: ${l.address}, ${l.zip_code} ${l.city} — ${l.latitude}, ${l.longitude}`,
    );
  }
  L.push(`Renderer: \`${m.project.renderer_type}\``);
  L.push(`Hentet: ${m.fetched_at}`);
  L.push(`Bildevariant: \`${m.image_variant}\``);
  L.push("");
  L.push(`## Serier`);
  L.push("");
  L.push(
    "| Serie | Navn | Oppdaget | Lastet ned | Validert | Duplikater | Feilet | Mangler | Oppløsning | °/steg | north_scene |",
  );
  L.push("|---|---|---|---|---|---|---|---|---|---|---|");
  for (const s of m.series) {
    L.push(
      `| \`${s.slug}\` | ${s.label} | ${s.discovered} | ${s.downloaded} | ${s.validated} | ${s.duplicates} | ${s.failed} | ${
        s.missing_directions.length ? s.missing_directions.join(",") : "—"
      } | ${s.resolutions.join(", ")} | ${s.degrees_per_step} | ${s.north_scene} |`,
    );
  }
  L.push("");
  L.push(`## Variant-måling`);
  L.push("");
  L.push("| Serie | Variant | Oppløsning | Bytes |");
  L.push("|---|---|---|---|");
  for (const p of m.variant_probe) {
    L.push(
      `| ${p.series} | \`${p.variant}\` | ${p.status === "ok" ? `${p.width}x${p.height}` : p.status} | ${p.bytes ?? "—"} |`,
    );
  }
  L.push("");
  L.push(`## Bilder`);
  L.push("");
  L.push(`${m.images.length} rader. Full metadata per bilde i \`manifest.json\`.`);
  L.push("");
  L.push("| Serie | # | direction | compass_direction | Fil | px | Bytes | sha256 (12) | Status |");
  L.push("|---|---|---|---|---|---|---|---|---|");
  for (const r of m.images) {
    L.push(
      `| ${r.series} | ${r.order} | ${r.direction_raw} | ${r.compass_direction_raw} | ${path.basename(r.local_path)} | ${r.width}x${r.height} | ${r.bytes} | ${(r.sha256 ?? "").slice(0, 12)} | ${r.status}${r.duplicate_of ? " (dup)" : ""} |`,
    );
  }
  L.push("");
  return L.join("\n");
}

main().catch((err) => {
  console.error("FEIL:", err);
  process.exit(1);
});
