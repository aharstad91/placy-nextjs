---
title: Nyhavna desktop – felles POI-panel - Plan
type: feat
date: 2026-09-14
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-plan-bootstrap
execution: code
---

# Nyhavna desktop – felles POI-panel - Plan

## Goal Capsule

Besøkende skal forstå hvilket sted de har valgt, lese om det med plass til bilder og tekst, og enkelt fortsette utforskingen i kartet. Leveransen er et reversibelt desktop-forsøk til Nyhavna-demoen 16. september.

Arbeidet utføres i egen worktree fra en sikret kopi av dagens demo. Fable implementerer og verifiserer; Andreas velger hvilken versjon som brukes i demoen. Ingen push eller utrulling inngår. Brukerens produktvalg nedenfor og `CLAUDE.md` er førende. Ved konflikt med annet pågående arbeid skal forsøket isoleres, ikke overskrive arbeidet.

---

## Product Contract

### Summary

Alle POI-er åpnes i samme vertikale detaljflate over sidebaren. Kartet står tilgjengelig ved siden av. På desktop fjernes Steder-fanen og kartpopupen; kategorienes oversikt og «Verdt å merke seg» beholdes. Aktiv markør viser utvalget visuelt.

### Problem Frame

I dag fordeles stedets innhold mellom kartpopup, automatisk fanebytte, accordion og et separat panel for ankersteder som kjøpesentre. Det gir ulik oppførsel for ulike steder og for lite plass til bilder og beskrivelser. Flere samtidige reaksjoner på ett klikk gjør flyten vanskelig å lese.

### Requirements

#### Åpning og navigasjon

- R1. Alle gyldige POI-er i Nyhavnas desktop-visning åpner samme detaljpanel, uavhengig av innholdsmengde og om stedet er et anker.
- R2. Kartklikk, «Verdt å merke seg», eksisterende POI-lenker og stemmens eksplisitte `show_place` skal velge samme sted i panel og kart. Fremheving av flere steder fra stemmen skal fortsatt være en gruppefremheving, uten å åpne et tilfeldig detaljpanel.
- R3. Panelet dekker sidebaren, ikke kartet eller hele nettleseren. Kartet kan fortsatt panoreres, zoomes og brukes til å velge neste sted.
- R4. Steder-fanen, desktopens automatiske fanebytte og desktopens accordion for POI-detaljer fjernes. Den gjenværende Om området-fanen fjernes også som unødvendig enkeltfane; innholdet vises direkte.
- R5. «Verdt å merke seg» beholder det kuraterte utvalget som klikkbare innganger. «Steder i nærheten / N i alt» skal ikke lede til den fjernede listen.
- R6. Tilbake/lukk og Escape lukker panelet, fjerner enkeltvalgets aktive markør og gjenoppretter oversiktens kategori og scrollposisjon. Kameraet hopper ikke tilbake.
- R7. Klikk på et annet sted erstatter innholdet i samme panel og starter detaljscroll øverst. Nytt klikk på allerede valgt sted er en stabil no-op. Vanlig panorering og klikk på tomt kart lukker ikke panelet.

#### Presentasjon

- R8. Et rikt sted kan vise bilde, navn, kategori, kort introduksjon, lengre tekst og tilgjengelige fakta. Bruk eksisterende verifisert innhold og kildevisning.
- R9. Et sted uten bilde eller beskrivelse får en kompakt, bevisst utformet side med navn og tilgjengelige fakta. Ingen tom hero, falsk tekst eller store «innhold mangler»-felt. Bildefeil faller tilbake til samme bildefrie layout.
- R10. Valgt kartpunkt får tydelig vedvarende form-/størrelsesendring, kontrasterende ring og lesbart navn. Ingen informasjons-popup; markørnavnet kan være en enkel etikett. Hover, stemmens gruppefremheving og enkeltvalg skal kunne skilles.
- R11. Anja er tilgjengelig også mens detaljpanelet er åpent, med én samtalekontroll og uten at åpning/lukking restarter samtalen. Kontrollen tar plass i layouten og dekker ikke tekst.
- R12. Tastaturbrukere kan åpne steder, nå panelinnholdet, lukke det og fortsette i kartet eller på utløsende knapp. Skjult sidebarinnhold må ikke være tabb-bart. Redusert bevegelse respekteres.

