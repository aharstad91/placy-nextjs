# Placy Reels — produktkonsept

**Dato:** 2026-05-24
**Status:** Tech-spike validert (`PROJECT-LOG.md` 2026-05-24). Produkt-konsept dokumentert. Research pending.
**Eierskap:** Placy (Andreas + Markus)
**Relaterte dokumenter:**
- `docs/strategy/2026-05-24-placy-reels-cross-vertical.md` — strategi-plassering
- `PROJECT-LOG.md` 2026-05-24 — tech-stack verifikasjon
- `docs/strategy/2026-05-06-events-spor-trondheim.md` — hotell/event-spor som potensielle Reels-aftermarket

---

## Navn

**Placy Reels** — vertikalt SOME-format kort-form video for lokasjons-baserte teasere.

Begrunnelse:
- Mønsteret `Placy + [substantiv]` matcher eksisterende produkt-nomenklatur (Explorer, Guide, Report).
- "Reels" signaliserer umiddelbart hva produktet er (vertikal short-form video for SOME) — kjøperen trenger ikke forklaring.
- Format-agnostisk i praksis: leveres som 9:16 MP4 som funker på Instagram Reels, TikTok, Facebook Reels, YouTube Shorts.

**Åpent spørsmål:** "Reels" er Metas varemerke for deres SOME-format. Sannsynligvis OK i Norge for et B2B-verktøy som *lager* innhold *for* Reels-plattformer (deskriptiv bruk, ikke konkurrerende social network-produkt), men bør verifiseres før offentlig lansering.

## Formål

Placy Reels er **funnel-første-steg** for alle Placy-produkter (Explorer/Guide/Report).

I dag stopper Placy ved nettsiden — vi har ingen organisk "finn-meg"-mekanisme på de plattformene målgruppen faktisk scroller. Reels løser tre problemer samtidig:

1. **Scroll-stopper i SOME-feed** — voice over + ambient motion er bevist-effektivt på mobile flater (Markus bekrefter fra hans markedsføringserfaring).
2. **Markedsføringsverktøy for distribusjons-partnere** — meglere, hotellkjeder, eventarrangører, cruiseliner får ferdig SOME-materiale uten å være video-produsenter. De får bygd merkevare og leadliste, vi får trafikk til Placy-rapporter/-guider.
3. **Visuell validering av Placy-konseptet** — kompenserer for at Rapporten i dag er "kart + tekst", som visuelt signaliserer mangel der vi egentlig har styrke (datadyp + redaksjonell).

Det er **ikke** en visningsvideo for boligprosjekter, ikke en kunstnerisk film, ikke et erstatningsprodukt for profesjonell foto/video-produksjon. Det er en *funnel-asset* — formålet er klikket gjennom QR/lenke, ikke estetikken som selvstendig produkt.

## Målgrupper

### Primær (B2B-kjøpere/distribusjons-partnere)

| Segment | Use case | Volum-potensial | Kobling til eksisterende spor |
|---------|----------|-----------------|-------------------------------|
| **Eiendomsmeglere** | Markedsfør boligprosjekt eller privatsalg → drive til Placy Rapport for prosjektet/området | Propr ~1700 prosjekter/år | Pågående megler-spor |
| **Hoteller** | "Slik er nabolaget" sendes med booking-bekreftelse eller vises i lobby (QR) → drive til hotellets Placy Explorer | ~17 hoteller listet topp-3-pipeline | `2026-05-06-events-spor-trondheim.md` |
| **Event-arrangører** (Kulturnatt, festivaler) | Teaser per venue eller hele event-områdes-preview | Sesongbasert per arrangement | `2026-05-06-events-spor-trondheim.md` |
| **Cruise / havne-aktører** | "6 timer i Trondheim" sendes til passasjerer FØR ankomst | ~200 anløp/sesong Trondheim, 30+ destinasjoner | Parkert til fase 3 per LOG.md, men design'e for det fra start |
| **Visit-organisasjoner / DMOs** | Promoter destinasjon/område til turister | Per destinasjon | Visit Trondheim som intro-mekanisme allerede etablert |

