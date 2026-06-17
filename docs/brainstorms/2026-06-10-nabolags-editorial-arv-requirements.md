---
date: 2026-06-10
topic: nabolags-editorial-arv
---

# Nabolags-editorial-arv — nivå 2 rapport-board på vilkårlig adresse (PoC)

## Problem Frame

Placy kan i dag levere et **nivå 2** rapport-board (kuratert drill-in: 3–5 setninger
+ highlight-POIer per kategori) kun der noen manuelt har fylt `editorial` per prosjekt.
Det skalerer ikke per adresse. Strategien er kjede-først i Trondheim/Malvik/Stjørdal/Melhus,
der Andreas selv har lokalkunnskap og dermed reell QA-evne. Tesen som må bevises før vi
bygger videre eller pitcher en kjede:

> **Kuratér nivå 2-innhold én gang per nabolag, arv det per adresse — boardet føles fortsatt
> riktig for den konkrete adressen.**

Holder tesen, er veien til «nivå 2 på alle adresser i Trondheim og omegn» et spørsmål om
å kuratere ~30–50 nabolag (bounded arbeid), ikke å skrive innhold per adresse (uendelig
arbeid). Dette er også IP-byggingen: en rights-clean, kuratert kommune-database er et
aktivum i senere verdisetting av Placy.

PoC-ens formål er **internt tese-bevis** — Andreas QA-er selv. Demo-polish, latens og
selvbetjeningsflate er eksplisitt ikke krav i denne runden.

## Requirements

**Nabolags-oppslag**
- R1. Et nabolag defineres som et navngitt geografisk område med en polygon-grense. PoC-en
  trenger kun **ett** polygon (Ranheim), håndtegnet — ikke offisielle kommunegrenser.
- R2. Gitt en adresses koordinater skal systemet kunne avgjøre hvilket nabolag adressen
  ligger i (point-in-polygon). Adresser utenfor definerte nabolag faller tilbake til
  nivå 1-oppførsel (intet arvet editorial).

**Editorial-arv**
- R3. Nivå 2-innhold (`editorial` per kategori: body + highlight-kandidater + valgfritt bilde)
  kurateres og lagres **per nabolag × kategori**, ikke per prosjekt/adresse.
- R4. Ved generering av et board for en adresse skal kategoriene arve nabolagets editorial
  for de kategoriene nabolaget har kuratert. Kategorier uten nabolags-editorial forblir nivå 1.
- R5. Ranheim kurateres for alle kategorier som er relevante for nabolaget (Andreas godkjenner
  hver kategori — LLM-draft som utgangspunkt, menneskelig redigering er kvalitetsgaten).

**Highlight-fallback (kjernen i ny logikk)**
- R6. Et nabolags highlight-POIer er valgt på nabolags-nivå, men det konkrete boardet for én
  adresse inneholder bare POIene som faktisk lander innenfor adressens radius + trust-filter.
  Highlights som ikke finnes på boardet skal **ikke** gi tomme/døde chips.
- R7. Når en arvet highlight-POI mangler på adressens board, skal systemet erstatte den med
  neste POI fra nabolagets kuraterte kandidatliste (R3, kurator-prioritert rekkefølge) som
  finnes på boardet — og droppe chipen hvis ingen kandidat finnes. En ukuratert «nærmeste
  trusted POI» skal **aldri** promoteres til highlight: hver synlig chip peker alltid til en
  POI som både er kuratert og faktisk er på kartet.
- R9. Hver droppet/erstattet highlight logges med årsak (utenfor radius / ikke importert /
  under trust-terskel) per adresse. Uten årsaksspor kan ikke evalueringen skille «tesen
  knakk» fra «importen knakk» — og suksesskriteriet om å dokumentere hva som knakk blir
  uoppfyllbart for denne feilklassen.

**Kvalitetsgate (trust inline)**
- R8. Trust-validering kjøres som automatisk steg i genereringen, slik at POIer under
  trust-terskel ikke vises på boardet. Gaten garanterer «ingen synlig død/illegitim POI» —
  dagens trust-scoring måler liv/legitimitet (business_status, website, reviews), ikke
  klassifisering. «Ingen feilklassifisert POI» dekkes derfor av manuell QA i PoC-en, og
  feilklassifiserings-funn logges som slice 2-input (kandidat: klassifiseringssjekk i
  trust-pipelinen).