#### Avgrensning og reversibilitet

- R13. Endringen aktiveres bare for Nyhavnas desktop-flyt ved eksisterende desktopgrense på 1024 px. Mobil beholder dagens oppførsel; andre boards beholder sin nåværende flyt.
- R14. Dagens demoversjon sikres før implementering og kan åpnes separat fra forsøket uten reset, stash-pop eller sletting av lokalt arbeid.

### Key Decisions

Kart og stemme blir hovedinngangene til alle steder; kuraterte knagger består. En full stedsliste erstattes ikke med en ny liste et annet sted. Dette er et bevisst produktvalg fra Andreas (Governs R1–R5).

### Assumptions

R6–R7 konkretiserer retur- og klikkoppførsel som ikke var ferdig spesifisert i samtalen. Disse er standarden for første forsøk. Eksisterende separat tilbakeknapp/kategorirad og kompakt Anja-kontroll skal tas med fra dagens arbeid, ikke bygges på nytt ut fra eldre skjermbilder.

### Scope Boundaries

Ingen innholdsproduksjon, nye datakilder, databaseskjema eller endring i stemmemodell/protokoll. Ankersteders eksisterende underinnhold og kilder bevares.

### Deferred to Separate Tasks

Mobilens nye POI-flyt, generell utrulling til andre boards, mer-menyen og nye agent-spørsmål basert på «Verdt å merke seg» behandles etter Nyhavna-demoen som egne oppgaver.

---

## Planning Contract

### Repository evidence

- `components/variants/report/board/story/StoryPoiPanel.tsx` har allerede lag over hele sidebaren, scroll, Escape, detaljinnhold og måling av åpning. Gjenbruk og tilpass denne.
- `components/variants/report/reels/DesktopStorySidebar.tsx` monterer panelet utenfor oversiktens scrollboks. Sidebarbredden er 438 px. Ny lokal kode plasserer Anja nederst.
- `components/variants/report/board/story/story-tour.tsx` har forsinket `revealFromMap`, bytte til `places` og åpne accordion-ID-er. Disse må ikke få endre oversikten bak nytt panel på desktop.
- `components/variants/report/board/board-state.tsx` skiller `activePOIId`, `exploreOpen`, `exploreSuppressed` og `highlightedPoiIds`. `OPEN_POI` åpner ikke detaljlaget i dag; en ren gjenbruk av actionen uten gjennomgang er utilstrekkelig.
- `components/variants/report/board/use-popup-mode.ts`, `BoardMap.tsx` og `BoardMap3D.tsx` styrer desktop-popupene i begge kartmotorer. 3D undertrykker i dag aktiv navneetikett ved mini-popup.
- `components/variants/report/board/story/StoryCard.tsx` eier faner, utvalg og inngangen til hele stedslistevisningen.
- `docs/solutions/ui-bugs/google-maps-3d-marker-template-swap-spokelser-20260823.md` dokumenterer spøkelsesmarkører ved bytte av komponenttype. Aktiv-state må beholde samme markørinstans og anker.

### Key Technical Decisions

- KTD1. Innfør én eksplisitt presentasjonspolicy for Nyhavna desktop, sendt fra demo-/layoutgrensen til berørte komponenter. Unngå spredte slug-sjekker og globale endringer i `OPEN_POI`. (Governs R13.)
- KTD2. Bruk boardets aktive POI som eneste sannhet for enkeltvalg. La samme desktop-handling åpne detaljlaget og velge markøren; lukk må rydde begge. Hold `highlightedPoiIds` separat. (Governs R1–R2, R6–R7.)
- KTD3. Utvid `StoryPoiPanel` og gjenbruk `PoiDetailBody`, med valgfri innholdspresentasjon ved behov. Behold ankerregistre, transportdetaljer og kildeattribusjon. Ingen parallelle paneler per POI-type. (Governs R8–R9.)
- KTD4. Panelet er en ikke-modal region med navn, ikke en skjermmodal med fokusfelle. Gjør kun den tildekkede oversikten inert, ikke kartet eller Anja. Ved kartbytte under lesing må fokus ikke hoppe vilkårlig. (Governs R3, R11–R12.)
- KTD5. Markørens aktive uttrykk rendres i begge motorer uten ny komponenttype/key. Bruk en kort overgang, omtrent 150–220 ms, og ingen kontinuerlig puls. For 3D prioriteres korrekt sluttilstand dersom motoren ikke tegner mellomframes. (Governs R10, R12.)