### Sluttbruker (de som ser videoen)

- Potensielle boligkjøpere som scroller Instagram/TikTok/Facebook Reels
- Cruise-passasjerer som planlegger shore-excursions FØR avgang
- Hotellgjester som vurderer nabolaget rundt hotellet
- Eventbesøkende som vurderer å delta

## MVP-scope (denne fasen)

**Bolig-vertikal først**, fordi:
- Tech-spike allerede gjennomført med Stasjonskvartalet (Veo + ElevenLabs + ffmpeg pipeline).
- Eksisterende megler-spor leverer naturlig pull (megler trenger SOME-materiale uansett).
- 30-60 sek-pipeline kan kjøre lokalt på laptopen — ingen infrastruktur-investering.

**Konkret MVP-leveranse:**
1. Stasjonskvartalet-video #1 (dagsreise-narrativ) — ✅ levert i tech-spike
2. Stasjonskvartalet-video #2 (alternativt narrativ-format — fakta-drevet eller vibe-drevet) — pending
3. Bevisst A/B-vurdering av de to formatene — hvilken vinkel resonerer best
4. Polert end-card med Placy-logo + QR til Rapporten
5. Test-distribusjon: Markus / Andreas legger ut på Instagram, måler engagement

## Tech-pipeline (validert)

| Steg | Verktøy | Per-video kostnad |
|------|---------|-------------------|
| Bilde-input | Meglerens egne områdebilder (eller AI-generert ved mangel) | $0 |
| Image-to-video | Google Veo 3.0 fast via Gemini API | ~$0.20-0.50 per 8s klipp (skalere ut: 5 scener × 8s = ~$1-2.50/video) |
| Voice over | ElevenLabs Erik turbo_v2_5 | ~$0.05-0.15 per 50 ord (~22 sek tale) |
| Komposisjon | ffmpeg single-pass (`scripts/compose-some-video.ts`) | $0 |
| Distribusjon | Manuell upload av kunden, eller Buffer/Hootsuite for skalering | $0-ekstern abonnement |

**Per-video kost-estimat (5 scener à 8s + voice over):** ~$1-3 i variabel kostnad. Det er ~30 kroner. Det er innenfor *enhver* prising av produktet.

## Format-prinsipper (lærdom fra spike)

- **9:16 vertikalt, 720×1280 minimum** — SOME-native
- **20-30 sekunder total** — lengre faller av i feed-engagement
- **5 scener à 4-5 sek** — variasjon stopper scrolling
- **Voice over som primær fortelling** — ikke kun musikk, ikke kun tekst-overlay
- **Ambient bevegelse på stillbilder** — vann, sky, bakgrunns-figurer, vind. **IKKE** objekt-detaljer som damp/væske/tekstur (overdrives av AI-modellene)
- **End-card med CTA og QR** — funnel-mekanikken er hele poenget med produktet

## Manus-formater (utforsket)

Iterert gjennom 4 versjoner samme dag som tech-spike:

1. **Dagsreise** (v1, original spike) — kronologisk gjennom et hverdagsliv. Stasjonskvartalets egen narrativ-vinkel. *Funket teknisk, men beholder samme begrensning som meglerens stockfoto: sted-sentrisk fortelling uten Placy-anatomi.*
2. **Persona** (v2, research-anbefalt) — navngitt karakter ("Maria"). *Forkastet:* fake persona bryter tillits-kontrakten (vi har allerede AI-animasjon som én strikk på tillit; kan ikke samtidig finne på personer). Persona aktiverer identifikasjon når personen ER ekte — for Placy må persona-formatet vente til vi har faktiske beboer-testimonialer.
3. **Kategori** (v3-v4, **endelig retning**) — speiler Placys rapport-anatomi. Intro selger prosjektet, kategori-rapsing presenterer de viktigste områdene, CTA inviterer til dypere utforsking. Hver Reel blir en *trailer for rapporten*.
4. **Fakta/tall, vibe/sanselig, testimonial/kontrast** — fortsatt åpne for cross-vertical-bruk (event, cruise, DMO). Per research: vibe/sanselig for event/cruise, persona/testimonial for eiendom *når person er ekte*.

