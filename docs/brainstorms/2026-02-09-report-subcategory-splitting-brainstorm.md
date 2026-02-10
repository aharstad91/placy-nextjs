# Report: Automatisk splitting av store kategorier i sub-seksjoner

**Dato:** 2026-02-09
**Status:** Besluttet

## Problemet

For sentrumsnære eiendommer kan et enkelt tema som "Mat & Drikke" inneholde 99+ POI-er fordelt på restaurant, kafé, bar og bakeri. Etter "Hent flere punkter" blir listen uoverkommelig lang, kartet overfylt med markører, og brukeropplevelsen bryter sammen.

Problemet er variabelt — for et objekt på bygda har samme tema kanskje bare 8 POI-er og fungerer fint som det er.

## Hva vi bygger

**Adaptiv sub-kategori-splitting**: Når en sub-kategori (f.eks. "Restaurant") innenfor et tema har mer enn 15 POI-er, brytes den automatisk ut som egen sub-seksjon under foreldre-temaet.

### Eksempel: Scandic Lerkendal (sentrum)

```
Mat & Drikke (overordnet header, stats, intro)
├── Restauranter (42 steder) — egen sub-seksjon med header, stats, kort, kart
├── Kaféer (31 steder) — egen sub-seksjon
├── Barer (18 steder) — egen sub-seksjon
└── Bakerier (8 steder) — forblir i samlet liste (under terskel)
```

### Eksempel: Fiktivt Bygdeobjekt

```
Mat & Drikke (8 steder) — ingen splitting, vises som i dag
├── 3 highlights
└── 5 listeoppføringer
```

## Hvorfor denne tilnærmingen

- **Adaptiv**: Fungerer for både sentrum (mange POI-er) og bygd (få POI-er) uten konfigurasjon
- **Hierarkisk**: Beholder "Mat & Drikke" som overordnet kontekst — brukeren forstår sammenhengen
- **Gjenbruker eksisterende data**: Kategoriene finnes allerede på hver POI — ingen ny datamodell
- **Progressiv disclosure**: Starter med overblikk, lar brukeren dykke ned i sub-kategorier

## Nøkkelbeslutninger

| Beslutning | Valg | Begrunnelse |
|-----------|------|-------------|
| Terskelverdi | 15 POI-er (fast) | Enkel regel. Kan justeres senere. |
| Implementering | Runtime i `transformToReportData` | Data fra Supabase, splitting skjer ved rendering |
| Visuell gruppering | Nestet under foreldre-tema | Beholder hierarkisk struktur: "Mat & Drikke" > "Restauranter" |
| Editorial-innhold | Genereres automatisk per sub-seksjon | AI/templates lager intro og quote basert på kategori og stats |
| Kart-synk | Sticky map viser markører for aktiv sub-seksjon | Scroll-tracking bytter mellom sub-seksjoner |

## Teknisk design (overordnet)

### Runtime-splitting i `transformToReportData`

```
For hvert tema:
  1. Tell POI-er per sub-kategori (poi.category.id)
  2. Kategorier med >15 POI-er → egne sub-seksjoner
  3. Kategorier med <=15 POI-er → samlet i "Andre" (eller forblir i hovedlisten)
  4. Generer editorial-tekst per sub-seksjon
```

### Datastruktur-utvidelse

`ReportTheme` utvides med et valgfritt `subSections`-felt:

```
ReportTheme
├── id, name, icon, intro, stats (som før)
├── subSections?: ReportSubSection[]  ← NY
│   ├── categoryId, name, icon
│   ├── pois[], highlightPOIs[], hiddenPOIs[]
│   └── intro, quote (auto-generert)
└── remainingPOIs[] (kategorier under terskel)
```

### Visuell struktur

```
[Mat & Drikke] — overordnet header med samlet stats
  │
  ├── [Restauranter] — sub-header, 42 steder, egne stats
  │   ├── 3 highlight-kort
  │   ├── 6 listekort
  │   └── "Hent flere (33)"
  │
  ├── [Kaféer] — sub-header, 31 steder
  │   ├── 3 highlight-kort
  │   ├── 6 listekort
  │   └── "Hent flere (22)"
  │
  └── [Barer, Bakerier] — samlet (under terskel)
      └── 26 steder i felles liste
```

### Kart-oppførsel

- Sticky map viser markører for aktiv sub-seksjon (scroll-tracking)
- Overordnet tema-header viser alle markører i temaet
- Sub-seksjon viser kun sine egne markører

## Åpne spørsmål

1. **Terskel for "Andre"-gruppen**: Skal små kategorier under terskel vises som en samlet "Andre"-seksjon, eller som en flat liste uten sub-header?
2. **Hero-navigasjon**: Skal hero-seksjonens tema-kort vise sub-kategorier for store temaer?
3. **Hent flere per sub-seksjon**: Skal hver sub-seksjon ha sin egen "Hent flere"-knapp, eller lastes alt inn sammen?

## Berørte filer

| Fil | Endring |
|-----|---------|
| `components/variants/report/report-data.ts` | Splitting-logikk i `transformToReportData` |
| `components/variants/report/ReportThemeSection.tsx` | Render sub-seksjoner med headers |
| `components/variants/report/ReportStickyMap.tsx` | Markør-filtrering per sub-seksjon |
| `components/variants/report/ReportPage.tsx` | Scroll-tracking for sub-seksjoner |
| `lib/themes/default-themes.ts` | Evt. metadata per kategori for editorial-generering |
