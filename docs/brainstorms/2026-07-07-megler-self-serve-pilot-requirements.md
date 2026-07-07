---
date: 2026-07-07
topic: megler-self-serve-pilot
---

# Megler self-serve — kjede-pilot-verktøy (adresse → nivå-1-board → embed)

## Problem Frame

Eiendomsmeglere i en kjede-pilot skal selv kunne generere et Placy nivå-1-board for et objekt på vei ut i markedet, og få boardet ut i to kanaler: embeddet på kontorets objektside (iframe) og lenket fra FINN-annonsen. Dette er verktøyet som gjør grunnpakke/kjede-sporet demonstrerbart i praksis («de 10–30M krever kjede / partner / self-serve», jf. `docs/strategy/2026-06-25-markus-bruktmegler-vs-utbygger.md`).

Mye av kjernen eksisterer allerede (PRD 3 Unit 8): `/eiendom/generer` med adresse-autocomplete, `POST /api/generation-requests` med fire-and-poll, nivå-1-provisjonering, live status-polling og «klart»-e-post fra hei@placy.no. Gapet er journeyen rundt: kontor-scopet inngang, leveranse-pakking (embed-snippet, FINN-instruks), embed-modus på boardet, og dekningsstyring.

## User Journey (mål-tilstand)

```
Kjeden deler pilot-lenke internt
        │
        ▼
placy.no/megler/<kontor-slug>        ← rent verktøy: adressefelt, kontornavn som avsender
        │  megler taster adresse (autocomplete)
        ▼
   Geofence-sjekk ──── utenfor kuratert strøk ──→ høflig stopp + adressen logges som etterspørsel
        │ innenfor
        ▼
   Generering (~minutter) — vente på siden ELLER lukke og få e-post
        │
        ▼
   Delings-side per board            ← e-posten peker hit
   ├─ forhåndsvisning av boardet
   ├─ kopier lenke        → FINN-annonse / SMS / e-post
   ├─ kopier iframe-kode  → kontorets objektside
   └─ QR-kode             → prospekt / visning
```

## Requirements

**Inngang og scoping**

- R1. Hvert pilotkontor får en egen kontor-scopet side på `placy.no/megler/<kontor-slug>` — ingen innlogging; lenka deles internt i piloten. Slugen er ikke-gjettbar (kontornavn + tilfeldig suffiks, f.eks. `dnb-midtbyen-x7k2f9`) siden lenken ER tilgangsmodellen, og en lekket lenke må kunne roteres uten å miste kontor-tilknytningen.
- R2. Siden er et rent verktøy: adressefelt med autocomplete øverst, kontorets navn synlig som avsender. Ingen salgs-hero, ingen eksempel-galleri — brukerne vet hva verktøyet er.
- R3. Boards generert fra en kontor-side knyttes automatisk til riktig kontor/kunde — megleren skal aldri måtte skrive meglerkontor manuelt (dagens valgfrie fritekstfelt erstattes av scopingen).
- R4. Megleren oppgir e-post + samtykke som i dag; e-posten brukes til «klart»-varsling.
- R15. En ukjent kontor-slug hard-feiler (vennlig «kontor ikke funnet»-side) — den provisjonerer aldri et board og oppretter aldri en kunde-rad. Generering skjer kun for slugs i det manuelt vedlikeholdte kontor-registeret (dagens `getOrCreateCustomer`-upsert-mønster gjelder ikke denne inngangen).
- R16. Duplikat-deteksjon scopes per kontor: samme adresse fra et annet kontor gir egen request (ikke gjenbruk av et annet kontors board), og et duplikat-treff svarer med delings-siden — ikke rå board-URL — slik at megleren alltid får leveranse-flaten sin.

**Dekning (geofence)**

- R5. Adresser utenfor kuraterte strøk (Moat 1-dekning) stoppes høflig før generering, med melding om hvilke områder som dekkes og at støtte for stedet er på vei. Ingen megler får et board uten redaksjonelt lag. Geofencen håndheves i `POST /api/generation-requests` (server-side), ikke bare i kontor-sidens UI — ellers omgår dagens åpne `/eiendom/generer`-side hele garantien, og avvisninger utenom kontor-siden ville heller ikke bli logget (R6).
- R6. Hver avvist adresse logges som etterspørselssignal (adresse, kontor, tidspunkt) slik at etterspørselen styrer hvilke strøk som kurateres neste (via `/curate-area`).
- R17. Avvisningen er ikke en blindvei: megleren kan legge igjen e-post ved avvisning, og varsles når strøket blir dekket (manuell utsending fra Andreas er OK i piloten — kravet er at loopen finnes, ikke at den er automatisert).

**Generering og varsling**

- R7. Generering gjenbruker dagens fire-and-poll-flyt: umiddelbar bekreftelse, live status på siden, mulighet til å lukke siden og få e-post når boardet er klart.
- R8. «Klart»-e-posten peker til boardets delings-side (ikke rå board-URL som i dag).

