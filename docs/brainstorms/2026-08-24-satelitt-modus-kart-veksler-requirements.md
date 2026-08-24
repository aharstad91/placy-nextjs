---
date: 2026-08-24
topic: satelitt-modus-kart-veksler
---

# Satelitt-modus i boardets kart-veksler

## Problem Frame

Boardets kart-veksler (pillen nederst i midten) tilbyr i dag to visninger: «Kart» (Mapbox vektor) og «3D» (Google photorealistic, skrå vinkel). Det mangler en rett-ovenfra-orientering — visningen folk kjenner fra Google Maps satellitt og FINN-kartet, og den letteste å orientere seg i («hvor er hva i forhold til boligen»).

Nøkkelinnsikt fra kontekst-scanen: satellittbildet finnes allerede. Google 3D-motoren sett rett ovenfra (tilt 0°) *er* satellittbildet, og motoren har kameraflyvning (`flyCameraTo`) mellom vilkårlige posisjoner. «Satelitt» er derfor en kamerapositur i eksisterende motor, ikke en ny kartmotor eller tile-kilde — og overgangen Satelitt↔3D kan være én kontinuerlig kamerabevegelse.

## Requirements

**Veksler-UI**
- R1. Kart-veksleren får et tredje segment: «Kart | Satelitt | 3D», i alle flater der veksleren finnes (desktop-pille og mobil ⚙-popover). Gjelder boards med 3D-tillegget (`has3dAddon`) — veksleren og Google-motoren finnes bare der; boards uten er uendret (ren Mapbox, ingen veksler).
- R2. Satelitt↔3D veksles med en myk kameraflyvning innen Google-motoren (ingen reload, ingen kutt). Kart↔(Satelitt/3D) forblir dagens motorbytte mellom Mapbox og Google.

**Satelitt-modusens kamera**
- R3. Satelitt viser rett ovenfra (tilt ≈ 0°) med nord opp.
- R4. Auto-orbit er av i Satelitt; Auto/Fri-segmentet skjules (samme regel som i 2D-modus i dag). Et roterende rett-ovenfra-kart er desorienterende.
- R5. POI- og kategoriklikk i Satelitt gir kameraflyvning med ovenfra-perspektiv: kameraet panorerer og zoomer til målet, men tilter ikke og roterer ikke (heading holdes på 0 — nord opp gjelder også under og etter flyvning). Merk: dette er NY flyvningsatferd, ikke bevaring — boards uten voice-over står i fri kameramodus i dag og har ingen director-flyvninger. Satelitt må derfor være en director-eid tilstand (R8), ikke et engangs-kamera-skriv.

**Default ved lasting**
- R6. Boards MED 3D-tillegget men uten voice-over åpner i Satelitt ovenfra. 3D aktiveres ved klikk. Basic-introen («Utforsk nabolaget»-flyturen som avslører pins) beholdes med samme bane og reveal-koreografi, men LANDER ovenfra (tilt 0, nord opp) i stedet for skrått; segmentet viser «Satelitt» under og etter flyturen. Lastetilstanden før introen er som i dag (rent kart), nå sett ovenfra.
- R7. Boards med voice-over/flythrough åpner som i dag (3D-intro + orbit) — cinematikken vinner. Velger brukeren Satelitt manuelt etterpå, respekteres valget (R5).

**Satelitt som kameratilstand (ikke engangs-positur)**
- R8. Satelitt er en vedvarende, director-eid kameratilstand med regler for ALLE kamera-eiere: (a) alle director-flyvninger (POI, kategori, oppsummering) klampes til tilt 0 / heading 0 mens Satelitt er aktiv; (b) VO-beats som tar kameraet (welcome/outro) vinner over et manuelt Satelitt-valg mens de spiller — konsistent med R7 — og Satelitt gjenopprettes når beaten er ferdig; (c) manuell tilt-/rotasjonsdrag i Satelitt flipper segmentet til «3D» (samme mønster som dagens Auto→Fri-drag-takeover; det finnes ingen gesture-lås i Google-motoren) — pillen skal aldri lyve om hva som er på skjermen; (d) ved retur til 3D gjenopptas forrige kameramodus (auto → orbit-re-aim på VO-boards, fri ellers).
- R9. Veksler-tilstand under Satelitt↔3D-flyvningen: klikket segment blir aktivt umiddelbart (optimistisk), klikk på et annet segment midt i flyvningen avbryter og omdirigerer, klikk på det aktive segmentet er no-op.
- R10. Modusvalgets levetid: in-memory per sesjon — reload gir default-regelen (R6/R7). Valget overlever POI-/kategorinavigasjon, «Vis alle» og et Kart-mellomsteg (Satelitt → Kart → tilbake lander i Satelitt). URL-param for modus er utenfor scope.