## Endelig manus-mal (Placy-native kategori-format)

Strukturen er reproduserbar for alle Placy-prosjekter — bare prosjektnavn, områdekarakteristikk og kategoriene varierer.

```
INTRO  (~6s, 20-25 ord)
  "Velkommen til <PROSJEKT>, <områdekarakteristikk: 1 setning som
   selger prosjektets unike posisjon uten å overlappe med kategoriene>."

KATEGORI-RAPSNING  (~5s, 10-12 ord)
  "Se steder i nærheten innen <KAT1>, <KAT2>, <KAT3> med mer."

OUTRO  (~3s, 8-10 ord)
  "Trykk på linken for å utforske området på egenhånd."

TOTAL: ~14 sek (innenfor SOME-completion-sweet-spot 11-18s)
```

**Eksempel — Stasjonskvartalet (validert):**

> *Velkommen til Stasjonskvartalet, Trondheims nyeste bykvartal hvor du vil få muligheten til å leve midt i en levende bydel. Se steder i nærheten innen mat, transport, hverdagsliv med mer. Trykk på linken for å utforske området på egenhånd.*

**Tre prinsipper bak malen:**
- **Ingen overlapping mellom intro og kategori-rapsning.** Bruk én tematisk vinkel i intro (her: "levende bydel"), ikke nevne kategorier som så kommer rett etter.
- **3 kategorier + "med mer".** Antyder bredde uten å være listete. 5+ kategorier blir TTS-prosesjon.
- **Generisk handlings-CTA.** "Trykk på linken" fungerer både organisk på SOME (bio-link) og som klikkbar ad (CTA-knapp). Unngår plattform-spesifikk lock-in.

## Visuell-mapping: Placys egne illustrasjoner som scene-kilder

Beslutning fra 2026-05-24-iterasjonen: Reels skal animere **Placys eksisterende per-kategori-illustrasjoner**, ikke stockfoto fra meglere eller AI-generert eksternt materiale.

For hvert Placy-prosjekt finnes ~8 illustrasjoner i `public/illustrations/<prosjekt>-<kategori>.jpg`:
- `-hero.jpg` (brukes som intro-bilde i Reel)
- `-mat-drikke.jpg`, `-transport.jpg`, `-natur-friluftsliv.jpg`, `-opplevelser.jpg`, `-trening-aktivitet.jpg`, `-hverdagsliv.jpg`, `-barn-oppvekst.jpg`

**Pipeline-konsekvens:**
1. Reads prosjekt-illustrasjoner fra `public/illustrations/`
2. Animer hver via Veo med ambient-prompt
3. Komponer per kategori-mal over: hero → 4 kategori-scener → end-card
4. Voice over genereres fra prosjektets kategori-data + områdebeskrivelse

**Strategisk effekt:** brand-konsistens mellom SOME-Reel og Placy-rapport. Seeren ser samme visuelle uttrykk når de klikker QR'en — ingen kognitivt brudd.

## TTS-uttale-lærdom

Erik turbo_v2_5 sliter med engelske/utenlandske produktnavn. "Placy" ble forsøkt via fonetisk skrivemåte ("playsee.no") — funket ikke, Erik leste det bokstavelig.

**Beslutning:** Voice over unngår "Placy"-navnet helt. Brand-eksponering skjer via:
- End-card (visuell Placy-logo + QR)
- Tekst-overlay "Placy" gjennom video (på muted-versjonen)
- CTA-handling som lander på Placy-domene

Voice over bruker generiske ord ("området", "nabolaget"). Dette utvider og spesifiserer [feedback_norsk_tts_stedsnavn]-lærdommen til også gjelde fremmedord/produktnavn.

## Reels in-context i Placy Rapport — utforsknings-spor

