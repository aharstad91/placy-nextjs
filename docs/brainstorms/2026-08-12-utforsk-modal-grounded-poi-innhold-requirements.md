---
date: 2026-08-12
topic: utforsk-modal-grounded-poi-innhold
---

# Utforsk-modal med Google-grounded POI-innhold

## Problem Frame

«Utforsk»-knappen i board-POI-popupene (2D og 3D) sender i dag brukeren til Google AI Mode i ny fane (`?udm=50`). Det har to kostnader: brukeren forlater Placy midt i opplevelsen, og klikket — det sterkeste interessesignalet vi har per POI — er i dag uinstrumentert, så signalet går tapt for Moat 2. (Presisering fra review: klikket «måles» ikke av Google i noen form vi mister — det logges ikke av noen; utgående klikk kan instrumenteres i dag via eksisterende event-pipeline, uavhengig av modalen.) Samtidig er innholdet Google serverer der («gull lokalkunnskap», jf. AI Mode-oppslaget for Muustrøparken) nettopp det innholdet Placy-brukeren vil ha.

Verifisert 2026-08-12: Googles egne AI-sammendrag i Places API (`generativeSummary`/`reviewSummary`/`neighborhoodSummary`) er **ikke tilgjengelige i Norge** (0 av 12 norske probe-POI-er, US-kontroll returnerte full pakke). Men build-time Gemini + Google Search-grounding (eksisterende validert mønster) reproduserer AI Mode-innholdet på norsk med kildeliste.

Vi bygger altså i praksis samme funksjon som Google selv ruller ut regionvis — bare at vi dekker vårt marked før dem. Presisering av moat-logikken: den rå grounded teksten er et **bootstrap-/commodity-lag** (designet for å kunne byttes ut med Googles egne sammendrag, jf. R4) — Moat 1-substansen (Lokalkunnskap) er det **kuraterte laget** som bygges oppå (megler-utvalg og redaksjonell delta, deferred til eget spor). Genereringen for alle POI-er er fundamentet kurateringen trenger for å finnes overalt, ikke moaten i seg selv.

## Requirements

**Innholdsgenerering (build-time)**

- R1. Grounded «Utforsk»-innhold genereres build-time per POI via Gemini + Google Search-grounding (gjenbruk av mønsteret i `lib/gemini/`), på norsk, og lagres på POI-et. Ingen runtime-LLM-kall.
- R2. Genereringen kjøres for **alle** POI-er på boardet (ikke bare highlights) — dette er Moat 1-akkumulering, og «Verdt å merke seg» er meglerens topp-liste over et fundament som skal finnes overalt.
- R3. En kvalitetsport avgjør publisering: kun POI-er der grounding gir substans (kilder + tilstrekkelig innhold) får modal-innhold. Tynne resultater publiseres ikke — ingen tomme/svada-modaler. Porten kalibreres på hele Sundsøya-settet, og generering + kalibrering kjøres **før** modal-UI bygges — lav dekning er et pilot-funn som skal omdirigere innsatsen, ikke oppdages etter shipping.
- R4. Lagringsformatet er provider-agnostisk på innholdsstruktur: innholdet merkes med kilde/leverandør slik at vår Gemini-generering kan erstattes eller suppleres med Googles `generativeSummary`/`reviewSummary` per POI når Places API dekker Norge — uten endring i modalens innholdsstruktur. To presiseringer: (a) attribusjonsblokken er **provider-spesifikk** (grounding: kildelenker + searchEntryPoint; Places-summaries: disclosure-tekst + flag-content-lenke) og modelleres som del av lagringsformatet, ikke som ett felles felt; (b) formatet skiller **generert innhold** (provider-swappbart) fra **kuratert/redigert innhold** (Placy-eid) — det kuraterte laget skal overleve en provider-swap uendret.
- R5. Innholdet stemples med genereringstidspunkt og kan re-genereres kontrollert (versjonert, jf. `groundingVersion`-mønsteret) — datahygiene er synlig og styrbar. Re-generering er også en **compliance-mekanisme**: lagret grounded tekst har maks-alder godt innenfor ToS-vinduet (se Dependencies), ikke bare redaksjonell hygiene.

**Utforsk-modalen (render)**

