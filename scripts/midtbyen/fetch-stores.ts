/**
 * Engangshenting av butikkatalogen på `midtbyen.no/shopping` — steg 1 av 2 i
 * Midtbyen-demoen.
 *
 * Kjør:  npx tsx scripts/midtbyen/fetch-stores.ts
 * Ut:    lib/gigs/midtbyen/stores.raw.json  (sjekkes inn i repoet)
 *
 * Demoen har ingen database og ingen sync. Dette scriptet kjøres for hånd når
 * dataene skal friskes opp, og resultatet er en fil i repoet. Det gjør hele
 * opprydningen til å slette en mappe.
 *
 * Koordinatene hentes ved å slå opp Google-kortlenken hver oppføring har. Det
 * er gratis, og det gir oss også feature-IDen — som overlever at Google
 * avvikler de korte `goo.gl`-lenkene. Lagres den nå, trenger senere kjøringer
 * aldri kortlenken igjen.
 *
 * De ni `g.page`-oppføringene lander på en Google-søkeside uten koordinat. De
 * står igjen uten posisjon her og fylles av Places-oppslaget i steg 2.
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import pLimit from "p-limit";
import {
  parseShoppingPage,
  parseResolvedMapsUrl,
  type ParsedCategory,
  type ParsedStore,
} from "@/lib/gigs/midtbyen/parse-stores";

const SOURCE_URL = "https://midtbyen.no/shopping/";
const OUT_PATH = join(process.cwd(), "lib/gigs/midtbyen/stores.raw.json");

/**
 * Kortlenkene løses opp med Node-ens egen User-Agent, IKKE en browser-streng.
 *
 * `maps.app.goo.gl` svarer en browser med en interstitial-side som aldri
 * redirecter, mens en ærlig ikke-browser får en ren 302 rett til stedssiden.
 * En «realistisk» UA gjør altså 25 av 147 oppføringer uløselige.
 */
const RESOLVE_CONCURRENCY = 6;

export interface RawStore extends ParsedStore {
  lat?: number;
  lng?: number;
  googleFeatureId?: string;
  googleCid?: string;
}

export interface RawStoresFile {
  source: string;
  fetchedAt: string;
  categories: ParsedCategory[];
  stores: RawStore[];
}

async function resolveLocation(store: ParsedStore): Promise<RawStore> {
  try {
    const response = await fetch(store.mapsUrl, { redirect: "follow" });
    const location = parseResolvedMapsUrl(response.url);
    if (!location) return { ...store };
    return {
      ...store,
      ...(location.lat !== undefined ? { lat: location.lat } : {}),
      ...(location.lng !== undefined ? { lng: location.lng } : {}),
      ...(location.featureId ? { googleFeatureId: location.featureId } : {}),
      ...(location.cid ? { googleCid: location.cid } : {}),
    };
  } catch (error) {
    // Fail-soft per oppføring: én død lenke skal ikke ta ned hele hentingen.
    console.warn(
      `  ⚠️  ${store.name}: kunne ikke slå opp kartlenken — ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return { ...store };
  }
}

async function main() {
  console.log(`Henter ${SOURCE_URL} …`);
  const response = await fetch(SOURCE_URL, {
    headers: { "User-Agent": "Placy/1.0 (+https://placy.no) engangshenting" },
  });
  if (!response.ok) {
    console.error(`Feilet: HTTP ${response.status}`);
    process.exit(1);
  }

  const { categories, stores } = parseShoppingPage(await response.text());
  console.log(`  ${stores.length} butikker, ${categories.length} kategorier`);

  if (stores.length === 0) {
    console.error("Ingen butikker parset — siden har trolig endret struktur.");
    process.exit(1);
  }

  console.log(`Slår opp kartlenker (${RESOLVE_CONCURRENCY} om gangen) …`);
  const limit = pLimit(RESOLVE_CONCURRENCY);
  const resolved = await Promise.all(
    stores.map((store) => limit(() => resolveLocation(store))),
  );

  const utenKoordinat = resolved.filter((s) => s.lat === undefined);
  const utenKategori = resolved.filter((s) => s.termIds.length === 0);

  const file: RawStoresFile = {
    source: SOURCE_URL,
    fetchedAt: new Date().toISOString(),
    categories,
    stores: resolved,
  };
  writeFileSync(OUT_PATH, `${JSON.stringify(file, null, 2)}\n`, "utf-8");

  console.log(`\nSkrevet ${OUT_PATH}`);
  console.log(
    `  ${resolved.length - utenKoordinat.length}/${resolved.length} med koordinat`,
  );
  // Navngis eksplisitt. Et tall alene skjuler hvilke butikker som mangler, og
  // da oppdages det først når et punkt ikke dukker opp på kartet.
  if (utenKoordinat.length > 0) {
    console.log(`  uten koordinat (fylles av steg 2):`);
    for (const s of utenKoordinat) console.log(`    · ${s.name} — ${s.mapsUrl}`);
  }
  if (utenKategori.length > 0) {
    console.log(`  uten kategori (havner i «Annet»):`);
    for (const s of utenKategori) console.log(`    · ${s.name}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