## Success Criteria

- Brukeren kan veksle mellom tre visninger, og Satelitt↔3D oppleves som én sammenhengende kamerabevegelse.
- Basic-boards åpner rett ovenfra med nord opp; VO-boards er uendret ved lasting.
- Pins, labels og popups fungerer uten regresjon i ovenfra-visningen (inkl. label-declutter, som er kalibrert for skrå vinkel).

## Scope Boundaries

- Ingen Mapbox satellitt-stil — «Kart» forblir vektorkartet.
- Default-modus velges av en avledet regel (har boardet voice-over?), ikke eksplisitt per-board-konfig — og det finnes ingen override-UI per board i denne omgangen.
- Flyturenes BANER og orbit-koreografien er urørt; det eneste koreografi-avviket er basic-introens landingspositur på Satelitt-default-boards (R6).
- Boards uten 3D-tillegget er uendret: ren Mapbox 2D, ingen veksler (R1).

## Key Decisions

- **Tredje segment fremfor egen perspektiv-toggle**: synlighet vinner — «Satelitt» som undervalg synlig kun i 3D blir ikke oppdaget. På mobil kollapser kontrollene uansett i ⚙-popoveren, så bredden koster mest på desktop der det er plass.
- **Satelitt = kamerapositur i Google-motoren, ikke ny motor**: gir myk overgang gratis, null ny tile-/datakostnad, og gjenbruker hele pin/label/popup-laget. (Verifisert: `flyCameraTo` og tilt-modellen finnes i `components/variants/report/board/board-3d-camera-director.ts`; tilt 0 = rett ned.)
- **Satelitt som default på ikke-autorerte boards**: rett ovenfra er den letteste orienteringen og konvensjonen folk kjenner; 3D er verdi man aktiverer.
- **Cinematikk vinner på VO-boards**: den autorerte opplevelsen er produktet på disse boardsene.

## Dependencies / Assumptions

- Antakelse (må verifiseres visuelt tidlig i planleggingen, side-om-side mot Google Maps satellitt på samme utsnitt): photorealistic-motoren rett ovenfra bærer «satelitt»-merkelappen. Tre sjekkpunkter: (1) tile-skarphet på range ~800–1600 m, (2) mesh-artefakter — trær/tak kan se «smeltet» ut på nærzoom, (3) perspektiv-lening — motoren er ikke ortofoto, så bygg lener utover mot skjermkantene; bare skjermsenteret er ekte nadir. Feiler verifiseringen, går beslutningen tilbake til produkteier med to definerte utveier: omdøpe segmentet til «Ovenfra», eller gjenåpne Mapbox-satellitt-alternativet.
- Label-declutter og markør-projeksjon i 3D-kartet antas å fungere ved tilt 0 — nylig merget og kalibrert mot skrå vinkel, må sjekkes.

## Outstanding Questions

### Deferred to Planning
- [Affects R3][Technical] Hvilken range/høyde Satelitt-hviletilstanden skal ha — gjenbruk av dagens fit-logikk (ramm inn alle markører) eller fast avstand som orbit?
- [Affects R5][Technical] Skal POI-flyvning i Satelitt bruke egen (kortere) range enn dagens `POI_RANGE`, siden ovenfra trenger mindre avstand for samme kontekst?
- [Affects R1][Technical] Segmentbredder/tekst i kompakt mobil-variant — får tre segmenter plass uten å sprenge pillen?

## Next Steps
-> /ce-plan for strukturert implementeringsplan