- R6. «Utforsk»-knappen i POI-popupene åpner en modal i Placy (i stedet for ny fane) for POI-er med publisert innhold. Modalen viser: grounded tekst (intro + punkter), kildelenker, og Google-fakta (bilder, åpningstider, rating) der de finnes. Modalen degraderer pent: grounded tekst og kildelenker vises alltid; Places-fakta-seksjonen utelates stille ved manglende data **eller** feilet/treg henting — et Google-avvik skal aldri blokkere Utforsk-opplevelsen.
- R7. All Google-attribusjon følger ToS: kildelenker vises, «hentet via Google Søk»-merking inngår, og eksisterende sanering (DOMPurify/`searchEntryPointHtml`-mønsteret) gjenbrukes. Rammen er eksplisitt «informasjonen kommer fra Google» — Placy er flaten, Google er kilden.
- R8. Places-fakta i modalen hentes via eksisterende cachet proxy (`/api/places/[placeId]`) eller lagres build-time — aldri ukontrollerte per-visning-kall.
- R9. Modalen fungerer på både desktop og mobil i tråd med mobile-native-prinsippet (bottom-sheet-aktig på mobil der det er naturlig). Verifisert faktum: dagens Utforsk-knapp finnes **kun** i desktop-popupene (lg+, `BoardPOIMiniPopup`/`BoardPOI3DMiniPopup`) — mobil-flaten (bottom-sheet) har ingen Utforsk-CTA i dag. R9 innebærer derfor å innføre en **ny** Utforsk-inngang på mobil, ikke å konvertere en eksisterende.
- R10. POI-er uten publisert innhold (kvalitetsport ikke bestått) beholder dagens oppførsel: ekstern lenke til Google AI Mode i ny fane. Ingen POI mister funksjonalitet. På mobil (der ingen Utforsk-CTA finnes i dag, jf. R9) gjelder samme regel for den nye inngangen: ekstern lenke ved ikke-bestått port. De to variantene skiller seg visuelt med et diskret signal: ekstern-varianten viser standard «ekstern lenke»-ikon i stedet for sparkles; modal-varianten beholder dagens utseende. (Beslutning, Andreas 2026-08-12.)

**Måling (Moat 2)**

- R11. Modal-åpning logges som interessesignal per POI (Moat 2-instrumentering), inkludert hvilke POI-er som fortsatt sender brukere eksternt (R10-fallback) — det er målingen av dekningsgapet. Utgående fallback-klikk logges via eksisterende event-pipeline, og bør skipes **før** modalen slik at baseline-interesse per POI finnes å sammenligne modalen mot. ToS-grense: målingen skjer på modal-/knappnivå — vi tracker aldri interaksjoner med spesifikke Grounded Results eller kildelenker (forbudt i Gemini-vilkårene, se Dependencies).

**Kostnadskontroll**

- R12. All Google-innholdshenting skjer build-time (engangs per POI) eller via cachet proxy. Forventet kostnad per board (~150 POI-er): grounding innenfor gratiskvote (1 500/dag) eller ~5 USD, Places-fakta ~3–5 USD engangs. Per bruker-visning: ~0. Avvik fra dette bildet skal flagges før kjøring.

## Success Criteria

- På Sundsøya-boardet åpner «Utforsk» en modal i Placy for POI-er med godkjent innhold, med innhold på nivå med AI Mode-oppslaget for Muustrøparken (skulpturene, amfiet, kvernhuset — med kilder).
- Dekningsgraden er målt og eksplisitt vurdert: andelen POI-er som består kvalitetsporten rapporteres per kategori, og pass-raten er beslutningsgrunnlaget (go/no-go) for den deferrede pipeline-integrasjonen. Konkret terskel settes ved kalibreringen (R3) — men «piloten består» krever at dekningen er vurdert, ikke bare at de godkjente ser bra ut.
- Ingen modal viser tynt/tomt innhold; fallback-POI-er lenker eksternt som før.
- Modal-åpninger per POI er synlige i Moat 2-dataene.
- Total API-kostnad for pilot-kjøringen er kjent og innenfor estimatet i R12.

## Scope Boundaries

- **Kun Sundsøya-boardet** i denne omgangen — frittstående pilot, ikke pipeline-steg.
- Ingen «Ask anything»-oppfølgingsspørsmål i modalen — runtime-LLM er forbudt i arkitekturen, og innholdet er statisk per generering.
- `TransitDashboardCard`-lenken («holdeplass avganger») endres ikke — annet formål (sanntid, ikke stedsinnhold).
- Ingen endring i eksisterende editorial-felter (`editorialHook`/`localInsight`) eller kategori-tekstene — dette er et nytt innholdslag, ikke en erstatning.

