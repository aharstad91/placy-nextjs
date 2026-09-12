# Nyhavna «Leve»-demo — kjøreoppskrift og kontrollgrunnlag

Møtedemo for Lene Fjellstad, leder marked og kommunikasjon i Nyhavna Utvikling,
onsdag 16. september 2026.

**URL:** `http://localhost:3003/eiendom/nyhavna-utvikling/nyhavna/leve`
**Gren:** `feat/nyhavna-leve-demo` i worktree `../placy-nyhavna-demo`
**Ikke pushet, ikke merget, ikke publisert.**

Start dev-serveren fra worktreen:

```bash
cd ../placy-nyhavna-demo && PORT=3003 npm run dev
```

Den eksisterende demoen står uendret på
`/eiendom/nyhavna-utvikling/nyhavna/rapport-board`.

---

## Det demoen skal bevise

> Innholdet dere allerede har laget om Nyhavna, kan bli lettere å forstå og
> oppdage når det knyttes til stedene i kartet.

## Slik vises det på møtet

1. **Åpne URL-en, trykk «Utforsk nærområdet».** Kartet flyr inn over Nyhavna.
2. **Pek på rutenettet i kolonnen.** Det er delt i to: «Fra nyhavna.no —
   innholdet dere har publisert, plassert i kartet», og «Nabolaget rundt — alt
   annet som ligger her, hentet og målt av Placy». Det er hele poenget i én
   skjerm.
3. **Kunst og kultur** → et konkret OMRÅDE. Kulturaksen tegnes som en linje
   langs Skippergata, Fyringsbunkeren og Dora 2 som sine faktiske
   bygningsomriss. Bunkerparken bærer «Planlagt».
4. **Park og promenade** → et FORLØP. Elvepromenaden er 404 m linje langs
   Nidelva. Teksten sier både at den kan gås i dag og hva den skal bli.
5. **Café og restauranter** → et STED. Åpne Dora Kaffebar: Nyhavnas egen
   beskrivelse, deres Instagram, og «Omtalt på nyhavna.no» som egen kildelinje.
6. **Pek på «Nevnt i kilden, men ikke plassert i kartet».** Doratorget,
   Kullkranparken, Jernbaneparken, Transittparken, Elveparken og allmenningene
   ved Ladehammerkaia. Dette er samtalen om hvilke data som mangler.
7. **Bytt til «Kart»** (kartveksleren nederst) — samme geometri på
   Mapbox-motoren.

## Presisjonsreglene demoen holder

| Regel | Hvordan den vises |
|---|---|
| Kildens ord, ikke våre | «Tekst og utvalg fra … på nyhavna.no» under hver tematekst |
| Eksisterende vs. planlagt | «Planlagt»-pille + svakere/stiplet geometri |
| Plassering uten belegg merkes | «Plassert omtrentlig …» som egen linje (Bunkerparken) |
| Ingenting tegnes uten kilde | Doratorget har ingen pin — står i «ikke plassert» |
| Minutter måles, gjettes ikke | Mapbox Matrix, `scripts/nyhavna-leve-travel-times.ts` |

## Kontrollert 2026-09-11

- `npm test`: 239 filer, **3 985 tester grønne**
- `npx tsc --noEmit`: 0 feil. `npm run lint`: 0 errors
- `npm run build`: kompilerer; ruta prerendres som SSG med én params-oppføring
- Desktop 1440×900 og mobil 390×844 i nystartet Chrome, **0 console-feil**
- Geometri kontrollert på **begge** kartmotorer (Google Satelitt + Mapbox Kart)
- `/rapport-board` kontrollert som uendret: 0 treff på samtlige nye demo-tekster

## Skjermbilder

| Fil | Viser |
|---|---|
| `nyhavna-leve-01-desktop-inngang.png` | De to gruppene i rutenettet |
| `nyhavna-leve-02-desktop-kulturaksen.png` | Område: linje + to bygningsomriss |
| `nyhavna-leve-03-desktop-elvepromenaden.png` | Forløp: 404 m linje langs Nidelva |
| `nyhavna-leve-04-desktop-dora-kaffebar-kilde.png` | Sted: kildelenke + egen kanal |
| `nyhavna-leve-05-mapbox-flater-og-forbehold.png` | Mapbox-motoren + omtrentlig-forbehold |
| `nyhavna-leve-06-mobil-kulturaksen.png` | Mobil, 390×844 |

## Kilder

Alt innhold er hentet 11. september 2026 fra:

- <https://nyhavna.no/leve/>
- <https://nyhavna.no/leve/cafe-og-restauranter/>
- <https://nyhavna.no/leve/park-og-promenade/>
- <https://nyhavna.no/leve/kunst-og-kultur/>

Geometri og koordinater fra OpenStreetMap (Overpass), med OSM-objekt-ID i
`lib/demo/nyhavna-leve/geometry.ts`. Bildene i `public/demo/nyhavna/` er
Nyhavna Utviklings egne, hentet fra park-og-promenade-siden — de vises tilbake
til eier i en lokal demo, ikke publisert.

## Grenser

- **Hardkodet demo-innhold**, ikke CMS-integrasjon. `lib/demo/nyhavna-leve/`.
- **Ingenting skrevet til Supabase.** POI-poolen er delt mellom kunder, og
  flettingen skjer i minnet (`lib/demo/nyhavna-leve/build.ts`).
- **Splash-copyen er boardets generiske**, ikke «Leve»-spesifikk.
