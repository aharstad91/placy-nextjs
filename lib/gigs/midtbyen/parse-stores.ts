/**
 * Parsing av `midtbyen.no/shopping` — kilden til Midtbyen-demoen.
 *
 * Siden er WordPress og leverer hele katalogen i rå-HTML fra et vanlig GET:
 * 147 `article.store` pluss 28 kategorifiltre. Ingen headless browser, ingen
 * API. «Vis mer»-knappen paginerer bare det som allerede står i dokumentet.
 *
 * Modulen er ren: den tar HTML og gir data. Nettverket ligger i
 * `scripts/midtbyen/fetch-stores.ts`, slik at parsingen kan testes mot en
 * lagret fixture uten å røre kilden.
 */

import * as cheerio from "cheerio";

/** Ett av de 28 avkryssingsfiltrene over butikklista. */
export interface ParsedCategory {
  termId: number;
  label: string;
}

export interface ParsedStore {
  name: string;
  address: string;
  /** Google-kortlenke — `goo.gl/maps`, `maps.app.goo.gl` eller `g.page/…?share`. */
  mapsUrl: string;
  websiteUrl?: string;
  /**
   * KUN term-IDer som finnes blant de 28 filtrene. `data-terms` inneholder
   * også WordPress-termer som ikke er kategorier — bl.a. `13`, som står på 140
   * av 147 oppføringer og i praksis betyr «tar Midtbykort». Tolker man dem som
   * kategorier, får man en søppelkategori som er nesten hele datasettet.
   */
  termIds: number[];
  acceptsCard: boolean;
  acceptsCardDigital: boolean;
}

export interface ParsedShoppingPage {
  categories: ParsedCategory[];
  stores: ParsedStore[];
}

/**
 * Trekk ut kategorifiltrene og butikkene fra et hentet dokument.
 *
 * Oppføringer uten navn eller uten kart-lenke hoppes over: uten navn er raden
 * ikke presenterbar, og uten kart-lenke finnes ingen vei til koordinater. Begge
 * deler ville blitt et punkt vi ikke kan plassere. Kilden har i dag ingen slike
 * (147/147 har begge), så et utslag her betyr at siden har endret seg.
 */
export function parseShoppingPage(html: string): ParsedShoppingPage {
  const $ = cheerio.load(html);

  const categories: ParsedCategory[] = [];
  $('input[name="categories[]"]').each((_, el) => {
    const value = $(el).attr("value");
    const id = $(el).attr("id");
    if (!value || !id) return;
    const termId = Number.parseInt(value, 10);
    if (!Number.isFinite(termId)) return;
    // cheerio dekoder entiteter, så «Sport &amp; Fritid» blir «Sport & Fritid».
    const label = $(`label[for="${id}"]`).text().trim();
    if (!label) return;
    categories.push({ termId, label });
  });

  const validTermIds = new Set(categories.map((c) => c.termId));

  const stores: ParsedStore[] = [];
  $("article.store").each((_, el) => {
    const $el = $(el);
    const name = $el.find("h2").first().text().trim();
    const mapsUrl = $el.find("a.location").first().attr("href")?.trim();
    if (!name || !mapsUrl) return;

    const websiteUrl = $el.find("a.webpage").first().attr("href")?.trim();

    stores.push({
      name,
      address: $el.find(".address").first().text().trim(),
      mapsUrl,
      ...(websiteUrl ? { websiteUrl } : {}),
      termIds: parseTermIds($el.attr("data-terms")).filter((t) =>
        validTermIds.has(t),
      ),
      acceptsCard: $el.attr("data-card") === "accepts",
      acceptsCardDigital: $el.attr("data-digicard") === "accepts-digi",
    });
  });

  return { categories, stores };
}

/** `data-terms="[22,23]"` → `[22, 23]`. Ugyldig eller manglende → tom liste. */
function parseTermIds(raw: string | undefined): number[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((t): t is number => typeof t === "number");
}

/** Det en oppslått Google-lenke kan gi oss. Alle felter er valgfrie. */
export interface MapsLocation {
  lat?: number;
  lng?: number;
  /** Googles feature-ID, `0x<hex>:0x<hex>`. Overlever at kortlenken avvikles. */
  featureId?: string;
  /** Desimal-CID fra `g.page`-oppslag (samme sted, annen skrivemåte). */
  cid?: string;
}

/**
 * Les posisjon ut av URL-en en Google-kortlenke lander på.
 *
 * De tre formatene i kilden lander tre forskjellige steder:
 *
 * - `goo.gl/maps` og `maps.app.goo.gl` → `…/maps/place/…!1s0x…:0x…!8m2!3d<lat>!4d<lng>`
 *   (koordinat + feature-ID)
 * - `g.page/…?share` → `google.com/search?q=…&ludocid=<cid>` (kun CID, INGEN koordinat)
 *
 * `!3d`/`!4d` er stedets egne koordinater. `@lat,lng,17z` tidligere i URL-en er
 * kartutsnittets senter og brukes bevisst IKKE — den ville plassert pinnen i
 * midten av et utsnitt i stedet for på butikken, og et punkt som er «nesten
 * riktig» er verre enn et punkt vi vet mangler.
 *
 * De ni `g.page`-oppføringene får derfor ingen koordinat her. De fylles av
 * Places-oppslaget i berikelsessteget.
 */
export function parseResolvedMapsUrl(url: string): MapsLocation | null {
  const location: MapsLocation = {};

  const coords = /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/.exec(url);
  if (coords) {
    const lat = Number.parseFloat(coords[1]);
    const lng = Number.parseFloat(coords[2]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      location.lat = lat;
      location.lng = lng;
    }
  }

  const featureId = /!1s(0x[0-9a-f]+:0x[0-9a-f]+)/.exec(url);
  if (featureId) location.featureId = featureId[1];

  const cid = /[?&]ludocid=(\d+)/.exec(url);
  if (cid) location.cid = cid[1];

  return Object.keys(location).length > 0 ? location : null;
}
