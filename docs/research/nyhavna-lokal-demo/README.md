# Nyhavna lokal demo — bruksanvisning

En ren Placy-demo for Nyhavna som henter ALT faginnhold fra lokale JSON-filer.
Ingenting dukker opp av seg selv: hvert sted, hvert fakta, hvert spørsmål og
hver kilde har noen lagt inn med vilje.

Første innhold er de 56 spørsmålene og svarene fra Leve-varianten av
Nyhavna-boardet, importert 2026-09-13. Steder og temakunnskap er fortsatt
tomme — se «Hva demoen har i dag» under.

**URL:** `http://localhost:3103/demo/nyhavna-lokal`
(porten er den dev-serveren faktisk kjører på — sjekk med `git worktree list` og
`lsof -nP -iTCP -sTCP:LISTEN | grep node` før du gjetter)

```bash
npm run dev      # eller PORT=3105 npm run dev fra en worktree
```

Den eksisterende demoen på `/eiendom/nyhavna-utvikling/nyhavna/leve` er uendret
og deler ingen data med denne.

---

## Hvor filene ligger

`data/demo/nyhavna-lokal/`

| Fil | Rolle |
|---|---|
| `board.json` | Identitet, kartutsnitt, kartmotor, hilsen og KATEGORIENE. Ingen fakta. |
| `sources.json` | Kilderegisteret. Stabile ID-er alt annet peker på. |
| `places.json` | Stedene — det som får markør i kartet. |
| `topics.json` | Temakunnskap: fakta og sammenhenger uten ett bestemt sted. |
| `faq.json` | Spørsmål og svar, per tema eller for hele området. |
| `conversations.json` | Samtaleeksempler. **Testgrunnlag, aldri faktakilde.** |
| `eksempel.json` | Dokumentasjon. Lastes ALDRI av demoen. |

Skjemaene står i `lib/demo/nyhavna-lokal/schema.ts`, lasteren i `dataset.ts`.

## Kategoriene som er beholdt

De sju generiske temaene fra Placy-boardet, med samme ID, navn, ikon og farge:

`hverdagsliv` (Hverdag) · `barn-oppvekst` (Oppvekst) · `mat-drikke` (Servering) ·
`natur-friluftsliv` (Natur) · `transport` (Transport) ·
`trening-aktivitet` (Trening) · `opplevelser` (Opplevelser)

Dagens Nyhavna-demo har i tillegg tre temaer bygd på Nyhavna Utviklings egne
«Leve»-sider (Café og restauranter, Park og promenade, Kunst og kultur). De er
IKKE med her (Andreas, 2026-09-13): de er kildens egen inndeling av kildens eget
innhold, og denne demoen skal starte fra den generiske rammen. Skal de inn
senere, legges de til i `board.json` som vanlige kategorier.

ID-ene er med vilje de samme som i det eksisterende boardet: stemmens
interesse-ordliste (`lib/realtime/tour-state.ts`) kjenner dem igjen, så «mat»
åpner riktig tema uten at noe må skrives om.

Tomme kategorier er tilgjengelige. De står i temaraden, kan åpnes, og viser
«Ingen steder er lagt inn i dette temaet ennå.» — sammen med temaets spørsmål og
svar, som ikke trenger et eneste sted for å kunne leses.

---

## Kartet: Kart / Satelitt / 3D

`board.json` har `"map3d": true`. Det gir kartveksleren nederst med tre valg —
**Kart** (Mapbox-vektorkart), **Satelitt** (Google, rett ovenfra) og **3D**
(Google, skrå) — og boardet åpner i Satelitt, som er den letteste orienteringen
på et board uten innlest omvisning. Markørene tegnes på begge motorene med samme
farge og ikon.

Sett `"map3d": false` for å bare ha Mapbox. Google-motoren krever
`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` i `.env.local` (den samme dagens demo bruker).

`"pinSubtitle": ""` gir prosjektmarkøren bare navnet. Utelates feltet, faller
markøren tilbake på sin egen standardtekst («Nybygg 2028») — en påstand om
byggeår demoen ikke har dekning for.

---

## Hva demoen har i dag

