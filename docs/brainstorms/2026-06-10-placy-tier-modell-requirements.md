---
date: 2026-06-10
topic: placy-tier-modell
---

# Placy nivå-modell (1/2/3) for rapport-board

> Terminologi: «nivå» brukes gjennomgående i prosa og salg; «tier» reserveres for kodefelt-referanser (feltnavn avgjøres i plan).

## Problem Frame

Rapport-boardets «nivå» styres i dag av minst seks uavhengige signaler spredt over data og kode: `themes[].editorial`-presence, `audioTourEnabled`, `themes[].audio`, `themes[].reelsAudio`, `has3dAddon` og slug-oppslag i `components/variants/report/board/camera-tours.ts` (pluss `assets`-flagg for brand). Ingenting håndhever at signalene henger sammen, så et prosjekt kan bli en «halv nivå 3» uten at noen merker det — som Grilstad Marina nå: audio-tur, editorial og reels-manus er på plass, men `has3dAddon` og camera-tours-entry mangler. Boardet ser ferdig ut, men reels-opplevelsen mangler kino-delen StasjonsKvartalet har.

Modellen finnes allerede halvveis: `lib/types.ts` kommenterer nivå 1/2/3, og kommersielt er den i bruk — Teknostallen ble sendt KLP som «basic-tier» med StasjonsKvartalet som «maksversjon»-oppsalg (`docs/strategy/LOG.md`, 2026-06-09). Det som mangler er en eksplisitt deklarasjon per prosjekt og en validering som fanger halvferdige boards før de sendes til kunde.

## Nivå-definisjoner (ratifisert)

| Nivå | Navn | Innhold | Referanse |
|------|------|---------|-----------|
| 1 | Basic | 3D-kart, POI-er, kategorier, reisetider, sanntids transport/bysykkel. Klikk = velg på kart, intet detalj-panel. | Teknostallen (klp-eiendom) |
| 2 | +Editorial | Nivå 1 + kuratert drill-in per kategori (`editorial`: brødtekst, highlight-chips, bilde). | — (ikke solgt) |
| 3 | Maks | Nivå 2 + guidet audio-tur m/ karaoke, reels-feed m/ reels-VO, cinematic 3D camera-tours, brand-assets. | StasjonsKvartalet |

Merk: 3D-kart og live transport er **nivå 1**-innhold — ikke nivå 3-differensiator. Det som skiller nivå 3 er fortelling: audio, reels og kamera-regi.

Nivå 2 er en provisorisk mellomtier — ikke solgt eller priset; den skiller editorial-innhold fra full fortelling og er ingen kommersiell forpliktelse før strategi-loggen sier noe annet (salget opererer i dag med to trinn: basic/maks).

### Justering 2026-06-10 (etter live-verifisering, ratifisert av produkteier)

Premisset «render-gatingen er `rc.audioTourEnabled`» viste seg å gjelde den gamle rapport-siden, ikke boardet. Boardet gater på *lyd-tilstedeværelse*: spiller `pickPlayable(reelsAudio) ?? pickPlayable(audio)` der spillbart = manus+url. Verifisert mot live StasjonsKvartalet (fungerer med kun reels-VO i config) og Grilstad (fungerer med kun tour-spor). Konsekvens — modellen forenkles:

- **Nivå 3 audio-krav = spillbart VO-spor per tema + welcome/hjem/outro.** Hvilket av de to sporene (reelsAudio/audio) som bærer VO-en er implementasjonsakse, ikke nivå-krav.
- **`audioTourEnabled` droppes som krav** — dødt flagg på boardet (ingen UI-konsument).
- Kjernen i modellen står: produkteier deklarerer nivået ved oppsett (enkel sjekk i starten), hvert nivå har en kravliste med required elements, validatoren sier fra når noe mangler.

## Requirements