### Deferred to Separate Tasks

- Pipeline-integrasjon (generering som steg i `lib/pipeline/`-provisjoneringen slik at alle nye boards får det automatisk) — tas opp igjen etter pilot-evaluering på Sundsøya.
- Backfill av eksisterende boards (Midtbyen, StasjonsKvartalet m.fl.) — etter pipeline-integrasjon.
- Google-swap (bytte inn `generativeSummary` når Norge dekkes) — R4 gjør det mulig; selve byttet er egen oppgave når Google lanserer. Re-probe av Places AI-felt kvartalsvis (probe-script fra 2026-08-12-testen).
- Megler-kuratering/redigering av grounded innhold (kobling mot «Verdt å merke seg»-forfatterskap) — eget spor.

## Key Decisions

- **Alle POI-er med kvalitetsport, ikke kun highlights**: Moat 1-substans skal ligge på alle punkter; porten hindrer tynne modaler. (Andreas, 2026-08-12)
- **Grounded tekst + Google-fakta i modalen**: nærmest AI Mode-opplevelsen; valgt etter at kostnadsbildet ble verifisert som engangs-per-board, ikke per-visning. (Andreas, 2026-08-12)
- **Ekstern lenke som fallback**: ingen POI mister funksjonalitet, og lekkasjen blir målbar. (Andreas, 2026-08-12)
- **Frittstående Sundsøya-pilot før pipeline**: raskest til verifisering; skalering er bevisst utsatt. (Andreas, 2026-08-12)
- **Provider-agnostisk lagring**: vi bygger samme funksjon som Google ruller ut — designet skal la oss deprecate egen generering og plugge inn Googles når dekningen kommer. (Andreas, 2026-08-12)

## Dependencies / Assumptions

- `GEMINI_API_KEY` i `.env.local` er verifisert gyldig (testkjøring 2026-08-12; NB: zsh-`source` mangler verdien — parse .env-filen programmatisk).
- Grounding-kvaliteten verifisert på én POI (Muustrøparken); kvalitetsporten må kalibreres empirisk på hele Sundsøya-settet (~antall POI-er per kategori avklares i planning).
- **Gemini-vilkår for lagring — verifisert 2026-08-12** ([ai.google.dev/gemini-api/terms](https://ai.google.dev/gemini-api/terms)): Hovedregelen forbyr caching/framing/syndikering av Grounded Results, men vilkårene tillater eksplisitt å lagre **teksten** i Grounded Results i inntil **2 år** for bl.a. visnings-/optimaliseringsformål. Konsekvenser bygget inn i kravene: R5-regenerering fungerer som compliance-mekanisme (maks-alder på lagret innhold), og R11 måler aldri interaksjoner med spesifikke Grounded Results/Search Suggestions (eksplisitt forbudt). NB: samme vilkår gjelder dagens tema-grounding (`docs/solutions/api-integration/gemini-grounding-pattern-20260418.md`) — mønsteret er altså innenfor, men 2-års-vinduet og tracking-forbudet bør noteres der også.
- R11 innebærer sannsynligvis ny event-type i v2.events: krever migrasjon som utvider `events_event_type_check` + `EVENT_TYPES`-bump (to-stegs-kontrakten i `lib/instrumentation/event-types.ts`), samt kontekst-konvolutt på hvert event. «Frittstående pilot» bærer altså én produksjons-DB-migrasjon.

## Outstanding Questions

### Deferred to Planning

- [Affects R1][Technical] Hvor lagres per-POI grounded innhold — kolonne på `v2.pois`, eget innholdslag, eller i board-bundelen? (v2.pois.id er TEXT; POI-er deles på tvers av boards — per-POI-lagring gjenbrukes naturlig på tvers.)
- [Affects R3][Technical] Konkrete terskler for kvalitetsporten (min. antall kilder, min. innholdslengde, svada-heuristikk).
- [Affects R6][Technical] Nøyaktig modal-/sheet-komponentvalg og hvordan 2D- og 3D-popup deler åpningslogikk; hvilken flate mobil bruker i dag for POI-aktivering.
- [Affects R6][Technical] Bilder: Places photos-referanser build-time vs. via proxy runtime — velg det som er enklest innenfor R8/R12.
- [Affects R11][Technical] Hvilket eksisterende Moat 2-event-oppsett modal-åpningen logges gjennom.

## Next Steps

-> `/ce-plan` for strukturert implementeringsplan (deretter `/ce-work`).