| Innhold | Status |
|---|---|
| Kategorier | 7, alle med innhold i sidebaren |
| Spørsmål og svar | 56 (8 for hele området + 48 fordelt på temaene) |
| Steder | 0 — kartet er geografisk bakgrunn, uten markører |
| Temakunnskap | 0 |

Fordelingen av de 48 temaspørsmålene: Hverdag 10, Transport 9, Oppvekst 8,
Trening 7, Servering 6, Natur 4, Opplevelser 4.

## Spørsmål og svar

Ett innhold, to flater. `faq.json` blir både det venstre sidefeltet viser
(`FAQSection`) og spørsmålskatalogen stemmen får i instruksjonen
(`nyhavnaFaqCatalog`). Det er ikke to kopier som må holdes i takt — det er den
samme lista lest to ganger, og en test holder de to identiske.

Et spørsmål uten `categoryId` hører til hele området og står på områdestoppet
(det første stoppet, med navnet på strøket). Med `categoryId` står det under det
temaet — også når temaet ikke har ett eneste sted.

```json
{
  "id": "hvor-er-naermeste-apotek",
  "categoryId": "hverdagsliv",
  "question": "Hvor er nærmeste apotek?",
  "answer": "Det står ikke i materialet ennå. Se [Hverdag](category:hverdagsliv) for det som er lagt inn.",
  "origin": "local",
  "sourceIds": ["nyhavna-leve-board"],
  "caveats": []
}
```

- **Rekkefølgen i fila er rekkefølgen på flaten.** Ingen sortering skjer.
- `origin: "imported"` betyr at svaret er hentet ferdig fra et annet board og
  gjengitt som det sto — det er IKKE etterkontrollert her. Lasteren krever da
  minst én `sourceId`, så det alltid står hvor teksten kommer fra.
  `origin: "local"` er et svar noen har skrevet for denne demoen.
- `[tekst](category:id)` i svaret gjør kategorien klikkbar i sidebaren og
  oppgis til stemmen. Peker den på en kategori som ikke finnes, stopper
  lasteren — en lenke som aldri kan klikkes er en skrivefeil.
- `caveats` følger svaret som forbehold, på samme måte som for steder og temaer.

### Om importen fra Leve-boardet

Svarene er hentet fra `/eiendom/nyhavna-utvikling/nyhavna/leve` slik de STÅR
der, med samme ordlyd, samme tema og samme rekkefølge. De er generert
deterministisk av det boardets 1 400+ steder — reisetider, åpningstider og
opptellinger kommer derfra.

To ting følger av det, og begge er med vilje:

1. **Stedslenkene er skrelt bort.** Svarene bar `[navn](poi:google-ChIJ…)`, som
   peker på stedene i det ANDRE boardet. De finnes ikke her, ville aldri kunnet
   klikkes, og ville vært støy i en fil som skal redigeres for hånd. Selve
   ordlyden er uendret: lenketeksten står igjen som vanlig tekst.
2. **Flere svar snakker om et kart denne demoen ikke har** («91 steder på kartet
   ligger innenfor ti minutter», «Dromedar Kaffebar … 10 minutter til fots»).
   Tallene er sanne om Nyhavna og om Leve-boardet, men denne demoen har ingen
   markører å vise dem på. Derfor har guiden en egen regel om nettopp det (se
   «Stemmen»), og derfor er ingen kart-ID-er med i katalogen den får.

Kildeposten `nyhavna-leve-board` i `sources.json` er selve importsporet: den
sier hvor svarene er hentet fra og når. Den sier IKKE at innholdet er
faktakontrollert på nytt — det er det ikke.

## Legge til et sted

I `places.json`:

```json
{
  "id": "dora-kaffebar",
  "name": "Dora Kaffebar",
  "categoryId": "mat-drikke",
  "coordinates": { "lat": 63.4398, "lng": 10.4172 },
  "address": "Kobbes gate 2",
  "placeType": "Kafé",
  "icon": "Coffee",
  "aliases": ["Dora kafe"],
  "status": "existing",
  "summary": "Nabolagskafé med bakst og håndverkskaffe.",
  "travelTime": { "walk": 2, "bike": 2, "car": 2 },
  "locationPrecision": "sourced",
  "facts": [
    {
      "id": "dora-kaffebar-type",
      "text": "Dora Kaffebar er en nabolagskafé.",
      "sourceId": "nyhavna-servering",
      "checkedAt": "2026-09-14",
      "verification": "confirmed"
    }
  ],
  "sourceIds": ["nyhavna-servering"],
  "checkedAt": "2026-09-14",
  "caveats": ["Åpningstider er ikke kontrollert."]
}
```