Per 2026-05-24 (kveld) skiftet fokuset fra SOME-distribusjon til **hvordan Reels kan integreres tilbake i selve Placy-rapporten**. Innsikten er at vi i dag har en visuell-svakhet i Rapporten ("kart + tekst") som Reels-pipelinen kan løse innenfor selve produktet, ikke bare som SOME-asset.

### Hvorfor dette har potensial

Pipelinen vi har bygget produserer:
- Animerte illustrasjoner per kategori
- Voice over per kategori-narrasjon
- Komponerte 14-sek vertikale videoer

Alle disse byggeklossene er allerede *Placy-asset* — de samme illustrasjonene som vises i rapportens kategori-sider, samme TTS-pipeline som audio-tour. Vi har dermed flere måter å gjenbruke dette inn i Rapporten på, uten ny produksjon.

### Mulige integrasjons-mønstre

1. **Animerte kategori-illustrasjoner i Rapporten**
   - Hver kategori-side i Rapporten (mat, transport, etc.) viser i dag en statisk illustrasjon
   - Erstatt eller supplement med Veo-animert versjon (samme bilde, subtle motion)
   - Lavest barriere: ingen ny Reel-produksjon, bare animasjons-laget
   - Forsterker "Placy er bevegelig nærområde"-følelsen

2. **Per-kategori-Reel som modal-trigger**
   - Knapp/CTA på hver kategori-side i Rapporten: "Se reelen for [kategori]"
   - Åpner en 10-15 sek Reel som narrativiserer akkurat den kategorien
   - Mer engasjerende enn statisk illustrasjon, lengre enn audio-tour-kapittel
   - Krever én Reel per kategori per prosjekt (~5-7 Reels per prosjekt = ~10-15 USD i Veo-kost)

3. **Hero-Reel øverst i Rapporten**
   - Den SOME-distribuerte Reelen (kategori-versjonen vi har bygget) som autoplay-på-mute i toppen av Rapporten
   - Etablerer prosjekt-følelse umiddelbart, og er reusable: samme video som lanseres på SOME
   - Krever ingen ekstra produksjon utover SOME-versjonen
   - Match med research-funn om "85% ser SOME-video på mute" — også sant for embedded video på nettside

4. **Kobling til audio-tour**
   - Eksisterende audio-tour-konsept har voice over per kapittel
   - Reels-pipelinen kan generere visuell motpart: når audio-kapittel spiller, viser tilhørende animert illustrasjon
   - Kraftig kombinasjon: audio-driven storytelling + visuell stedsfølelse
   - Krever synkronisering mellom audio-kapittel-timeline og illustrasjons-bytter

### Spørsmål som må svares

- **Skal Reels være en gjenbrukt asset eller produseres separat per integrasjons-context?** Hero-Reel kan deles med SOME, men per-kategori-Reel for modal-bruk har annen lengde og fokus.
- **Hva er rekkefølgen?** Hero-Reel er lavest barriere (gjenbruker SOME-Reel) — start der. Per-kategori-Reels er større investering, må vente til vi har validert konseptet med hero.
- **Skal animerte illustrasjoner erstatte eller supplere statiske?** Erstatt er enklere, supplere gir progressive-enhancement-fallback for treg lasting.
- **Audio-tour-kobling: matcher eksisterende per-kategori-narrasjon med Reel-pipeline?** Måtte sjekkes mot audio-tour-arkitekturen.

### Strategisk verdi

Dette kompletterer Reels som **cross-vertical funnel-asset**:
- SOME → driver trafikk til Rapport (eksternalt)
- Reels in-context → øker engagement og time-on-page innenfor Rapport (internt)

Begge bygger på samme produksjons-pipeline. Begge bruker Placys egne illustrasjoner. Begge skalerer per prosjekt uten ny redaksjonell produksjon.

**Konsekvens:** Reels er ikke bare et SOME-produkt. Det er et visuell-laget for hele Placy. Når Rapporten har Reels-integrasjon, er den mye sterkere visuelt — som motvirker "kart + tekst"-svakheten som Markus opprinnelig flagget i konsept-brainstormen.

### Neste konkrete steg (for utforskning, ikke implementering)

