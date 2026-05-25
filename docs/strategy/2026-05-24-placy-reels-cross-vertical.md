# Placy Reels — cross-vertical strategi-note

**Dato:** 2026-05-24
**Tema:** Placering av Placy Reels i sporvalg-landskapet
**Status:** Aktivt — sporvalg-konsekvensvurdering pre-research
**Relatert:**
- `docs/brainstorms/2026-05-24-placy-reels-brainstorm.md` — produkt-konsept
- `docs/strategy/2026-05-06-events-spor-trondheim.md` — hotell-/event-/cruise-sporvalg
- `PROJECT-LOG.md` 2026-05-24 — tech-spike-validering

---

## Kjernepåstand

Placy Reels er **ikke** et separat nytt produkt — det er en **funnel-asset som forsterker ALLE eksisterende Placy-produkter (Explorer/Guide/Report)**. Det er dermed:

1. **Tverr-sporvalg-asset** — fungerer for megler-, hotell-, event-, cruise- og destinasjons-spor uten omarkitektering av pipelinen.
2. **Akselerator for eksisterende beslutninger** — endrer ikke beslutningen i `2026-05-06-events-spor-trondheim.md` (hotell først, cruise parkert til fase 3), men gir hver fase et nytt salgsargument og leverer mer visuell tyngde i pitch'er.
3. **Lav lokal kostnad, høy strategisk verdi** — ffmpeg-pipelinen er gratis, Veo + ElevenLabs er ~$1-3/video. Inn-investering er minimal sammenlignet med upside i alle aktive spor.

## Hvordan Reels styrker hvert spor

### Bolig-spor (Propr-pilot, megler-aftermarket)

**Før Reels:** Megler får Rapport-lenke å dele. Rapporten må deles aktivt for å nå målgruppen. Distribusjon er bottleneck.

**Med Reels:** Megler får Rapport-lenke + ferdig SOME-video. SOME-video går viralt-potensielt i markeder hvor folk faktisk scroller (Instagram Reels = primær oppdagelses-flate for 25-45-segmentet). Megler blir markedsfører for prosjektet de selger, og vi får trafikk til Rapporten.

**Strategisk effekt:** Forsterker eksisterende salgsargument for megler-spor. Gir Placy en differensiator mot konkurrenter som bare leverer statiske områdesider.

### Hotell-spor (aktiv pitch — fase 1 per LOG.md)

**Før Reels:** Hotellet får Explorer-skin å lenke til via QR i lobby/booking-mail. Verdi-argumentet er "gjestene får ekspert-områdeguide".

**Med Reels:** Hotellet kan i tillegg sende en 20-sek SOME-video som teaser FØR ankomst (i booking-bekreftelse, på SOME-kanaler, i pre-stay-kampanjer). Det skaper *pre-arrival excitement* — en mye sterkere markedshendelse enn QR i lobby.

**Strategisk effekt:** Performance pilot-modellen (1490/mnd × 12 mnd) per LOG.md får et nytt verdiargument: "Du får ikke bare Explorer for gjestene, du får også Reels for markedsføring av området ditt." Det øker pris-tolleranse og reduserer churn-risiko.

### Event-spor (Kulturnatt, Midtbyen Mgmt — varm pipeline)

**Før Reels:** Event-Guide eller Explorer-skin lenkes fra arrangørs SOME-kanaler. Selve markedsføringen er arrangørens egen oppgave.

**Med Reels:** Hver event-venue eller hele event-området kan ha en Reel som teaser. "Slik er Kulturnatt på Lademoen" som 20-sek vertikal video, lett delbar på Kulturnatts egen SOME.

**Strategisk effekt:** Gir Kulturnatt/Midtbyen Mgmt et konkret SOME-vennlig markedsføringsverktøy — løser deres distribusjons-problem, ikke bare Placys. Senker terskelen for å si ja til pilot.

### Cruise-spor (parkert til fase 3 per LOG.md — men design for det fra dag 1)

**Avgjørelsen står:** Cruise er parkert til etter hotell-case study. Vi forfølger det IKKE aktivt nå.

**Men Reels endrer cruise-pitch'en fundamentalt når den fasen kommer:** I dag er argumentet "Placy gir cruise-passasjeren bedre lokal info når de er i havn." Det er svakt — cruiseliner har allerede shore-excursion-kataloger. Med Reels blir argumentet "Cruise-passasjeren får en personlig 6-timers preview av Trondheim sendt 24 timer før ankomst, basert på deres interesser." Det er produkt, ikke informasjon.