## Success Criteria

- **Tesen bevist:** 3 adresser innenfor Ranheim genereres, valgt for å maksimere intern
  varians — én i gammel kjerne, én i ny bydel, én nær polygon-kanten (worst case for arvet
  narrativ). Alle tre arver samme nabolags-editorial, men hvert board føles riktig for *sin*
  adresse — korrekte highlights (ingen døde chips), korrekte reisetider/avstander fra den
  adressen. Adressene velges for å maksimere sjansen for at arven knekker, ikke for at den
  holder.
- **Falsifiseringsrubrikk pre-registreres** før boardene genereres («slik ser FEIL ut»).
  Tesen er svekket hvis f.eks.: editorial-body nevner steder/kvaliteter som er irrelevante
  eller misvisende for minst én adresse; ≥1 kategori per board krever per-adresse-omskriving
  for å føles riktig; eller highlight-fallback (R7) fyrer på en stor andel av chipsene.
  Vurderingen gjøres av Andreas, men mot rubrikken — ikke etterrasjonalisert.
- Andreas vurderer hvert av de tre boardene som «dette kunne jeg vist en megler» på
  innholdskvalitet (ikke polish).
- Ingen synlig POI på noen av de tre boardene er død (R8-gaten holder) eller åpenbart
  feilklassifisert (manuell QA — funn logges som slice 2-input, ikke kreditert gaten).
- **Kurateringskostnaden måles:** faktisk tidsbruk for Ranheim-kurateringen logges per
  kategori (LLM-draft, redigering, highlight-valg, polygon-tegning) slik at slice 2 kan
  ekstrapolere 30–50-nabolag-økonomien med data i stedet for antakelse.
- Det er dokumentert hva som knakk / krevde manuelt inngrep, slik at slice 2 (typologi-test
  på tvers av de fire kommunene) kan adressere det.

## Scope Boundaries

- **Kun Ranheim, kun ett polygon.** Resten av nabolagene, polygon-biblioteket og full
  kommunedekning er slice 2/3.
- **Ingen regional POI-base / spatial-oppslag.** Genereringen bruker dagens per-adresse
  POI-import (POIer deles allerede i DB, så nærliggende adresser bygger basen inkrementelt).
  Regional base + spatial-oppslag er mål-arkitekturen, men hører til slice 2 — den endrer
  *hvor* POIene kommer fra, ikke om tesen holder.
- **Ingen demo-flate / selvbetjening / latens-optimalisering.** Genereringen kan ta minutter
  og kjøres av Andreas. Kjede-demo-klar flyt er et senere mål.
- **Ingen crawl/innsiktskart i denne runden.** Ranheim kurateres fra Andreas' egen kunnskap
  (med LLM-draft). Crawl-som-innsikt-sveipet er et separat arbeidsløp.
- **Propr-sporet er satt på vent** (egen business-logg-føring).

### Deferred to Separate Tasks
- Regional trust-validert POI-base + spatial-oppslag → slice 2.
- Crawl av megler-annonser → bydels-innsiktskart (rights-clean, kun strukturert innsikt,
  råtekst slettes etter ekstraksjon) → eget arbeidsløp, valideres mot manuell Ranheim-kuratering.
- `/generer`-flate som peker på rapport-board i stedet for Explorer → slice 3.
- Nabolags-editorial som trainee-/megler-vedlikeholdt innholdslag → produkt-/avtale-spor.

## Key Decisions

- **Arkitektur C (arv + trust-gate inline), ikke regional base først:** Tesen handler om
  editorial-arv, ikke om POI-kilden. Regional base er riktig endepunkt, men er en
  optimalisering som ikke påvirker om tesen holder — bygges i slice 2. Trust-gaten tas med
  allerede nå fordi én synlig død POI undergraver hele nivå 2-kvalitetsfortellingen mot kjeden.
- **Kuratér per nabolag, ikke per adresse:** Dette er hele skalerings-tesen og IP-vinkelen.
- **Egen kunnskap før crawl:** Tesen avhenger ikke av innsiktskartet; crawl gjør kurateringen
  raskere senere, men ville gjort PoC-en større og tregere uten å endre hva som bevises.
