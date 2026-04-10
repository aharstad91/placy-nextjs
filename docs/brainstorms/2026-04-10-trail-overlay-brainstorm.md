---
date: 2026-04-10
topic: trail-overlay
---

# Trail & Sykkelrute Overlay i Report

## Hva vi bygger

Sykkelruter og turstier som fargekodede polylines (GeoJSON LineString) på ReportThemeMap i **Natur & Friluftsliv**-seksjonen. Inspirert av Wesselløkkas manuelt tegnede kart som viser sykkelruter (rosa), turstier, grøntområder og skiløyper.

## Plassering: Natur & Friluftsliv (Alternativ 2)

Beslutning: Alle stier og sykkelruter samles i Natur & Friluftsliv. Transport-seksjonen beholder buss/trikk/bysykkel-stasjoner. Begrunnelse:
- For boligkjøpere er "kan jeg sykle og gå tur her?" én beslutning
- Transport handler om "hvordan kommer jeg meg til jobb/sentrum"
- Wesselløkka-kartet bekrefter at folk tenker slik

## Datakilde: Overpass/OSM (primær)

### Hva finnes (testet for Brøset-området, 3km radius)

**Route relations (kuraterte multi-way ruter):**
- 15 **sykkelruter** — Jonsvannsruta, Moholtruta, Tyholtruta, Heimdalruta, Klæburuta, Stavneruta, Strindaruta, Byåsruta, Ranheimsruta, Sverresborgruta + NCN 7 og 9
- 7 **turløyper** — Hjerterunden, Midtbyrunden, Forsvarsrunden, Havsteinrunden, Campusrunden, Temperunden
- 6 **pilegrimsruter** — Gudbrandsdalsleden, Østerdalsleden, Kystpilegrimsleia, St. Olavsleden

**Individuelle ways:**
- 515 cycleways, 2749 footways, 53 navngitte gangstier
- 28 navngitte stier: Sverresdalstien, Nidelvstien, Kattstien, Uglabekkstien m.fl.

**Metadata tilgjengelig:** surface, lit, segregated, smoothness, network (lcn/rcn/ncn)

**Geometri:** Koordinat-arrays per way → konverteres til GeoJSON LineString

### Overpass-query for route relations med geometri

```
[out:json][timeout:30];
(
  relation["route"="bicycle"]({{bbox}});
  relation["route"="hiking"]({{bbox}});
  relation["route"="foot"]({{bbox}});
);
out geom;
```

### Supplerende kilder (ikke i MVP)
- **NVDB:** 155 sykkelveger, 994 gang-sykkelveger — formell infrastruktur
- **Turrutebasen/Kartverket:** Offisielle friluftsruter (GML-format, krever XML-parsing)
- **UT.no:** Ingen offentlig API lenger

## Eksisterende kode

### `route-layer.tsx` — ferdig polyline-komponent
- GeoJSON LineString rendering med 3-lags stack: glow → casing → main line
- Støtter segmenter med active/inactive state
- Fargekoding per reisemodus (walk=blå, bike=grønn)

### `ReportThemeMap.tsx` — illustrert kart
- Mapbox Standard style med varm fargepalett
- Tier-aware POI-markører
- Layer toggle via `setLayoutProperty`

## Arkitektur

### Ny API-route: `/api/trails`
- Input: `{ lat, lng, radiusKm, types: ["bicycle"|"hiking"|"foot"] }`
- Output: GeoJSON FeatureCollection med LineString-features
- Hvert feature har properties: `name`, `type` (bicycle/hiking/foot), `network` (lcn/rcn/ncn)

### Ny komponent: `TrailLayer.tsx`
- Bygger på mønsteret fra `route-layer.tsx`
- Fargekoding per rutetype:
  - Sykkelruter: grønn (#22C55E)
  - Turstier/turløyper: oransje/brun (#D97706)
  - Pilegrimsruter: lilla (#8B5CF6)
- Tynnere linjer enn navigasjonsruter (2-3px vs 5px)
- Rutenavn som labels langs linjen eller ved hover

### Integrasjon i ReportThemeMap
- Vis trail-layer KUN for Natur & Friluftsliv-seksjonen
- Trail-data hentes server-side og passes som prop
- Togglebar via activated-state (dimmet når inaktiv)

### Pipeline-integrasjon (generate-bolig)
- Nytt steg mellom 5.8 og 6: Hent trails fra Overpass
- Lagre GeoJSON i prosjekt-config eller egen tabell
- Klipp trails til prosjektets radius

## Fargekoding (inspirert av Wesselløkka)

| Rutetype | Farge | Linjestil |
|----------|-------|-----------|
| Sykkelruter | Grønn (#22C55E) | Solid, 3px |
| Turstier/turløyper | Oransje (#D97706) | Solid, 2.5px |
| Pilegrimsruter | Lilla (#8B5CF6) | Dashed, 2px |
| Skiløyper | Lyseblå (#38BDF8) | Dotted, 2px (fremtidig) |

## Nøkkelbeslutninger

- **Plassering:** Natur & Friluftsliv (ikke Transport)
- **Datakilde:** Overpass route relations (ikke alle individuelle ways)
- **Visning:** Kun i aktivert kart-modal, ikke i dormant-tilstand
- **Scope:** Route relations først (navngitte, kuraterte ruter) — ikke hele nettverket

## Referanse

Wesselløkka (wesselslokka.no) har et manuelt tegnet kart med:
- Grøntområder, sykkelruter (rosa), turstier, skiløyper
- Navngitte destinasjoner langs rutene
- Ca 3-4km radius fra prosjektet
Screenshot i `/Users/andreasharstad/.claude/image-cache/`