**Implikasjon:** Design Reels-pipelinen slik at den støtter:
- Engelsk + tysk voice over (Hurtigruten-passasjerer er primært nordmenn + tyske, Havila samme)
- Per-destinasjons-mal som lett kan genereres for 30+ havner
- A/B-testing av narrativ-formater (kanskje cruise foretrekker fakta-drevet vs. hverdags-narrativ)

Da er vi klare når fase 3 kommer, uten teknisk gjeld.

### Destinasjons-/DMO-spor (Visit Trondheim som intro-mekanisme)

**Status per LOG.md:** Visit Trondheim er anbefalingspartner / trust-signal, ikke betalende kunde. De er gateway til hotell-pitch.

**Med Reels:** VT får en konkret, gratis-å-bruke asset å distribuere — en Reels-video om Trondheim de kan dele på egen SOME. Det styrker partnerskaps-relasjonen, gjør oss mer relevant for fremtidige medlemsrapporter, og gir oss en organisk distribusjons-kanal til hotellene VT betjener.

## Sporvalg-konsekvensvurdering

| Spørsmål | Svar |
|----------|------|
| Endrer Reels prioriteringen i `2026-05-06-events-spor-trondheim.md`? | **Nei.** Hotell først, cruise fase 3, event sekundært. Reels forsterker hver fase, ikke endrer rekkefølgen. |
| Skal vi prise Reels separat eller bake det inn? | **Bake inn i eksisterende prising for MVP.** Reels = bonus-leveranse i hotell-pilot (1490/mnd inkluderer både Explorer + Reels). Per-megler-pris håndteres når Propr-pipelinen er klar — `tbd`. |
| Trenger Reels eget GTM (go-to-market)? | **Nei i fase 1.** Det er en feature/asset, ikke et standalone produkt. Eget GTM først hvis Reels viser seg å være verdt mer enn pilot-pris alene (måles via pilot-case study). |
| Hvilket spor er først til å eksponere Reels eksternt? | **Megler-spor** — Stasjonskvartalet er ferdig tech-validert, naturlig demo å vise på neste megler-møte. Hotell-spor mottar Reels som tilleggs-verdi i pilot-pitch (etter VT-intro). |
| Hva er prising-kost-tak? | **~$3/video i variabel kost** (Veo + ElevenLabs). Selv ved 100 videoer/mnd i pilot-volum = $300/mnd. Ubetydelig vs. potensial. |
| Når trenger vi ekstern dedikert ressurs? | **Når self-serve-UI for meglere skal bygges** (krever produkt-utvikler + designer). Fram til da kan Andreas + Markus kjøre semi-manuelt via CLI-pipeline. |

## Risici og åpne spørsmål

- **Reels-varemerke** — "Reels" er Metas merke. Bør verifiseres før offentlig lansering. Plan B-navn: "Placy Stories", "Placy Teaser", "Placy Snippets".
- **Norsk stedsnavn-TTS** — kjent problem ([feedback_norsk_tts_stedsnavn]). Manus-curatering må skaleres for stedsnavn-tunge bydeler. Aksept-kriterium: stedsnavnet er forståelig for nordmenn som kjenner byen.
- **AI-overdrevenhet** — Veo overdriver objekt-detaljer (damp, vann, hår). Disiplinerte prompts er krav, ikke valg.
- **End-card-amatørisme** — statisk JPG som end-card signaliserer hjemmelaget. Trenger designer-finish FØR vi viser til kunder.
- **Internasjonalisering** — påkrevd for cruise/turist-spor, ikke for megler-spor i fase 1.

## Beslutning fra denne noten

1. **Placy Reels er offisielt produktnavn** (med varemerke-verifikasjon som åpent punkt).
2. **Cross-vertical design fra dag 1** — pipelinen skal støtte alle Placy-produkter (Explorer/Guide/Report) som funnel-destinasjon, og alle aktive spor (bolig/hotell/event/cruise) som distribusjons-kjøper.
3. **Demo-ferdig først, GTM-strategi senere** — bygg én polert Stasjonskvartalet-Reel + dokumentert pipeline, vis frem i eksisterende sporvalg-pitcher, mål respons, juster.
4. **Ingen separat prising/-pakke i fase 1** — bake inn i eksisterende pilot-pakker som verdi-argument.
5. **Cruise-design baked in til pipeline** selv om cruise-spor er parkert — ingen ekstra-arbeid å sikre at internasjonalisering og per-destinasjons-mal støttes når fasen kommer.

## Neste konkrete steg

1. Loggføre denne beslutningen i `docs/strategy/LOG.md`.
2. SOME-best-practice-research før neste manus skrives.
3. Lage alternativ Stasjonskvartalet-Reel for A/B-grunnlag.
4. Vurdere når dette skal flyttes til dedikert worktree (sannsynligvis når MVP-leveranser går utenfor laptop-pipeline).