### High-Level Technical Design

Retningsgivende komponentflyt:

```text
Kart / kuratert knagg / POI-lenke / stemmens show_place
                     ↓
         Felles desktop-valghandling
                     ↓
       Board state: aktiv POI + åpent panel
               ↙                  ↘
       Aktiv markør          StoryPoiPanel
                              PoiDetailBody

Stemmens highlight_places → gruppefremheving (egen state)
```

Tilstandsflyt:

```text
Oversikt → velg A → Detalj A → velg B → Detalj B
                      ↓                  ↓
                    lukk               lukk
                      └──── Oversikt ────┘
```

Oversiktens kontekst bevares ved åpning. Avbryt eldre timere ved nytt valg/lukk. Et sent bilde-/detaljsvar for A må ikke erstatte B. Panelet skal ikke eie kameraflytting: synlig kartpunkt står stille ved klikk; knagg/stemme som velger et punkt utenfor synlig kart kan bruke eksisterende `holdFrame`-oppførsel med riktig sidebar-padding.

### Worktree og baseline

Ved planlegging var hovedrepoet på `fix/nyhavna-uninterrupted-greeting`, HEAD `f6bb88f`, med ucommittede endringer i blant annet kart, sidebar, StoryCard/StoryRail, Anja og Live-hooken. Dette er en observasjon, ikke en garantert startversjon.

Før implementering må fersk git-status og worktree-liste leses. Sikre dagens komplette relevante demoendringer i en lokal baseline-commit i samråd med eierskapet til pågående sesjoner; ikke bruk blind `git add .`. Hvis annet arbeid fortsatt pågår, lag en isolert snapshot-branch med kopierte relevante tracked-differ og nye filer, og commit der uten å endre hovedrepoets index eller arbeidsfiler. Dokumenter faktisk baseline-SHA.

Opprett forsøket fra denne baseline, på en egen branch og worktree, og bruk prosjektets `scripts/setup-worktree.sh`. Velg en ledig port; ikke stopp eksisterende demoserver. Baseline og forsøk skal ha hver sin fungerende URL. Hemmeligheter følger eksisterende env-oppsett og skal ikke commits. Worktree gir kodeisolasjon, ikke separat database; planen trenger ingen databaseskriving.

---

## Implementation Units

### U1. Sikre sammenlignbar demo

- Goal: Dagens løsning kan åpnes uavhengig av forsøket (R14).
- Files: Git/worktree-oppsett, `scripts/setup-worktree.sh`, senere `PROJECT-LOG.md`.
- Approach: Følg baseline-regelen over. Ta førbilder av kategorioversikt, vanlig POI og kjøpesenter.
- Verification: Dokumentert baseline-SHA og to adresser; dagens lokale endringer er bevart. Ingen funksjonstest kreves for selve git-oppsettet.

### U2. Samle desktopens stedshandlinger

- Goal: Alle innganger velger samme sted uten fanebytte (R1–R2, R6–R7, R13; KTD1–KTD2).
- Files: `board-state.tsx`, `story/story-tour.tsx`, `reels/ReportReelsPage.tsx`, Nyhavna demo-entry og relevante stemmehandlingskallere under `board/voice/`.
- Approach: Spor samtlige kallere av åpne/lukke-handlinger og modalhost før endring. Koble om presentasjonen, behold mobilstien. Kanseller gammel desktop-reveal og kameraarbeid som ikke lenger gjelder.
- Tests: Kart/knagg/stemme → A; raskt A→B→lukk; samme A to ganger; ukjent ID; gruppefremheving; mobil uten ny policy. Ingen forsinket gjenåpning eller kategorihopp.

### U3. Lag en detaljflate som tåler ulikt innhold