**Nivå-deklarasjon**
- R1. Hvert rapport-board-prosjekt deklarerer eksplisitt nivå (1, 2 eller 3) i prosjektdataene.
- R2. Deklarasjonen er sannhetskilde for tiltenkt leveransenivå — det kunden har kjøpt, eller det demoen er bygget for å vise (pre-revenue: alle dagens boards er demo/prospekt-assets). Den dokumenterer intensjon, ikke bare observert feature-tilstand.

**Validering**
- R3. En validering sjekker at deklarert nivå er fullt dekket: nivå 2 krever editorial på ALLE kategorier; nivå 3 krever i tillegg audio-tur (manus + url per spor, alle temaer), reels-VO (alle temaer), camera-tours-entry for sluggen, 3D-addon og brand-assets (`assets`-flagg). Sjekklisten skal speile nivå-definisjonstabellen 1:1. Valideringen dekker BEGGE datakilder fra start: lokal JSON (`data/projects/`) og Supabase (`products.config`).
- R3b. Nivå-deklarasjonen settes interaktivt: pipelinen (`generate:story` / oppgraderings-kommando) spør «hvilket nivå?» ved oppsett og skriver svaret i prosjektdataene. Ved senere avvik feiler valideringen med to utveier — fullfør manglene, eller re-deklarer ned. Ingen waiver-liste; delvis nivå 3 deklareres ærlig som nivå 2 (render-laget gater ikke på nivået, så featurene som finnes vises fortsatt).
- R4. Valideringen feiler høylytt ved avvik («deklarert nivå 3, mangler: camera-tours, has3dAddon») — ingen stille degradering. Når den fanger dagens Grilstad-tilstand, har den bevist verdien sin.
- R5. Eksisterende prosjekter klassifiseres ved innføring: Teknostallen = 1, StasjonsKvartalet = 3, Grilstad Marina = 3 (etter løft, se R6).

**Grilstad-løft til ekte nivå 3**
- R6. Grilstad Marina løftes til komplett nivå 3 som del av samme arbeid: camera-tours-entry for sluggen, `has3dAddon`, og stemmelegging av de ferdigskrevne reels-manusene (egen mp3 per tema — må ikke overskrive audio-tur-filene, jf. reels-audio-override-aksen: reels har eget lydspor (`reelsAudio`) adskilt fra audio-tur-sporet (`audio`), så reels-mp3 lagres under egen nøkkel — ellers ødelegges karaoke i rapport-boardet).
- R7. Etter løftet består Grilstad valideringen og fungerer som referanse-implementasjon nr. 2 ved siden av StasjonsKvartalet.

## Success Criteria

- Et deklarert nivå kan ikke være under-levert uten at valideringen sier fra ved valgt kjørepunkt (kjørepunkt avgjøres i plan) — Grilstad-situasjonen kan ikke gjenta seg stille. Kjent restrisiko: feil/utdatert deklarasjon fanges ikke, og deling av en allerede deployet URL er ikke et gatet event.
- Ett normalisert felt (plassering avgjøres i plan) svarer på «hvilket nivå er dette prosjektet?» — ikke seks signaler.
- Grilstad-boardet har samme reels-opplevelse som StasjonsKvartalet (kino-kamera + reels-VO).
- Nivå-språket i kode matcher nivå-språket i salg (basic/maks per strategi-loggen).

## Scope Boundaries

- **Render-laget gater IKKE på nivå-feltet** — eksisterende feature-flagg styrer fortsatt rendering. Nivået er deklarasjon + validering ved valgt kjørepunkt (feiler commit/build/test ved avvik), ikke en runtime-bryter. (Bevisst valg: minst omskriving, per-prosjekt-unntak forblir mulige — se åpent spørsmål om waiver-mekanisme.)
- **Ingen prising-endringer** — nivå-modellen speiler eksisterende kommersiell praksis (basic vs. maks), den definerer ikke nye priser. Prising lever i `docs/strategy/`.
- **Explorer/Guide-produktene berøres ikke** — modellen gjelder rapport-board.
- **Ingen Supabase-migrasjon kreves for Grilstad** — prosjektet lever som lokal JSON (prototype-stadium).