- `categoryId` må finnes i `board.json` — ellers stopper lasteren.
- `travelTime` er **minutter**, målt, aldri gjettet. Utelat heller enn å anslå;
  et sted uten tid viser ingen tid, og det er riktig.
- `icon` er et Lucide-navn. Utelatt = kategoriens ikon. Fargen kommer ALLTID fra
  temaet — det er boardets regel, og den er ikke overstyrbar per sted.
- `status: "planned"` merker stedet som planlagt både i kartet og i det stemmen
  sier. `"adopted-plan"` og `"vision"` regnes også som «ikke et tilbud i dag».

## Legge til en temafakta

I `topics.json`:

```json
{
  "id": "nyhavna-gronnstruktur",
  "title": "Parker og allmenninger",
  "categoryIds": ["natur-friluftsliv"],
  "status": "planned",
  "text": "Nyhavna beskriver et planlagt nettverk av parker, byrom og allmenninger nær vannet.",
  "keywords": ["park", "allmenning", "grønt", "byrom"],
  "sourceIds": ["nyhavna-park"],
  "relatedPlaceIds": [],
  "checkedAt": "2026-09-14",
  "caveats": []
}
```

- `categoryIds: []` betyr at fakta gjelder HELE området. Da blir den en del av
  det stemmen svarer med når spørsmålet handler om Nyhavna som sted.
- `keywords` er det stemmens søk treffer på i tillegg til tittel og tekst.
- `relatedPlaceIds` må peke på ID-er i `places.json`.

## Kilder og forbehold

Kilder registreres én gang i `sources.json` og refereres med ID:

```json
{
  "id": "nyhavna-servering",
  "label": "nyhavna.no",
  "page": "Café og restauranter",
  "url": "https://nyhavna.no/leve/cafe-og-restauranter/",
  "publisher": "Nyhavna Utvikling",
  "checkedAt": "2026-09-14"
}
```

Lenk til den **spesifikke** siden, ikke forsiden.

Tre måter å ta forbehold på, med hver sin virkning:

| Felt | Hva det gjør |
|---|---|
| `caveats: ["…"]` | Følger stedet/temaet som forbehold. Stemmen sier det som usikkert, aldri som fakta. |
| `facts[].verification: "unresolved"` | Samme, men for én bestemt påstand du har sett men ikke fått bekreftet. |
| `status` | Skiller dagens tilbud fra planlagt, vedtatt plan, visjon og uavklart. |

`locationPrecision: "approximate"` + `locationNote` brukes når koordinatet er
utledet av en tekstbeskrivelse. Lasteren krever at de to følges ad — et notat om
plassering uten flagget ville tatt forbehold om et koordinat som er belagt.

## Hvordan innholdet henger sammen med kategorier og kart

- `place.categoryId` → temaet stedet vises under, og markørens farge.
- `topic.categoryIds` → temaene guiden henter fakta fra når kapittelet åpnes.
- `place.coordinates` → markøren. Steder uten koordinat finnes ikke i formatet;
  noe kilden navngir uten at det kan plasseres, hører hjemme i kategoriens
  `unplaced` i `board.json` og får aldri markør.
- `faq.categoryId` → temaet spørsmålet står under. Uten feltet: områdestoppet.
- Kart, board og stemme leser det SAMME datasettet. Stemmens kartverktøy
  validerer i tillegg hver ID mot boardet, så en markør på et sted som ikke
  finnes er umulig.

## Krever endringer refresh, restart eller rebuild?

**Bare refresh.** Ruta er `dynamic = "force-dynamic"` og leser filene per
forespørsel. Lagre JSON-en, last siden på nytt.

Én ting å vite: en samtale som allerede er i gang snakker ut fra datasettet slik
det var da den startet. Har du redigert mens fanen sto åpen, avvises en ny
samtale med «Datagrunnlaget er oppdatert. Last boardet på nytt.» Det er en
sikring, ikke en feil.

`npm run build` trenger du ikke. Dev-serveren trenger ikke restart.

