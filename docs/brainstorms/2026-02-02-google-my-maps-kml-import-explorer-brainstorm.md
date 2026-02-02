# Google My Maps → Placy Explorer (KML Import)

**Dato:** 2. februar 2026
**Status:** Brainstorm ferdig, klar for plan

## Hva vi bygger

Et CLI-script som tar en Google My Maps-URL (eller KML-fil) og oppretter et ferdig Placy Explorer-prosjekt automatisk. Formålet er å vise at Placy gir en dramatisk bedre UX enn Google My Maps — spesielt på mobil.

### Første case: Open House Oslo 2025

- ~70+ arkitektoniske steder i Oslo, organisert etter bydel
- Google My Maps: https://www.google.com/maps/d/viewer?mid=1R17q4gu1_9PHYprldgCJlPdxb-AGTkU
- Bydeler som fargede lag: St. Hanshaugen, Grünerløkka, Nesodden, Ullern, Bærum, Frogner m.fl.
- Konseptet utvides nå til Trondheim (Adressa-artikkel 2. feb 2026)

## Hvorfor denne tilnærmingen

**Google My Maps vs. Placy Explorer:**

| | Google My Maps | Placy Explorer |
|---|---|---|
| Mobil-UX | Tregt, zoombart desktop-kart | Native bottom sheet, swipe-navigering |
| GPS | Ingen reisetider | Live reisetider (gå/sykle/bil) |
| Filtrering | Kun lag av/på | Kategorier, tidsbudsjett, søk |
| Offline-følelse | Ingen | Rask, app-lignende |
| Branding | Google-merket | Hvitmerket, tilpassbar |

**Strategisk verdi:**
- Referansecase som bygger kjentskap (ikke direkte inntekt)
- Salgsdemo: "Dere har allerede dataene — vi gjør dem 10x bedre"
- Viser Open House, byarkitekter og kulturaktører hva Placy kan
- Potensielt leads til betalende kunder (kommuner, festivaler, turisme)

## Nøkkelbeslutninger

1. **Tilnærming:** CLI-script (`npm run import:kml`), ikke admin-UI ennå
2. **Datakilde:** Google My Maps KML-eksport (offentlig endpoint)
3. **Kategorisering:** KML-lag/folders → Explorer-kategorier direkte (bydeler)
4. **Innhold:** Gjenskap det som finnes — navn, koordinater, beskrivelser fra KML. Ingen AI-beriking.
5. **Første case:** Open House Oslo 2025-kartet

## Teknisk skisse

### Dataflyt

```
Google My Maps URL
  ↓
KML-eksport (https://www.google.com/maps/d/kml?mid=MAP_ID&forcekml=1)
  ↓
Parse KML (xml2js eller lignende)
  - <Folder> → Kategori (navn + farge fra <Style>)
  - <Placemark> → POI (navn, beskrivelse, koordinater)
  - <description> HTML → ren tekst + eventuelt bilde-URL
  ↓
Opprett i Supabase
  - Ny customer (om nødvendig)
  - Nytt project (type: explorer)
  - Kategorier fra KML-folders
  - POI-er med koordinater og metadata
  ↓
Ferdig Explorer-URL: /customer/project-slug
```

### KML-struktur (forventet)

```xml
<Document>
  <Folder>
    <name>St. Hanshaugen/Sentrum Vest</name>
    <Style>...</Style>
    <Placemark>
      <name>Aulaen</name>
      <description><![CDATA[Karl Johans gate 47...]]></description>
      <Point><coordinates>10.735,59.914,0</coordinates></Point>
    </Placemark>
    ...
  </Folder>
  ...
</Document>
```

### Mapping til Placy-modell

| KML | Placy |
|-----|-------|
| `<Document><name>` | Project name |
| `<Folder>` | Category |
| `<Folder><name>` | Category name |
| `<Style>` icon/color | Category color |
| `<Placemark>` | POI |
| `<Placemark><name>` | POI name |
| `<Placemark><description>` | POI editorialHook / description |
| `<Point><coordinates>` | POI lat/lng (NB: KML = lng,lat,alt) |
| Midtpunkt av alle POIs | Project centerCoordinates |

## Åpne spørsmål

- **Bilder:** Har Open House-kartet bilder i KML-beskrivelsene, eller bare tekst? Må sjekke faktisk KML.
- **Customer-slug:** Hva kaller vi kunden? `open-house-oslo`? Eller mer generelt?
- **Farge-mapping:** KML-styles har hex-farger. Placy-kategorier bruker egne farger. Direkte mapping eller manuell?
- **Duplikater:** Noen steder kan ha Google Place ID. Sjekke mot eksisterende POIs?

## Neste steg

Kjør `/workflows:plan` for å lage implementeringsplan for CLI-scriptet.