**Delings-side (leveransen)**

- R9. Hvert generert board får en delings-side med: forhåndsvisning av boardet, «kopier lenke», «kopier iframe-kode» (ferdig snippet) og QR-kode for prospekt/visning. Kopier-handlingene gir synlig bekreftelse (f.eks. knappen skifter til «Kopiert!») — en stille mislykket kopiering av iframe-snippeten ødelegger embed-oppsettet uten at megleren merker det.
- R10. Delings-siden inneholder kort, ærlig FINN-veiledning: FINN-annonser tillater ikke iframes — lenken legges inn som lenke i annonsen (via meglers fagsystem) eller i annonsetekst. Iframe-koden er for kontorets egen objektside.
- R11. Delings-siden er gjenfinnbar via e-posten gjennom hele pilotperioden: delte delings-side- og board-URLer får redirect-garanti (301 ved enhver URL-omlegging, inkludert sommer-rebuild-cutoveren) — pilot-URLene er en eksplisitt constraint i rebuilden. Ubegrenset «for alltid» loves ikke i prototype-stadiet.
- R18. «Kopier lenke» og QR-koden koder board-URLen direkte (kjøper-vendte artefakter) — en kjøper som scanner QR på visning eller klikker FINN-lenken skal lande i board-opplevelsen, aldri på delings-siden. Delings-side-URLen deles kun med megleren via «klart»-e-posten.
- R19. Alle distribusjons-artefakter bærer kanal-markør fra dag én — `?src=finn` i kopier-lenken, `?src=embed` bakt inn i iframe-snippeten, `?src=qr` i QR-payloaden — og boardet fanger markøren inn i engagement-konvolutten ved `board_viewed`. Uten dette kan FINN- vs embed- vs QR-trafikk aldri skilles retroaktivt (Moat 2).

**Embed-modus**

- R12. Boardet får en embed-modus (samme board-URL med embed-parameter): fungerer i iframe på en objektside, med tydelig «Åpne i fullskjerm»-knapp som åpner placy.no-siden i ny fane.
- R13. Embed-modusen kaprer ikke vertsidens scroll: kart-gestures (scroll-zoom, touch-pan) håndteres slik at kjøperen kan scrolle forbi iframen uproblematisk på både desktop og mobil.
- R20. Engagement-instrumenteringen (Moat 2) skal leve i embed-modus: dagens kode hopper eksplisitt over `board_viewed` når `embed=true` (teaser-semantikken) — når embedden blir fullt board, er den pilotens mest trafikkerte flate, og events (med kontekst-konvolutt inkl. `src`-markør fra R19) må flyte derfra.
- R14. Innramming er allerede tillatt globalt (bevisst valg i `next.config.mjs` — ingen frame-headers utenom `/admin` som er DENY, nettopp fordi boards embeddes i kunde-iframes). Kravet er derfor VERIFISERING i faktisk iframe på en ekstern testside (mobil + desktop), ikke en header-endring — samt en eksplisitt ratifisering av åpen framing vs. per-domene-allowlist for embed-modus (se Outstanding Questions).

## Success Criteria

- En pilot-megler kan gå fra adresse til delings-side uten hjelp fra Andreas — hele flyten selvbetjent.
- Minst ett board fra piloten er faktisk embeddet på en ekte objektside og lenket fra en ekte FINN-annonse. Embeddingen utføres av kontorets nettansvarlige med iframe-snippeten fra delings-siden (ikke av Andreas), og verifiseres med URL/skjermbilde av den live objektsiden.
- Embed-opplevelsen holder kvalitetsstandarden på kjøpersiden: ingen scroll-kapring, fullskjerm-knapp fungerer, verifisert på mobil og desktop.
- Engagement-events (`board_viewed` med kontekst-konvolutt) er verifisert å ankomme fra et board rendret inne i den eksterne test-iframen (R14) — samme verifiseringspass, én ekstra assertion.
- Adopsjon, ikke bare rørleggerarbeid: minst én megler genererer board nr. 2 uoppfordret innen pilotperioden — det er gjentaksbruken kjede-avtalen prises på.
- Etterspørselsloggen fanger avviste adresser slik at neste strøk-kuratering kan begrunnes med pilotdata.

## Scope Boundaries

- **Ingen innlogging/auth for meglere** — kontor-lenken er tilgangsmodellen i piloten. (Admin i prod forblir avslått; dette bygger ikke på admin-flatene.)
- **Ingen betaling** — piloten er gratis; prising (300–800/listing, kjede-SaaS) håndteres i kjede-avtalen, ikke i produktet nå.
- **Ingen kjede-branding av selve boardet** — boardet er Placy-brandet; kontor-scoping gjelder inngang og eierskap, ikke visuell profil.
- **Ingen board-administrasjon for megler** (slette, regenerere, redigere) — delings-siden er lesing/kopiering. Dupliserte adresser gjenbruker eksisterende request innenfor samme kontor (jf. R16 for kryss-kontor-tilfellet).
- **Kun nivå 1** — nivå 2-kuratering forblir admin-/operatørarbeid (`/provision-rapport`).