- Vurder hvilket integrasjons-mønster som har lavest implementasjonskost vs. høyest produkt-effekt
- Spesifikt: hero-Reel i Rapporten (mønster 3) er trolig laveste-friksjon-startpunkt
- Bygg en hero-Reel-integrasjon i en eksisterende prosjekt-rapport (f.eks. Stasjonskvartalet) for å validere konseptet før vi forplikter til pipeline-arkitektur

## Kobling til eksisterende Placy-produkter

- **Reels → Report** (megler-spor): primær funnel-rute. End-card-QR går til boligprosjektets Rapport.
- **Reels → Explorer** (hotell-/cruise-/destinasjons-spor): end-card-QR går til hotellets/destinasjonens Explorer-skin (eksisterende Scandic-modell).
- **Reels → Guide** (event-spor): end-card-QR går til Kulturnatt/event-Guide for området.

Pipelinen er **agnostisk for hvilket Placy-produkt den driver til** — bare end-card og voice-over-manuset varierer per spor.

## Skalering: åpne spørsmål

- **Self-serve for meglere (Propr-volum 1700/år)** — krever UI for at megler kan laste opp bilder, velge format, få ferdig video. Pipeline-laget håndteres serverside.
- **Stedsnavn-uttale på norsk** — kjent TTS-eksplosiv ([memory: feedback_norsk_tts_stedsnavn]). Manus-curating er primær løsning.
- **Internasjonalisering** — cruise/turist-spor krever engelsk/tysk minimum. ElevenLabs støtter, men kvalitetskontroll må skaleres.
- **Bakgrunnsmusikk-lisensiering** — ikke testet ennå, men sannsynligvis kritisk for SOME-feel. Royalty-free biblioteker eller Epidemic Sound-abonnement.
- **End-card-design** — statisk JPG i MVP, men trenger animert versjon med logo + QR + CTA-tekst som ser ut som det er kuratert, ikke amatør.

## Hva som *ikke* er i scope

- Profesjonell visningsvideo for premium-prosjekter (annen profil, annet budsjett)
- Lang-form innhold over 60 sek (annen distribusjons-mekanikk)
- Live-streaming eller interaktivt innhold
- Direkte SOME-publisering fra Placy (kunden eier sin egen distribusjon i MVP)

## Research-funn (2026-05-24)

Ekstern research via `ce-web-researcher` levert samme dag. Hovedfunn som påvirker produkt-MVP:

### Format og lengde

- **20-25 sek er sweet spot** for lokasjons-funnel-video (vi er på 24.7 — riktig).
- **70-85% av seere bestemmer seg innen 3 sek** — første sekundet må ha visuelt + lyd + tekst *simultant*.
- **Layered hooks gir 3x høyere 3-sek hold** enn single-element-intro.
- **85% ser SOME-video på mute** — tekst-overlay synkronisert med voice over er ikke nice-to-have, det er bærebjelken for halvparten av målgruppen.

### Narrativ-format per spor (forskning fra Frontiers 2026 + ScienceDirect 2024)

| Format | Bolig | Turisme/DMO | Event | Cruise |
|--------|-------|-------------|-------|--------|
| Dagsreise (kronologisk) | Sterk | Middels | Svak | Middels |
| Fakta/tall | Sterk | Svak | Middels | Svak |
| Vibe/sanselig | Middels | Svak | **Sterkest** | **Sterkest** |
| Persona/testimonial | **Sterkest** | Sterk | Sterk | Svak |

**Implikasjon:** For bolig-MVP (Stasjonskvartalet), bytt fra ren dagsreise til persona-drevet versjon ("Følg Maria gjennom en morgen"). Behold dagsreise som A/B-baseline. For Kulturnatt-variant (event-spor), gå vibe/sanselig. For cruise-fasen (når den åpner), vibe/sanselig.

### AI-innhold-mottakelse (Animoto-rapport jan 2026)

- **83% av forbrukere sier de kan identifisere AI-video.**
- **36% sier det senker tillit** når de oppdager det skjult.
- **Transparens øker tillit** — eksplisitt "AI-visualisering"-disclaimer i end-card er bedre enn å skjule.
- Datamangel: nordisk/norsk-spesifikk AI-mottakelse er ikke dokumentert eksternt — vi må teste på vår egen målgruppe.

