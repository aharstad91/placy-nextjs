# Onboarding / Velkomstskjerm for Placy-prosjekter

**Dato:** 2026-02-27
**Status:** Brainstorm ferdig, klar for plan

## Hva vi bygger

En velkomstskjerm som erstatter dagens landingsside (`/for/kunde/prosjekt/`). Når en besøkende klikker en lenke fra f.eks. Overvik.no, lander de på en minimal, fokusert side som:

1. Presenterer eiendommen med navn og kort tagline
2. Lar brukeren velge hvilke temaer/kategorier de er interessert i
3. Sender dem rett inn i default-produktet (f.eks. Report), tilpasset etter valgte temaer

## Hvorfor denne tilnærmingen

**Problem i dag:** Besøkende fra eiendomsnettsider lander på en produktvalg-side (Explorer / Report / Trip) uten kontekst om eiendommen eller området. De må selv forstå hva de ser på og velge et produkt de ikke kjenner forskjellen på.

**Løsning:** En velkomstside som gir rask kontekst og lar brukeren signalisere hva de bryr seg om — uten å blokkere de som vil rett inn. Personalisering via prioritering, ikke filtrering.

## Nøkkelbeslutninger

### 1. Format: Ny landingsside (ikke overlay)
Velkomstskjermen *erstatter* dagens landingsside. Det er renere enn en overlay/modal og kommuniserer at dette er starten på opplevelsen.

### 2. Minimal intro
Eiendomsnavn + kort tagline. Ikke vegg av tekst, ikke kart-preview, ikke nøkkeltall. Rask og fokusert — brukeren skal videre til innholdet fort.

### 3. Tema-valg med opt-out (ikke opt-in)
Alle ~7 temaer (Mat & Drikke, Aktivitet & Fritid, Kultur, etc.) er forhåndsvalgt. Brukeren kan huke *av* det som ikke er relevant. Lav terskel — de som vil alt, bare trykker CTA.

### 4. Granularitet: Eksisterende temaer
Bruker temaene vi allerede har definert (`lib/themes/default-themes.ts`). Ingen ny taksonomi nødvendig.

### 5. Prioritering, ikke filtrering
Fravalgte temaer fjernes IKKE — de dempes:
- **Report:** Valgte temaer vises som hovedseksjoner. Fravalgte samles under "Andre kategorier" lenger ned.
- **Explorer:** Valgte tema-kategorier er aktive på kartet. Fravalgte er deaktivert (dimmet), men kan toggles på igjen.

### 6. Default-produkt per prosjekt
Hvert prosjekt definerer et default-produkt (f.eks. `defaultProduct: "report"`). Velkomstens CTA navigerer rett dit. Produktbytte tilgjengelig via navigasjon i produktet.

### 7. Ingen persistens
Velkomsten vises ved hvert besøk. Tema-valg lagres ikke i localStorage. Brukeren kan justere valg hver gang.

### 8. Målgruppe: Begge
Både tidlige utforskere og seriøse kjøpere. Minimal intro funker for begge — de som kjenner eiendommen hopper rett videre, de som er nye får kontekst uten å drukne.

## Brukerflyt

```
Overvik.no → klikk "Se nabolaget"
    ↓
/for/overvik/overvik-sorgenfri/
    ↓
┌─────────────────────────────┐
│   OVERVIK SORGENFRI         │
│   Bo midt i byens puls      │
│                              │
│   Hva er du interessert i?  │
│   ☑ Mat & Drikke            │
│   ☑ Aktivitet & Fritid     │
│   ☐ Kultur & Historie      │  ← brukeren huket av denne
│   ☑ Natur & Friluft        │
│   ☑ Shopping & Service     │
│   ☑ Transport              │
│   ☑ Utdanning & Barnehage  │
│                              │
│   [ Utforsk nabolaget → ]   │
└─────────────────────────────┘
    ↓
/for/overvik/overvik-sorgenfri/report?themes=mat-drikke,aktivitet,...
    ↓
Report med valgte temaer først,
"Kultur & Historie" under "Andre kategorier" nederst
```

## Datamodell-endringer

Prosjektet trenger nye felter:

```typescript
// I ProjectContainer eller tilsvarende
{
  welcomeTagline?: string       // "Bo midt i byens puls"
  defaultProduct: ProductType   // "report" | "explorer" | "guide"
}
```

Tema-preferanser overføres via URL query params (ingen persistens):
```
?themes=mat-drikke,aktivitet,natur,shopping,transport,utdanning
```

## Påvirkning på eksisterende produkter

### Report
- Lese `themes` query param
- Sortere seksjoner: valgte temaer først, fravalgte under "Andre kategorier"-skillelinje
- Ingen innholdsendring — bare rekkefølge og visuell hierarki

### Explorer
- Lese `themes` query param
- Sette initielle kategori-toggles basert på valg
- Fravalgte kategorier deaktivert men synlige

### Guide/Trip
- Ingen endring foreløpig (trips er lineære, rekkefølge bestemt av rute)

## Åpne spørsmål

1. **CTA-tekst:** "Utforsk nabolaget", "Se rapporten", "Kom i gang" — hva treffer best?
2. **Tema-presentasjon:** Bare tekst med checkbox, eller ikoner/illustrasjoner per tema?
3. **Mobil-layout:** Vertikal liste funker, men skal vi ha en mer kompakt variant (2x2 grid)?
4. **Prosjekter med bare Explorer (ikke Report):** Default-produkt håndterer dette, men bør CTA-teksten endre seg?
5. **Analytics:** Skal vi tracke hvilke temaer som velges bort? Verdifull innsikt for kunder.
