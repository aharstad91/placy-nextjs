# Nyhavna lokal demo — bruksanvisning

En ren Placy-demo for Nyhavna som henter ALT faginnhold fra lokale JSON-filer.
Den starter tom: hvert sted, hvert fakta og hver kilde som dukker opp, har noen
lagt inn med vilje.

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
| `board.json` | Identitet, kartutsnitt, hilsen og KATEGORIENE. Ingen fakta. |
| `sources.json` | Kilderegisteret. Stabile ID-er alt annet peker på. |
| `places.json` | Stedene — det som får markør i kartet. |
| `topics.json` | Temakunnskap: fakta og sammenhenger uten ett bestemt sted. |
| `conversations.json` | Samtaleeksempler. **Testgrunnlag, aldri faktakilde.** |
| `eksempel.json` | Dokumentasjon. Lastes ALDRI av demoen. |

Skjemaene står i `lib/demo/nyhavna-lokal/schema.ts`, lasteren i `dataset.ts`.

## Kategoriene som er beholdt

De ti temaene fra dagens Nyhavna-board, med samme ID, navn, ikon og farge:

`leve-servering` (Café og restauranter) · `leve-park` (Park og promenade) ·
`leve-kultur` (Kunst og kultur) · `hverdagsliv` (Hverdag) ·
`barn-oppvekst` (Oppvekst) · `mat-drikke` (Servering) ·
`natur-friluftsliv` (Natur) · `transport` (Transport) ·
`trening-aktivitet` (Trening) · `opplevelser` (Opplevelser)

ID-ene er med vilje de samme som i det eksisterende boardet: stemmens
interesse-ordliste (`lib/realtime/tour-state.ts`) kjenner dem igjen, så «kaféer»
åpner riktig tema uten at noe må skrives om.

Tomme kategorier er tilgjengelige. De står i temaraden, kan åpnes, og viser
«Ingen steder er lagt inn i dette temaet ennå.»

---

## Legge til et sted

I `places.json`:

```json
{
  "id": "dora-kaffebar",
  "name": "Dora Kaffebar",
  "categoryId": "leve-servering",
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
  "categoryIds": ["leve-park"],
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

Guiden får en ekstra regel i denne demoen (`LOCAL_DEMO_INSTRUCTION`): mangler
verktøyene et svar, skal den si kort at den ikke har det i materialet ennå — ikke
fylle hullet med generell kunnskap, ikke gjette, ikke søke på nettet.

Simulert samtale uten mikrofon: legg på `?voicedev=1` og bruk `window.placyVoice`
(`start()`, `say()`, `tool()`, `messages()`, `status()`, `stop()`).

---

## Grenser

- **Lokalt bare.** Ruta svarer 404 i produksjonsbygg.
- **Ingen Supabase.** Verken lesing eller skriving, for denne demoen.
- **Ingen lyd, megler, oppsummering eller isokroner.** Datasettet bærer dem ikke,
  og et tomt board som later som det har dem er en løgn om datagrunnlaget.
- **Ingen 3D.** Kartet er Mapbox. `has3dAddon` er ikke satt på dette prosjektet.
- **Ingen CMS.** Filene redigeres for hånd eller av en agent. Det er meningen.