### CTA-mekanikk

- **Seed-CTA midt i video** (rundt 12-15 sek) fanger mute-seere og early-dropoffs — venter du til end-card er du for sen.
- **End-card minimum 5 sek** med CTA-ramme rundt QR.
- **Benefit-formulering slår sted-formulering**: "Scan for å utforske nabolaget" > "Se Stasjonskvartalet-rapporten".

### Voice over (forskning fra Frontiers Psychology 2025)

- **Stemme-kvalitet** (jevn, klar, moderat tempo) trumfer kjønn i tillit-signalering.
- Gender-match-effekt er ikke-signifikant for eiendoms-/turisme-context — **Erik er ikke en ulempe**.
- Lav tempo + tydelig artikulasjon er kritisk for ElevenLabs-output, spesielt for norske stedsnavn (kjent TTS-eksplosiv).

### Distribusjons-modell

- **"Canva for SOME"-mønster vinner over "egen mediakanal"-mønster** for B2B-verktøy.
- Kunden eier kanalen og følgerne — Placy leverer produksjons-infrastruktur + rapport-link.
- Placy-branding via end-card-QR + evt. subtilt vannmerke, ikke kontroll over publisering.
- Reduserer salgsfraksjon: megleren slipper å gi fra seg kontroll over sin egen SOME-tilstedeværelse.

### Cross-domain analogier som styrker konseptet

- **Matterport** løste "folk tror ikke på stillbilder"-problemet med interaktive 3D-turer. Strukturelt lik posisjon: produksjons-infrastruktur under kundens eget merke.
- **Spotify Canvas** (3-8 sek loopet video bak musikk) ga +80% tap-to-artist. Ambient visuals + audio + kortform = engasjements-multiplikator.
- **Duolingo on TikTok**: plattform-native estetikk slår polert produksjons-look for app-installs. *Implikasjon:* ikke optimaliser Reels mot "kino-kvalitet" — optimaliser mot "feed-native".

### Markedsgap (positiv)

Ingen norske meglere bruker AI-animert stillbilde-video systematisk per 2026. Visit-organisasjoner/DMOs er under-investert i AI-animert kortform. Cruise shore-preview er umoden kategori globalt. Vi er tidlig i alle tre spor.

## Top 5 endringer til neste Stasjonskvartalet-Reel

1. **Layer hook-sekundet** — Tekst-overlay ("Stasjonskvartalet · 5 min fra sentrum") simultant med voice over og bevegelse på frame 0-1. Ikke vent på stemmen for å etablere sted.
2. **A/B persona-format** — Lag versjon med navngitt persona-narrativ for direkte sammenligning med kronologisk dagsreise.
3. **Seed-CTA ved 12-15 sek** — Lett tekst-overlay-hint mid-video ("Hele rapporten — link i bio") som fanger mute-seere før end-card.
4. **End-card 5 sek + CTA-ramme + AI-disclaimer** — "Scan for å utforske nabolaget" med QR sentrert i ramme, subtekst "AI-visualisering" for tillit-/policy-compliance.
5. **Tekst-overlay synkronisert med voice over** — Hvert manus-beat har tilhørende tekst på skjerm. Muted-versjonen må være fullverdig.

## Neste steg

1. **A/B persona-versjon for Stasjonskvartalet** — manus + pipeline-kjøring med 5 endringer over.
2. **Polert end-card-design** — Figma/Canva-design som matcher Placy-brand, lengre eksponering, AI-disclaimer.
3. **Distribusjons-test** — Andreas/Markus publiserer på egne Instagram-kontoer, måler 3-sek-hold + completion + CTA-klikk.
4. **Dedikert worktree** når dette går fra spike til produkt (`placy-ralph-reels` eller lignende).
5. **Brukertest av AI-mottakelse hos norsk målgruppe** — datamangel som research-fasen flagget; må vi gjøre selv.
