# Brainstorm: Rapport Hero — Vertikal Layout med Transparent Bygningsbilde

**Dato:** 2026-04-14
**Status:** Besluttet — klar for plan

---

## Problemet

Nåværende `ReportHero.tsx` bruker et to-kolonne grid (md+):
- Venstre: tittel + ingress + temakort (2-kol grid)
- Høyre: heroImage i en rundet boks med shadow

To problemer:
1. To-kolonne layout er "tradisjonell boks" — visuelt ikke spesielt sterk
2. Det eksisterende bildet (`bekkeloep-dagtid.webp`) har blå himmel, og bilde-kontaineren kapper det inne med border-radius + shadow — det ser ut som "et bilde på en nettside", ikke integrert design

## Ny retning

Brukeren har laget et transparent PNG (`bekkeloep-dagtid-transparent.png`) der himmelen er fjernet. Byggene er kuttet ut slik at de kan "stå" uten bakgrunn.

**Ønsket layout (fullbredde, én kolonne, mobil-first):**
1. Tittel (h1) — sentrert eller venstrestilt
2. Ingress-tekst — under tittelen
3. Temakort (ThemeChip grid) — under ingressen
4. Transparent bygningsbilde — nederst i hero-seksjonen, sømløst uten boks/kanter

**Nøkkeleffekt:** Byggene "vokser opp" fra bunnen av hero-seksjonen og flyter visuelt inn i det påfølgende innholdet. Bakgrunnen bak byggene er cream/hvit — matcher neste seksjons bakgrunn — så det er ingen synlig skarp overgang.

---

## Beslutninger

### 1. Layout: fullbredde én kolonne
- Fjern to-kolonne grid helt
- Alt sentreres eller venstrestilles i én kolonne
- Tekstinnhold: max-width for lesbarhet (f.eks. `max-w-2xl`)

### 2. Transparent bilde — ingen container-box
- Ingen `rounded-xl`, ingen `shadow`, ingen `overflow-hidden`
- `next/image` med `width` + `height` (intrinsic) eller `fill` + container uten clips
- Bilde: `object-contain` eller `object-bottom` avhengig av hva som ser best ut
- Ingen margin/padding under bildet i hero-seksjonen

### 3. Bakgrunnshåndtering
- Hero-seksjonen: cream (`#faf9f7`) gradient som i dag
- Neste seksjon (innhold): hvit eller cream — begge matcher transparent bilde
- Resultat: bygningssilhuetten "flyter" inn i neste seksjon uten synlig grense

### 4. Bildefil
- Ny fil: `/public/bekkeloep-dagtid-transparent.png`
- Gammel fil: `/public/bekkeloep-dagtid.webp` beholdes (andre referanser kan finnes)
- `ReportHero` oppdateres til å ta `heroImage` som prop (kan settes per-prosjekt via DB)

### 5. Mobilhåndtering
- Bilde vises på alle skjermstørrelser (ikke `hidden md:block` som nå)
- På mobil: bildet kan ha litt lavere `max-height` for å ikke ta for stor plass
- Temakort på mobil: enkel 2-kolonne grid (uendret fra nå)

### 6. ThemeChip-plassering
- Flyttes ned under ingress, og over bildet
- Potensielt med en tydelig overskrift: "Utforsk nabolaget:" eller bare som grid uten heading

### 7. Intet scope for nå
- ReportLocaleToggle beholdes (posisjoneres øverst til høyre i seksjonen)
- Ingen endringer i temadataseksjoner under hero
- Ingen endringer i PlacyReportHeader/Footer

---

## Tekniske notater

**`ReportHero.tsx`** (eneste fil som endres for layout):
- Fjern `grid grid-cols-1 md:grid-cols-2 min-h-[480px]`
- Ny struktur: `<section> → <div max-w-wrapper> → h1 → p → chips → image</div></section>`
- Bildet: `<Image src={heroImage} width={1200} height={600} className="w-full object-contain" />`
  - Evt. `object-bottom` for at toppen beskjæres ved smal visning

**`ReportPage.tsx` linje 125:**
- Oppdater `heroImage` prop til `/bekkeloep-dagtid-transparent.png`

**Bakgrunn og overgang:**
- Hero-section beholder cream-gradient
- Ingen margin-bottom på section
- Neste seksjon (tre-kolonne layout i ReportPage) beholder sin hvite bakgrunn
- Transparent bilde blender visuelt inn

---

## Risiko

Lav. Endringene er isolert til `ReportHero.tsx` og én linje i `ReportPage.tsx`. Ingen datamodell-endringer, ingen migrasjoner, ingen nye avhengigheter.

Eneste risiko: bildeoppløsning og aspect ratio. PNG fra remove.bg har en bestemt dimensjon — sjekk at `next/image` ikke komprimerer den for mye på desktop (bruk `sizes` prop).