- **Håndtegnet Ranheim-polygon:** Det viktige er at grensen matcher hvordan markedet/meglere
  deler inn området, ikke offisielle grenser.
- **Ranheim som pilot:** Tydelig identitet (fjæra, idrett, ny bydel + gammel kjerne), god
  POI-tetthet, representativt familie-flytter-hit-område.

## Dependencies / Assumptions

- **Verifisert:** `editorial` lagres i dag per tema i `products.config.reportConfig.themes[].editorial`
  (`body`, `highlightPoiIds`, `image`) — se `lib/types.ts` (`ReportThemeEditorial`).
- **Verifisert:** `highlightPoiIds` resolves mot kategoriens POIer og ukjente IDer ignoreres
  stille (`components/variants/report/board/board-data.ts`, `adaptCategory`) — dette er nøyaktig
  fallback-gapet i R6/R7. (`report-data.ts` videresender bare `editorial` urørt.)
- **Verifisert:** Det finnes ingen nabolags-tabell/polygon-konsept i dagens schema
  (`supabase/migrations/`) — R1 er net new infrastruktur.
- **Verifisert:** Per-adresse-provisjonering finnes (`npm run create-report`, `/provision-rapport`)
  og trust-validering finnes som admin-endepunkt (`/api/admin/trust-validate`) med tilhørende
  slash-kommando (`/validate-poi-trust` — kommando, ikke endepunkt).
- **Korrigert under planlegging:** Rapport-stien HAR read-time trust-filtrering
  (`filterTrustedPOIs()` i `lib/supabase/queries.ts`, «null score = vis»-semantikk — se
  `docs/solutions/logic-errors/trust-filter-missing-report-data-layer-20260208.md`). Det
  reelle R8-gapet er at provisjonering aldri *scorer* POI-ene (alle får `trust_score = null`
  og passerer). R8 = scoring som pipeline-steg, ikke nytt filter.
- **Rekkefølge-avhengighet (bootstrap):** Kuratering av highlight-POIer forutsetter at POIene
  finnes i DB — minst én Ranheim-adresse provisjoneres **før** kurateringen, og highlight-utvalget
  er begrenset til POIer per-adresse-importen faktisk fanger (radius + kategori-miks).
  Alternativ (late-binding via `google_place_id`) er et plan-spørsmål.
- **Antakelse:** Ranheim har nok POI-tetthet til at de fleste kuraterte kategorier får ≥3
  trusted POIer på en typisk adresse. Valideres i PoC-en (kandidat for R8-læring).

## Outstanding Questions

### Deferred to Planning
- [Affects R1][Technical] Hvor lagres nabolaget? Egen tabell vs. JSONB-felt, og hvordan
  knyttes editorial til nabolag vs. dagens per-prosjekt-lagring (kreves migrasjon?).
- [Affects R3/R4][Technical] Mekanisme for arv: kopieres nabolagets editorial inn i prosjektets
  `reportConfig.themes[].editorial` ved generering, eller resolves det dynamisk ved render?
  (Kopier-ved-generering er trolig enklest og holder dagens render-vei urørt — avgjøres i plan.)
- [Affects R7][Technical] «Nærmeste trusted POI i samme kategori» — eksakt fallback-regel og
  hvor i pipelinen den kjøres (genererings-steg vs. `adaptCategory`).
- [Affects R8][Technical] Hvordan kobles `trust-validate` inn som automatisk genererings-steg,
  og hvilken terskel brukes (Explorer bruker 0.5 i dag). I tillegg: (a) hvor skjer
  ekskluderingen — genererings-unlink vs. render-filter, og (b) semantikk for POIer uten
  score ved delvis validerings-feil (dagens «null = vis»-default bryter R8-garantien).
- [Affects R5][Needs research] Hvilke kategorier er faktisk relevante å kuratere for Ranheim,
  og hvilken kilde-miks (egen kunnskap + Gemini-grounding + Wikipedia) gir best fakta-feed.

## Next Steps
-> /ce-plan for structured implementation planning
