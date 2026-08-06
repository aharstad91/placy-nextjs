import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseShoppingPage, parseResolvedMapsUrl } from "./parse-stores";

/**
 * Fixturen er ekte markup fra `midtbyen.no/shopping` (2026-08-06): hele
 * filterblokken, fire ekte oppføringer valgt for å dekke begge kort-statuser,
 * alle tre lenkeformater og termer utenfor filtersettet — pluss én syntetisk
 * oppføring uten nettside og med tomt `data-terms`.
 *
 * Den syntetiske finnes bevisst: kilden har i dag 147/147 med nettside, men
 * formen er triviell for et WordPress-redigert felt å produsere, og en parser
 * som kaster på den ville tatt ned hele hentingen for én manglende lenke.
 */
const fixture = readFileSync(
  join(__dirname, "__fixtures__", "shopping-page.html"),
  "utf-8",
);

describe("parseShoppingPage", () => {
  const { categories, stores } = parseShoppingPage(fixture);

  it("leser alle 28 kategorifiltre med etikett", () => {
    expect(categories).toHaveLength(28);
    expect(categories.every((c) => c.label.length > 0)).toBe(true);
    expect(categories).toContainEqual({ termId: 33, label: "Barn/ungdom" });
  });

  it("dekoder HTML-entiteter i etikettene", () => {
    // Kilden skriver «Sport &amp; Fritid». Rå tekst ville gitt en etikett med
    // ampersand-entiteten synlig i UI-et.
    expect(categories).toContainEqual({ termId: 101, label: "Sport & Fritid" });
  });

  it("leser oppføringens felter", () => {
    const aagaard = stores.find((s) => s.name === "Aagaard siden 1876");
    expect(aagaard).toEqual({
      name: "Aagaard siden 1876",
      address: "Dronningens gate 9",
      mapsUrl: "https://goo.gl/maps/MYDvf4kZs4474AQcA",
      websiteUrl: "https://www.aagaard1876.no/",
      termIds: [22, 23, 24, 21, 20],
      acceptsCard: true,
      acceptsCardDigital: true,
    });
  });

  it("beholder KUN term-IDer som finnes blant filtrene", () => {
    // Aagaards rå data-terms er [22,23,24,13,21,20]. 13 står på 140 av 147
    // oppføringer og er ikke et filter — tolket som kategori ville den blitt en
    // bøtte som rommer nesten alt.
    const aagaard = stores.find((s) => s.name === "Aagaard siden 1876")!;
    expect(aagaard.termIds).not.toContain(13);
  });

  it("beholder oppføringer som ikke har én eneste gyldig kategori", () => {
    // 7-Eleven har data-terms="[147,13]" — ingen av dem er filtre. Butikken er
    // like fullt en butikk, og skal senere havne i «Annet».
    const seven = stores.find((s) => s.name === "7-Eleven Nordre");
    expect(seven).toBeDefined();
    expect(seven!.termIds).toEqual([]);
    expect(seven!.acceptsCard).toBe(false);
    expect(seven!.acceptsCardDigital).toBe(false);
  });

  it("takler manglende nettside uten å kaste", () => {
    const utenNett = stores.find((s) => s.name === "Butikk uten nettside");
    expect(utenNett).toBeDefined();
    expect(utenNett!.websiteUrl).toBeUndefined();
    expect(utenNett!.termIds).toEqual([]);
    expect(utenNett!.acceptsCard).toBe(true);
    expect(utenNett!.acceptsCardDigital).toBe(false);
  });

  it("leser alle tre lenkeformatene", () => {
    const urls = stores.map((s) => s.mapsUrl);
    expect(urls.some((u) => u.startsWith("https://goo.gl/maps/"))).toBe(true);
    expect(urls.some((u) => u.startsWith("https://maps.app.goo.gl/"))).toBe(true);
    expect(urls.some((u) => u.startsWith("https://g.page/"))).toBe(true);
  });

  it("gir tom, ikke kastende, retur på markup uten butikker", () => {
    expect(parseShoppingPage("<html><body></body></html>")).toEqual({
      categories: [],
      stores: [],
    });
  });
});

describe("parseResolvedMapsUrl", () => {
  it("leser koordinat og feature-ID fra en oppslått goo.gl-lenke", () => {
    expect(
      parseResolvedMapsUrl(
        "https://www.google.no/maps/place/AAGAARD+siden+1876/@63.4317974,10.3949261,17z/" +
          "data=!3m1!4b1!4m5!3m4!1s0x466d319ba29d251f:0xa47edf666c4d5c00!8m2!3d63.431795!4d10.3971201?shorturl=1",
      ),
    ).toEqual({
      lat: 63.431795,
      lng: 10.3971201,
      featureId: "0x466d319ba29d251f:0xa47edf666c4d5c00",
    });
  });

  it("leser koordinat og feature-ID fra en oppslått maps.app-lenke", () => {
    expect(
      parseResolvedMapsUrl(
        "https://www.google.com/maps/place/Arti+L%C3%A6ll/@63.4268677,10.3907328,14z/" +
          "data=!4m7!3m6!1s0x466d31007f25a525:0xa7a825be02553e2c!8m2!3d63.4325543!4d10.3976957?entry=tts",
      ),
    ).toEqual({
      lat: 63.4325543,
      lng: 10.3976957,
      featureId: "0x466d31007f25a525:0xa7a825be02553e2c",
    });
  });

  it("bruker stedets koordinat, ikke kartutsnittets senter", () => {
    // @-verdien (63.4268677) er utsnittets senter og ligger her ~600 m unna
    // stedet (63.4325543). Leser vi feil av de to, havner pinnen i en annen gate.
    const result = parseResolvedMapsUrl(
      "https://www.google.com/maps/place/X/@63.4268677,10.3907328,14z/" +
        "data=!3m4!1s0x1:0x2!8m2!3d63.4325543!4d10.3976957",
    );
    expect(result!.lat).toBe(63.4325543);
  });

  it("gir CID uten koordinat for g.page-lenker", () => {
    expect(
      parseResolvedMapsUrl(
        "https://www.google.com/search?q=Brattorkaia&ludocid=1185631196958879755&source=g.page.share",
      ),
    ).toEqual({ cid: "1185631196958879755" });
  });

  it("gir null når URL-en ikke bærer posisjon i det hele tatt", () => {
    expect(parseResolvedMapsUrl("https://www.google.com/maps")).toBeNull();
  });

  it("gir feature-ID alene når koordinatparet mangler", () => {
    expect(
      parseResolvedMapsUrl(
        "https://www.google.com/maps/place//data=!4m2!3m1!1s0x466d3185de39263d:0x1074354ab95af00b?source=g.page.share",
      ),
    ).toEqual({ featureId: "0x466d3185de39263d:0x1074354ab95af00b" });
  });
});