## Nye samtaleeksempler

Legges i `conversations.json`:

```json
{
  "id": "2026-09-14-barn-og-spisesteder",
  "recordedAt": "2026-09-14",
  "topic": "barn og spisesteder",
  "notes": "Kort om hva samtalen avdekket.",
  "transcript": [{ "speaker": "bruker", "text": "…" }],
  "questions": [
    { "id": "barnevennlig-servering", "text": "…", "expectation": "…" }
  ]
}
```

De blir **ikke** faktagrunnlag for modellen. `loadDataset` laster dem ikke,
`lib/demo/nyhavna-lokal/voice.ts` importerer dem ikke, og en test holder begge
dørene lukket (`voice.test.ts`, «samtaleeksemplene»). Bruk dem som arbeidsliste:
finn spørsmålene, hent og kontroller informasjonen, legg den inn i `places.json`
eller `topics.json` med kilde.

## Når noe er galt

Lasteren kaster med filnavn, sti i JSON-en og hva som manglet:

```
places.json har ugyldige data:
  • 0.coordinates: Required
```

```
Datasettet i data/demo/nyhavna-lokal/ har brutte referanser:
  • places.json → «dora-kaffebar»: ukjent categoryId «servering» (mangler i board.json).
  • faq.json → «hvor-er-apoteket»: origin er "imported", men sourceIds er tom — oppgi hvor svaret er hentet fra.
```

Feilen vises i nettleseren og i terminalen. Den skal gjøre det — en demo som
stille faller tilbake til noe annet er verdiløs.

---

## Stemmen

| Rolle | Modell |
|---|---|
| Stemme (lyd, samtaleflyt) | `gpt-live-1` — WebRTC, full duplex |
| Backend (fakta, verktøyvalg) | `gpt-5.6-terra` via Responses |

Begge leses fra env (`OPENAI_BOARD_LIVE_MODEL`, `OPENAI_BOARD_BACKEND_MODEL`) med
disse som standard. Ruta nekter å starte hvis stemmemodellen ikke er en
Live-modell, og klienten nekter å koble til en server som ikke svarer
`protocol: "live"` — ingen stille omvei tilbake til Realtime.

Datagrunnlaget velges av boardet (`BoardData.demoDataset`), ikke av URL-en:
denne demoen sender `nyhavna-lokal`, den eksisterende sender ingenting og får
`nyhavna-leve`. Registeret står i `lib/live/demos.ts`.

Guiden får to ekstra regler i denne demoen (`LOCAL_DEMO_INSTRUCTION`):

1. Mangler verktøyene et svar, skal den si kort at den ikke har det i materialet
   ennå — ikke fylle hullet med generell kunnskap, ikke gjette, ikke søke på
   nettet.
2. Kartet er tomt. Den skal ikke kalle `highlight_places` eller `show_place`,
   ikke love å vise eller markere noe, og ikke si «her ser du». Katalogsvarene
   navngir steder og oppgir minutter fra det andre boardet; navn, tall og
   forbehold gjengis som de står, men stedene påstås ikke å ligge i DETTE
   kartet.

Spørsmålene stemmen kan svare med er nøyaktig de sidebaren viser: begge leser
`faq.json`. Katalogen står i den faste delen av instruksjonen, så et
katalogspørsmål kan besvares i én runde.

Simulert samtale uten mikrofon: legg på `?voicedev=1` og bruk `window.placyVoice`
(`start()`, `say()`, `tool()`, `messages()`, `status()`, `stop()`).

---

## Grenser

- **Lokalt bare.** Ruta svarer 404 i produksjonsbygg.
- **Ingen Supabase.** Verken lesing eller skriving, for denne demoen.
- **Ingen steder i kartet.** Importen tok med spørsmål og svar, ikke steder.
  Svar som navngir et sted kan leses og sies, men stedet har ingen markør — og
  flere svar oppgir tall (avstander, opptellinger) som gjelder Leve-boardets
  kart, ikke dette.
- **Ingen lyd, megler, oppsummering eller isokroner.** Datasettet bærer dem ikke,
  og et tomt board som later som det har dem er en løgn om datagrunnlaget.
- **Ingen CMS.** Filene redigeres for hånd eller av en agent. Det er meningen.