### Deferred to Separate Tasks

- Kontor-galleri («alle boards fra vårt kontor») — vurderes når piloten viser gjenbruksbehov.
- Selvbetjent onboarding av nye kontorer — kontorer opprettes manuelt av Andreas i piloten.

## Key Decisions

- **Rolle: kjede-pilot-verktøy** — bygges for å pilotes mot ÉN kjede; tilgang i praksis lukket via delte lenker. Ikke åpen lead-gen, ikke betalt fra dag én.
- **Kontor-scopet pilot-lenke** fremfor åpen side med kode eller e-postdomene-gating — føles som kjedens verktøy, fjerner friksjon (megler slipper kontorfelt), og gir riktig eierskap automatisk.
- **Rent verktøy-landing** — bare inputfeltet; innsalget er allerede gjort via kjeden.
- **Delings-side per board** fremfor alt-i-e-post — iframe-kode i e-post er klønete; én stabil side samler lenke/iframe/QR/FINN-instruks.
- **Fullt board i iframe (+ fullskjerm-knapp)** fremfor teaser-widget — én opplevelse å vedlikeholde, kjøperen får verdien i rammen.
- **Geofence til kuratert dekning** fremfor å generere degraderte boards — pilotens førsteinntrykk beskyttes, og avviste adresser blir styringsdata for kuratering.

## Dependencies / Assumptions

- Bygger på eksisterende PRD 3 Unit 8-flater: `components/generer/GenererForm.tsx`, `app/api/generation-requests/route.ts`, `generation_requests`-tabellen, e-postutsending (hei@placy.no).
- Geofencen forutsetter at kuratert dekning kan avgjøres fra et koordinat (strøk-polygonene fra Moat 1 / `lib/pipeline/find-area-for-point.ts`-sporet) — teknisk detalj avklares i planlegging.
- Piloten er Trondheim-basert (kuratert dekning finnes kun der i dag).

## Outstanding Questions

### Resolve Before Planning

*(ingen produkt-/scope-beslutninger gjenstår — punktene under er tekniske detaljer som hører hjemme i planleggingen)*

### Deferred to Planning

- [Affects R5][Technical] Nøyaktig definisjon av «kuratert dekning» for geofencen — polygon-treff mot kuraterte strøk, eller strøk + buffersone?
- [Affects R12–R14][Technical] Embed-parameterens form og hvilke UI-elementer som skjules/justeres i embed-modus (drill-in-gapet på VO-boards er kjent fra før). Merk: `?embed=1` eksisterer allerede med motsatt semantikk (splash-teaser via `BoardEmbedGate` + `ReportReelsPage`s `embed`-prop, utklikk via `?from=embed`) — R12 erstatter den semantikken, ikke bygger ved siden av. Scroll-håndteringen (R13) kan gjenbruke AUTO→GREEDY-aktiveringsmønsteret fra `components/map/map-view-3d.tsx`.
- [Affects R9][Technical] QR-generering: `qrcode.react` er allerede dependency — i praksis client-side render på delings-siden, ikke et infrastrukturvalg.
- [Affects R1][Technical] Hvordan kontor-slugs opprettes/vedlikeholdes i piloten (manuell operasjon er akseptabelt).
- [Affects R10][Needs research] Beste praktiske FINN-plassering av lenken (fagsystem-felt vs. annonsetekst) — verifiseres med pilot-megler, ikke antas.
- [Affects R12–R13][Technical] Tidlig gesture-spike: verifiser at gmp-map-3d (persistent 3D, kan aldri unmountes) kan yielde scroll til vertsiden i iframe FØR embed-UI bygges — med eksplisitt fallback-beslutning (2D-kart i embed-modus) hvis 3D ikke kan temmes. Mapbox har `cooperativeGestures`; gmp-map-3d er en annen og mindre moden API.
- [Affects R14][Security][User decision] Ratifiser åpen framing (dagens bevisste tilstand) vs. per-kontor-domene-allowlist for embed-modus — åpen framing lar hvem som helst embedde Placy-brandet innhold og åpner clickjacking-flate; allowlist er ny restriktiv jobb som ikke må knekke eksisterende kunde-iframes.

### From 2026-07-07 review (design)

- [Affects R5][Design] Geofence-stoppens interaksjonsform er udefinert (inline-validering under adressefeltet / egen side-tilstand / modal) — dette er pilot-meglerens første negative opplevelse, og formen må matche «rent verktøy»-tonen. Avgjøres i planlegging/design, ikke vilkårlig i implementasjon.
- [Affects R9, R12–R13][Design] Iframe-snippeten mangler sizing-guidance (minimum høyde/aspekt): bottom-sheet-mønsteret på mobil trenger plass til å rendre og dras — en for lav/smal iframe på kontorets side knekker mobil-kvalitetskriteriet.

## Next Steps

→ `/ce-plan` for strukturert implementeringsplan