### Deferred to Separate Tasks
- Auto-utledning av «observert nivå» som diff mot deklarert nivå (admin-verktøy) — tas opp hvis/når admin-flaten bygges.
- Promotering av camera-tours fra lokal fil til Supabase (`ReportThemeConfig.camera`) — allerede deferert i kodekommentar, uendret.

## Key Decisions

- **Deklarert + validering, ikke auto-utledet:** Auto-utledning kan ikke skille «halvferdig nivå 3» fra «ferdig nivå 2» — selve problemet vi løser. Deklarasjonen dokumenterer dessuten salgsavtalen.
- **Tier gater ikke rendering:** Strammest kobling (én bryter) ville krevd omskriving av render-laget og fjernet fleksibilitet; validering gir samme trygghet billigere.
- **3D-kart i nivå 1:** Teknostallen-demoen (sendt KLP) har 3D-kart i basic — å flytte 3D til høyere nivå ville nedgradert et board som allerede er hos en prospekt.
- **Supabase-dekning fra start (avklart 2026-06-10):** Det er kunde-boardene (Teknostallen, StasjonsKvartalet i Supabase) som trenger vakthunden mest — kun lokal-JSON-dekning ville gjort valideringen blind for nettopp dem.
- **«Alle kategorier»-kvantor (avklart 2026-06-10):** Deklarert nivå er et løfte om full dekning; «minst én» ville gjenåpnet halvferdig-problemet på editorial-aksen.
- **Ingen waiver — interaktiv deklarasjon + re-deklarering (avklart 2026-06-10):** Pipelinen spør om nivå ved oppsett; ved avvik er utveiene «fullfør» eller «re-deklarer ned». Enklere enn waiver-liste, og «feiler høylytt» består uten demo-dag-blokkering.
- **Grilstad løftes nå, ikke senere:** Validering som feiler fra dag én på vårt nyeste board er feil signal; løftet gjør Grilstad til andre referansepunkt og beviser at nivå 3 er reproduserbart utenfor StasjonsKvartalet.

## Dependencies / Assumptions

- Reels-VO-generering gjenbruker eksisterende lokal TTS-pipeline (`scripts/audio-tour-build-local.ts`-mønsteret) med Erik-stemmen; reels-manusene ligger ferdigskrevet i `data/projects/grilstad-marina/byggetrinn-4.json`.
- Camera-tours-poser for Grilstad må autoreres mot 3D-tiles i browser (`?author=1`-flyten brukt for StasjonsKvartalet).
- Grilstad-arbeidet skjer på `feat/grilstad-marina-board` (worktree `placy-ralph-grilstad`). NB: Grilstad-dataene (`data/projects/grilstad-marina/byggetrinn-4.json`) og `scripts/audio-tour-build-local.ts` finnes KUN på denne branchen — nivå-felt/validering må enten utvikles der, eller branchen merges først. Merge-rekkefølgen avgjøres i plan; R4s «fanger dagens Grilstad-tilstand» kan ikke demonstreres fra main som den står.

## Outstanding Questions

### Deferred to Planning
- [Affects R3][Technical] Hvor valideringen kjører: test (Vitest), pre-commit, build-steg eller dev-konsoll — og om den skal dekke både lokal JSON og Supabase-prosjekter fra start.
- [Affects R1][Technical] Feltplassering: `reportConfig.tier` vs. prosjektnivå — og forholdet til legacy `Project` vs. `ProjectContainer`-typene.
- [Affects R6][Technical] Hvilke kategorier i Grilstad som får A→B-kino vs. orbit-fallback (StasjonsKvartalet har kun `transport` som A→B i dag — full kino på alle 7 kan være over-regi).

## Next Steps
-> `/ce-plan` for structured implementation planning