- Goal: Alle steder får en lesbar side mens kart og Anja er tilgjengelige (R3, R8–R9, R11–R12; KTD3–KTD4).
- Files: `story/StoryPoiPanel.tsx`, `PoiDetail.tsx`, `reels/DesktopStorySidebar.tsx`, eksisterende detaljtester.
- Approach: Tydelig fast tilbakeknapp, uavhengig innholdsscroll, valgfritt bilde og modulære fakta. Vis navn/kategori tidlig; ikke bruk et stort bildefelt når bilde mangler. Behold samme Anja-instans ved panelbytte.
- Tests: Bunkerkvartalet med faktisk tilgjengelig innhold, rikt ankersted, kun navn/kategori, bildefeil, lang tekst, lang tittel, nytt sted mens scrollet. Escape/fokusretur og ingen skjulte tabb-stopp.

### U4. Erstatt kartpopup med aktiv markør

- Goal: Utvalget er entydig og kartet forblir rolig (R10, R12–R13; KTD5).
- Files: `BoardMap.tsx`, `BoardMap3D.tsx`, `use-popup-mode.ts`, `BoardMarker.tsx` og relevante markørkomponenter under `components/map/`.
- Approach: Fjern popup-rendering under ny policy i begge motorer og gjeninnfør enkel aktiv navneetikett. Aktiv markør skal prioriteres av declutter også når den startet som prikk. Bevar posisjon og eksisterende klikkflate.
- Tests: Velg to nærliggende POI-er; gjenta A/B ti ganger; zoom/pan og bytt kartmotor med åpent panel. Ett aktivt enkeltvalg, ingen spøkelsesmarkører, ingen popup og ingen unødvendig kamerabevegelse. Test også bilde-/anker-markør og redusert bevegelse.

### U5. Forenkle oversikten og verifiser hele demoen

- Goal: Oversikten gir gode innganger uten gammel stedsliste (R4–R5, R13).
- Files: `story/StoryCard.tsx`, `story/StoryRail.tsx`, tilhørende tester og `reels/DesktopStorySidebar.test.tsx`.
- Approach: Fjern desktopens faner og listeinngang under policyen. Behold utvalg, spørsmål/svar, kontaktinnhold og fersk kategorinavigasjon. Fjern foreldet kode/kommentarer som ingen gjenværende variant bruker.
- Tests: Hver Nyhavna-kategori åpnes; hver kuratert knagg åpner riktig POI; retur beholder scroll og kategori. Kjør samlet verifikasjon nedenfor og ta etterbilder ved samme utsnitt som U1.

U1 kommer først, U2 før integrasjonen i U3–U5. U3–U4 vurderes sammen visuelt før sluttkontrollen; korrekt tilstand er viktigere enn detaljpolering av overgangene.

---

## Verification Contract

Test desktop på 1440×900 og 1280×720, samt terskelen 1024 px. Verifiser Nyhavnas faktiske demokart og begge kartmotorer dersom byttet er tilgjengelig. Ta en mobil-regresjonssjekk ved 390 px og én annen board-visning for R13; dette er ikke mobilredesign.

Kjør `npm run lint`, `npm test`, `npx tsc --noEmit` og `npm run build`. Nye meningsfulle tester skal dekke state-/timerregresjoner og inngangenes samspill; screenshots og faktisk browserbruk må bevise markørrendering og layout. Registrer eksisterende feil separat før de tilskrives revampen.

Gjennomfør én sammenhengende demotur: kategori → kuratert sted → annet kartpunkt → anker → tilbake → stemmens enkeltvalg → gruppefremheving → avslutt samtale. Ingen dobbeltpaneler, skjulte kontroller, stale steder, uønsket fanebytte eller restart av samtalen. Stemmens faktiske ende-til-ende-flyt må kontrolleres; ren mock er ikke bevis på integrasjonen.

---

## Definition of Done

Alle R1–R14 er verifisert med resultater og før/etterbilder. Dagens demo og forsøket kan sammenlignes på separate adresser. Ingen foreldet desktopkode er beholdt uten en faktisk gjenværende mobil-/boardkonsument. Endringen er lokalt committet på forsøksbranchen og ikke pushet.

Fable leverer kort oversikt over endringer, kontroller, eventuelle begrensninger, baseline-SHA, forsøks-SHA og begge adresser. Loggfør implementasjonen i `PROJECT-LOG.md`. Andreas kan velge baseline til demoen uten å rulle tilbake filer eller slette forsøket.
