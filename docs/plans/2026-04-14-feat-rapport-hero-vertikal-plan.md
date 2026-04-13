# Plan: Rapport Hero — Vertikal Layout med Transparent Bygningsbilde

**Brainstorm:** `docs/brainstorms/2026-04-14-rapport-hero-vertikal-layout-brainstorm.md`
**Dato:** 2026-04-14
**Fase:** Plan

---

## Mål

Redesigne `ReportHero`-komponenten fra to-kolonne grid til én enkelt, vertikal kolonne der et transparent PNG-bilde av bygningene plasseres sist i hero-seksjonen — uten boks, kanter eller bakgrunn — slik at byggene sømløst flyter inn i innholdet under.

---

## Scope

**I scope:**
- `components/variants/report/ReportHero.tsx` — hoved-endring
- `components/variants/report/ReportPage.tsx` — oppdater `heroImage`-prop-verdi
- `/public/bekkeloep-dagtid-transparent.png` — allerede kopiert ✅

**Utenfor scope:**
- Ingen DB-endringer
- Ingen endringer i PlacyReportHeader/Footer
- Ingen andre ruter enn rapport-ruten

---

## Ny layout (ReportHero.tsx)

### Strukturell endring

**Fra:**
```
<section>
  <div className="grid grid-cols-1 md:grid-cols-2 min-h-[480px]">
    <div> {/* venstre: tittel + ingress + temakort */} </div>
    <div className="hidden md:block"> {/* høyre: bilde i boks med border-radius + shadow */} </div>
  </div>
</section>
```

**Til:**
```
<section>
  <div className="max-w-3xl mx-auto px-6 sm:px-8 pt-12 pb-0 text-center sm:text-left relative">
    {/* Locale toggle — absolutt posisjonert øverst til høyre */}
    <ReportLocaleToggle />
    
    {/* Tittel */}
    <h1>…</h1>
    
    {/* Ingress */}
    <p>…</p>
    
    {/* Temakort */}
    <div className="grid grid-cols-2 gap-2 mb-10">…</div>
  </div>

  {/* Transparent bilde — full bredde, ingen container-boks */}
  {heroImage && (
    <div className="w-full overflow-hidden">
      <Image
        src={heroImage}
        alt={projectName}
        width={1600}
        height={800}
        className="w-full object-contain object-bottom"
        priority
        sizes="100vw"
      />
    </div>
  )}
</section>
```

### Detaljert styling

| Element | Nåværende | Ny |
|---------|-----------|-----|
| Section | `bg-gradient-to-b from-[#faf9f7] via-[#faf9f7] to-white` | Samme gradient |
| Layout-container | `grid grid-cols-1 md:grid-cols-2 min-h-[480px]` | `max-w-3xl mx-auto` |
| Tittel | venstrestilt i venstre kolonne | `text-center sm:text-left` |
| Ingress | venstrestilt | `text-center sm:text-left` |
| Temakort | `grid-cols-2` i venstre kolonne | `grid-cols-2 sm:grid-cols-4` (evt. 2 på alle) |
| Hero-bilde container | `hidden md:block pt-10 pr-12 pb-10` | `w-full overflow-hidden` |
| Hero-bilde | `fill`, `rounded-2xl`, `shadow-sm`, `overflow-hidden` | `w-full object-contain object-bottom`, ingen kanter |

### Bildedimensjoner

`bekkeloep-dagtid-transparent.png` fra remove.bg er sannsynligvis ca. 1200×800 eller 2000×1333 piksler. `next/image` med `width={1600} height={800}` + `w-full` vil respektere aspect ratio. `object-contain` + `object-bottom` sørger for at byggenes bunnlinje er forankret.

**Alternativ:** Bruk `fill`-modus med `padding-bottom: 45%` container — gir mer kontroll over høyde. Velges om `object-contain` gir for mye tom luft over byggene.

---

## Akseptansekriterier

- [ ] `ReportHero` viser tittel, ingress og temakort i én vertikal kolonne
- [ ] Transparent bygningsbilde vises under temakortene, full bredde, ingen border-radius, ingen shadow
- [ ] Ingen synlig "boks" rundt bildet — bakgrunnen bak bygningene er section-bakgrunnen (cream/hvit)
- [ ] Byggene flyter visuelt inn i innholdet under hero-seksjonen uten hard overgang
- [ ] Bildet vises på alle skjermstørrelser (mobil + desktop)
- [ ] `ReportLocaleToggle` er fortsatt tilgjengelig og synlig
- [ ] Ingen TypeScript-feil, ingen lint-feil
- [ ] Visuelt verifisert i Chrome: `/eiendom/broset-utvikling-as/wesselslokka/rapport`

---

## Gjennomføringssteg

### Steg 1: Oppdater `ReportHero.tsx`
- Erstatt to-kolonne grid med enkelt-kolonne layout
- Flytt bilde ut av sin container-boks, renderere fullbredde under tekstinnholdet
- Fjern `hidden md:block` fra bilde-wrapper (vis på alle skjermstørrelser)
- Fjern `rounded-2xl`, `shadow-sm`, `overflow-hidden` fra bilde-container
- Tilpass `Image` props: `width`, `height`, `className`, `sizes`

### Steg 2: Oppdater `ReportPage.tsx`
- Endre `heroImage="/bekkeloep-dagtid.webp"` til `heroImage="/bekkeloep-dagtid-transparent.png"`

### Steg 3: Verifiser visuelt
- Ta screenshot av `/eiendom/broset-utvikling-as/wesselslokka/rapport` i Chrome
- Sjekk: bygninger over overgangen til temamapene under
- Sjekk mobilvisning (DevTools emulation)
- Kjør `npm run lint` og `npx tsc --noEmit`

---

## Risiko og mitigeringer

| Risiko | Sannsynlighet | Mitigering |
|--------|---------------|------------|
| For mye tom luft over byggene i bilde | Medium | Bytt til `fill`-modus med fast container-høyde |
| Bilde ser pikselert ut på stor desktop | Lav | Legg til `quality={90}` på `<Image>` |
| Temakort ser merkelig ut sentrert | Lav | Behold `text-left` (ikke sentrering) |
| Gammel webp-fil referert fra andre steder | Lav | Beholdes — ingen sletting |

---

## Tech Audit Verdict

**GREEN** — Alle endringer er isolert til to eksisterende filer. Bildefilen er allerede i `/public/`. Ingen nye avhengigheter. Ingen migrasjoner. Lav risiko.

Eneste beslutning som krever visuell verifikasjon: `object-contain` vs. `fill`-modus for bildehøyde på desktop.
