---
date: 2026-05-18
revised: 2026-05-20
topic: rapport-board-helhetlig-narrativ
---

# Rapport-board — fra detalj-fanget til helhetlig narrativ

> **Revisjon 2026-05-20:** Skjerpet KD5 fra "to renderinger fra én kilde" til "én canonical tekst" (TTS-uttale parkert i PROJECT-LOG). Lagt til R18-R19b (karaoke ord-for-ord + cinematic sidebar-active-state), KD9 + KD10. Lukket Open Question #2.

## Problem Frame

Rapport-boardet for eiendom har i dag en *referansebok-arkitektur*: kategori-paginering med rik per-kategori-tekst (lead + body + "Les mer"-disclosure), Beligenhet/Punkter-toggle, opp til 47 redaksjonelt kuraterte POI-er. Hver demo krever betydelig redaksjonell innsats per kategori per prosjekt før den føles ferdig.

Tre samtidige smerter har bygget seg opp:

1. **Editorial-skalering** — per-kategori-tekst krever kurering som ikke skalerer til mange prosjekter samtidig (Propr-pilot: 1700 listinger/år som siktemål).
2. **Kvalitetsbar paralyserer** — dagens detaljnivå setter en bar der demos føles evig WIP. Kvaliteten på kategori-detalj-cards er ikke binær — det er alltid noe som kunne vært bedre, og det blokkerer ferdigfølelsen.
3. **Bruker-overload + audio-mismatch** — 47 POI-er + lange kategori-tekster + disclosure er for mye for en kjøper som vil ha en områdefølelse på 2 minutter. Audio-tour-pilot avdekket at megler-pitch-modaliteten *flyter ikke* med dagens detalj-tunge UI — det er to ulike modaliteter som konkurrerer om plass.

Parallelt har en Gemini-eksperiment vist at en *generisk megler-pitch-tekst* (~60-80 ord per kategori i "for deg som"-narrativ) står helt på egne ben uten å trenge POI-cards som krykke. Eksempel (Stasjonskvartalet):

> *"I Stasjonskvartalet blir hverdagen effektiv og fylt med puls. Du får et nytt bydelssenter med en stor, moderne dagligvarebutikk i samme bygg, slik at du kan handle i tøfler om du vil..."*

Sammenstilt motiverer dette en arkitektonisk re-tenkning av boardet: la **kart-pins bære mangfoldet**, **generisk pitch-tekst bære emosjonen**, og **audio bære den sammenhengende fortellingen**. POI-detaljnivå blir sekundær, nådd primært via markør-klikk — ikke inline alongside kategoritekst.

## Konsept i ett blikk

Rapport-boardet bytter fra **kategori-paginering med detalj-rik tekst + 47 POIer + audio-tour på toppen** til **én helhetlig scroll med slank pitch-tekst per kategori-seksjon, scroll-drevet kart-pin-veksling, og audio som modus-toggle mellom manuell og auto-scroll fortelling**. POI-detaljer løsrives til et overlay som nås via markør-klikk.

Visuelt henter konseptet inspirasjon fra megler-pitchen på fysisk visning: én sammenhengende fortelling fra inngangsdøren ut i området, med kart som peker når narrativet skifter tema.

### Konsept-modus: med audio vs uten audio

Refactoret må stå på egne ben i to varianter, fordi `audioTourEnabled` er per-prosjekt-flag (default `false`):

- **Minimum-viable (audio off)** — én scroll-rute med Gemini-pitch-tekst per kategori, scroll-drevet kart-pin-veksling, POI-overlay via markør-klikk. Audio-CTA og player-banner er skjult. Denne varianten må alene være en bedre opplevelse enn dagens detalj-tunge versjon — pitch-tekst + pins + overlay må føles komplett uten lydlaget.
- **Media-rich (audio on)** — minimum-viable + sekvensiell audio + autoscroll + player-banner. Audio er et opt-in lag som forsterker, ikke fundamentet konseptet hviler på.

De tre underliggende ambisjonene løses av distinkte mekanismer og evalueres hver for seg:

| Ambisjon | Mekanisme som faktisk løser det |
|----------|--------------------------------|
| Editorial-skalering | Pitch-tekst-pipeline (R15-R17) |
| UI-renhet | POI-overlay-pattern + fjerning av disclosure/Punkter-tab (R11-R14) |
| Audio-som-modus | Audio-tour modus-toggle (R6-R10b) |
| Tekst↔voice-koherens | Karaoke + cinematic sidebar (R18-R19b) |

## Requirements

**Board-struktur**
- R1. Boardet rendres som ett kontinuerlig scrollbart element (én scroll-container, ikke fan-paginering eller separate kategori-skjermer).
- R2. Hjem-seksjonen kommer først i scrollen og inneholder *både* dagens bolig-hero (illustrasjon, prosjektnavn, konseptlinje) *og* en områdens elevator-pitch (~70 norske ord, Gemini-style varm narrativ-tone) som setter rammen for resten av seksjonene.
- R3. Hver kategori-seksjon består av: kategori-tittel, kategori-illustrasjon (eksisterende), én generisk pitch-tekst (~60-90 norske ord, ingen lead/body-deling), og (når `audioTourEnabled === true` og kategorien har audio-spor) play-knapp for kategori-audio. Ingen "Les mer"-disclosure. Ingen Beligenhet/Punkter-toggle. I non-audio-modus fylles play-knapp-plassen av tekst-blokken — ingen ghost-knapp eller layout-skift. Pitch-teksten rendres med token-grenser (`<span>` per ord) for å støtte karaoke-effekten i R18.
- R4. Sidebar-rail med kategori-ikoner beholdes som scroll-navigasjon (klikk på ikon = scroll til seksjon). Den fungerer som visuell oversikt over hvor du er, ikke som en pagineringsmekanisme.
- R5. **En ny scroll-tracking-mekanikk bygges for board-laget** basert på IntersectionObserver-mønsteret i `lib/hooks/useActiveSection.ts` (artikkel-laget). Den dispatcher `SELECT_CATEGORY` til BoardContext når en kategori-seksjon kommer i view, og må kunne skille programmatisk autoscroll fra bruker-scroll for å støtte audio-resync-logikken i R10. Dagens kategori-paginerings-tracking i board-laget fjernes — den eksisterende scroll-tracking finnes kun i artikkel-laget og kan ikke gjenbrukes som-er.
- R5b. Hjem-seksjonen er ikke en kategori og har ingen POI-er. Når Hjem er aktiv scroll-seksjon, viser kartet kun prosjektets pin zoomet til nabolagsnivå — alle kategori-pins er skjult. Først ved scroll til første kategori-seksjon kommer kategori-pins inn.

**Audio-tour som modus-toggle**
- R6. En play-knapp i toppen av boardet ("Start tour") starter hele megler-pitchen sekvensielt (Hjem → kategoriene i fast rekkefølge), med autoscroll som driver scroll-posisjonen synkront med audio-spor-bytte.
- R6b. **Autoscroll = snap-per-track.** Ved audio-spor-bytte glir scroll til seksjons-toppen av den nye kategorien (én scroll-snap per kategori, ikke kontinuerlig scroll over track-varigheten). Innenfor et track scrolles ikke automatisk. Resume-snap etter brukers scroll-overtagelse henter scroll til toppen av nåværende track-kategori.
- R7. Hver kategori-seksjon har sin egen play-knapp i topp av seksjonen som fungerer som *"start tour herfra"*. Audio spiller fra det sporet og fortsetter sekvensielt til resten av tour'en (samme atferd som R6, bare med ny startposisjon).
- R7b. **Mid-tour atferd:** Klikk på *annen* kategoris play-knapp mens audio spiller hopper umiddelbart til det sporet (ikke "venter på at nåværende spor blir ferdig"). Klikk på *nåværende* kategoris play-knapp er ekvivalent med pause-kontrollen i player-banner. Klikk på en kategori-knapp som ikke har audio gjør ingenting — knappen rendres ikke i utgangspunktet.
- R8. Play-knappen er konseptuelt en **modus-toggle**: audio AV = manuell scroll-modus (bruker styrer selv, ingen audio), audio PÅ = autoscroll + voiceover tar over. Pause/lukk-tour i player-banner returnerer til manuell modus.
- R9. Player-banner (eksisterende design) viser status under avspilling: track-teller (4/8), kategori-navn, segmentert progressbar, pause/forrige/neste-knapper, lukk-tour-knapp. Plassert konsistent på tvers av hele scrollen.
- R10. Bruker-scroll under autoscroll pauser autoscroll men *ikke audio*. Bruker overtar scroll-kontroll mens lyden fortsetter. **I split-brain-tilstanden (autoscroll pauset, audio spiller) er audio source-of-truth for kart-pin-state og sidebar-highlight** — disse følger audio-spor-bytter, ikke scroll-posisjon. En "Tilbake til lyden"-pill over player-banner blir synlig og snapper scroll til audio-posisjonen ved klikk.
- R10b. **End-of-tour:** Når siste spor avsluttes auto-dismisses player-banner. Siste kategori-seksjon viser en alltid-rendret CTA-blokk ("Ta kontakt med megler" + "Spill av igjen"). Ingen separat avslutnings-skjerm. CTA-blokken vises også i manuell modus (når audioTour er av) som naturlig seksjons-slutt — den er ikke audio-betinget.

**POI-overlay**
- R11. POI-er nås primært ved klikk på markør på kartet. På desktop dekker overlay venstre sidebar. På mobil bruker det eksisterende `BoardMobileSheet` via en ny `phase=poi`-state (ikke som stacked Vaul-drawer) med snap til halv-høyde som default (hero fullt synlig, liste delvis synlig).
- R12. Overlay-innholdet består av: den klikkede POI-en i toppen (hero-bilde, navn, editorialHook + body-tekst), så en scrollbar liste over alle andre POI-er i samme kategori (kun navn + sekundær linje).
- R12b. **Overlay-states som må håndteres eksplisitt:**
  - *Single-POI category* — skjul "andre i kategorien"-listen og vis "Eneste sted i denne kategorien".
  - *POI uten hero-bilde* — fall back til kategori-illustrasjonen.
  - *Fetch-error* — vis inline feilmelding inni overlay-rammen, ikke som modal. Overlay-chrome forblir synlig.
- R13. Klikk på et listeelement i overlay-et bytter fokus til den POI-en (samme overlay-flate, ny topp-POI). Lukker overlay = klikk-utenfor eller eksplisitt close-knapp.
- R13b. **Desktop-dismiss-regler:** Klikk på kart-bakgrunn (utenfor en markør) lukker overlay. Klikk på en *annen* markør bytter overlay-fokus til den POI-en uten å lukke-så-åpne. Close-knapp er garantert dismiss-vei. På mobil: drag ned fra handle, klikk på kart-bakgrunn, eller close-knapp.
- R14. Ingen inline "Punkter (47)"-tab i kategori-seksjonen. Overlay er eneste vei til POI-detalj.

**Innhold-pipeline**
- R15. Kategori-pitch-tekstene (~60-90 ord) genereres build-time via et nytt eller utvidet LLM-steg som tar imot eksisterende grounding (lead + body + Gemini-grounding) per kategori og produserer en pitch-stil narrativ. Et nytt `pitchText`-felt introduseres additivt på `BoardCategory`.
- R15b. **Eksisterende `BoardCategory.lead`/`body` beholdes som data-felt** under bygg (input til pitch-generering) og forblir i datamodellen som inert data. De rendres ikke i UI, men slettes ikke før pilot-validering bekrefter at pitch-only fungerer for ekstern bruker (jf. KD7). Lav-kostnad-rollback hvis slank-tekst-premissen ikke holder.
- R16. Hjem-elevator-pitchen (~70 ord) genereres tilsvarende, basert på områdens overordnede grounding + bolig-konsept. Lagres på `reportConfig.heroIntro` eller tilsvarende eksisterende felt — verifiseres mot dagens `reportConfig`-shape i plan-fasen.
- R17. **Én canonical tekst per kategori for visuell og auditiv levering.** Pitch-teksten som vises i sidebar er den samme teksten voice-over leser — ikke to renderinger. Stedsnavn beholdes i canonical-teksten for lokal forankring og SEO-verdi. **TTS-uttale av problemord** (kajakk, Nidelva, Bakklandet) er parkert som senere arbeid — jf. PROJECT-LOG 2026-05-20-entry. I pilot aksepteres Erik @ turbo_v2_5-uttale som "godt nok"; fonetisk-transform-pipeline eller PVC implementeres når audio-kvaliteten skal heves systematisk på tvers av prosjekter.

**Karaoke-effekt og sidebar-fokus**
- R18. **Karaoke ord-for-ord, kun i auto-modus.** Når voice-over spiller, lyser hvert ord opp i takt med uttalen (opacity 40% → 100%, 200ms ease-out per ord). I manual-modus rendres tekst i full opacity uten progress-effekt — scroll-basert estimering brukes ikke. Begrunnelse: scroll-basert karaoke ville være kunstig fordi øyet ikke leser linært; effektens verdi ligger i å vise hvor voice-over ER, ikke hvor brukeren tror han er.
- R18b. **TTS-pipeline må bygge timing-data.** ElevenLabs `/v1/text-to-speech/{voice}/with-timestamps`-endpoint erstatter dagens flat-mp3-endpoint i `lib/audio-tour/elevenlabs-client.ts`. Character-level timing lagres per spor (nytt felt på audio-objekt, f.eks. `audio.timings: Array<{ character, start_ms, end_ms }>`) og brukes til token-mapping i front-end. Edge-cases (pause, scrub, hopp til neste spor) håndteres i plan-fase.
- R19. **Cinematic sidebar-active-state, alltid på.** Inaktive kategorier: opacity 30%. Aktiv kategori: opacity 100%, scale 1.15, glow (kategori-farge, blur 20px, opacity 40%), rail-bg fader fra `bg-stone-100` mot transparent. Transition 400ms ease-out med slight bounce på scale. Effekten er alltid aktiv — i manual-modus drevet av scroll (`state.activeCategoryId` fra IntersectionObserver i R5), i auto-modus drevet av audio (`tourTrack` fra audio-tour-state). Samme visuelle uttrykk, ulik state-kilde.
- R19b. **Aktiv-state-kilde-prioritet:** I split-brain-tilstanden (autoscroll pauset, audio spiller, bruker scroller) følger sidebar audio-staten (per eksisterende R10) — ikke scroll-staten. "Tilbake til lyden"-pillen er fortsatt mekanismen for å snappe scroll til audio-posisjonen.

## Success Criteria

Konseptet er validert når disse er sanne for StasjonsKvartalet-rapporten:

- Boardet renderes i én scroll uten kategori-paginering eller "Les mer"-disclosures.
- Per-kategori-pitch er ≤90 ord og leses i én pust (ingen "se mer", ingen `Punkter (X)`-tab inline).
- Klikk på markør åpner POI-overlay med klikket POI på topp + kategori-liste under. Klikk-utenfor lukker; klikk på annen markør bytter fokus.
- Top-play starter audio + autoscroll; kategori-play starter audio fra den seksjonen og glir videre.
- Bruker-scroll under autoscroll pauser autoscroll, audio fortsetter; "Tilbake til lyden"-pill returnerer scroll til audio-posisjonen.
- Minimum-viable (audio off) er en bedre opplevelse enn dagens versjon — bekreftet i kort intern-demo der `audioTourEnabled = false` på et test-prosjekt.
- **Ekstern validering før irreversibel sletting:** Minst én ekstern stemme (megler-kontakt fra Propr eller representativ pilot-kjøper) bekrefter at slank-pitch + pins + overlay føles komplett, før POI-card-arkitekturen (lead/body, BoardCategoryInfoTab, BoardPOIAccordion) slettes fra datamodell og kode.
- **"Føles ferdig" objektivt:** pitch-tekst er ≤90 ord, ingen åpenbare faktafeil, én lese-gjennom uten åpenbar feilbarhet → ship. Ingen polering-runder uten ekstern feedback-signal som trigger.
- Et nytt eiendomsprosjekt kan i prinsippet bygges fra grounding alene uten redaksjonell touch (null-touch-default). 1-2 timer redaksjonell innsats reserveres premium-listinger eller spesialtilfeller — det er ikke skalerings-modusen (jf. KD6).
- Audio-tour-opplevelsen kjennes naturlig integrert (ikke en player som flyter over en uvant kategorisert layout).
- **Karaoke-effekten i auto-modus** synker visuelt med voice-over på ord-nivå (drift ≤200ms per ord på StasjonsKvartalet-spor), opprettholdes ved scrub/pause, og fryses på 100% når et spor avsluttes.
- **Cinematic sidebar-active-state** er tydelig nok til at brukeren ser hvilken kategori som er aktiv uten å lese label-tekst, men ikke så dominant at den konkurrerer med innholds-området. Vurderes ok når intern-demo bekrefter "blikket trekkes mot riktig sted uten å bli forstyrret".

## Scope Boundaries

- **Kun rapport-board (eiendom).** Explorer, Guide, Hotel/Næring/Adresse-produkter forblir uendret. Konseptet kan inspirere senere produkt-akser, men vi designer ikke shared system her — eiendom-board får sin egen variant.
- **Norsk-only i pilot.** Engelsk audio + tekst kan komme senere.
- **Ingen ny content-form for Hjem-bolig-info.** Bolig-hero + område-pitch lever sammen i Hjem-seksjonen. Tonalt forhold mellom de to (begge er emosjonelle) tas i layout/copywriting i plan-fasen.
- **Ingen runtime LLM eller TTS** (per CLAUDE.md). All pitch-tekst og audio genereres build-time.
- **Ingen admin-UI for å redigere pitch-tekst eller styre seksjoner.** Pitch-tekst er read-only output fra build. Editorial-overstyring kan gjøres direkte i prosjekt-konfigurasjon hvis nødvendig.
- **Beligenhet/Punkter-toggle og "Les mer"-disclosure fjernes fra UI** — men data-laget krever konkret cleanup-arbeid: `useSubCategoryFilter`-state på `BoardContext` slettes (eller beholdes kun for kart-pin-filtrering, plan-fasen avgjør); tilhørende komponenter (`BoardPOIAccordion`, `BoardCategoryInfoTab`, `SubCategoryFilter`, `BoardTabs`, `BoardPunkterAccordion`) slettes som del av samme cleanup-enhet. Dette er konkret arbeid, ikke en passiv konsekvens.
- **lead/body forblir i datamodell inntil pilot-validering** (R15b/KD7). Feltene beholdes som additiv inert data, ikke som UI-fall-back. De rendres ikke. Slett først når ekstern stemme bekrefter pitch-only-arkitekturen.
- **POI-overlay er KUN klikk-fra-markør-drevet i pilot.** Ingen "Se alle 47"-knapp i kategori-seksjon, ingen master-POI-liste. Hvis behovet senere viser seg, kan en sekundær CTA legges til.
- **Ingen URL-state for scroll-posisjon eller åpen POI** i pilot. Refresh tar deg til toppen.
- **Audio-tour-feature-flag (`audioTourEnabled`) blir respektert.** Prosjekter uten audio-aktivering får manuell scroll-modus only; play-knappene rendres ikke. Konseptet må fungere bra i denne modus alene (jf. Konsept-modus-tabellen).

## Key Decisions

**KD1: Helhetlig scroll, ikke kategori-paginering.**
Per-kategori-skjermer skapte i dag opplevelse av "isolerte info-pakker" som krevde individuell kvalitetsbar. Sammenhengende scroll lar narrativet bære helheten. Scroll-tracking-mekanikken bygges *nytt* i board-laget basert på `useActiveSection`-mønsteret som allerede finnes i artikkel-laget — den finnes ikke i board i dag. Den koples mot `SELECT_CATEGORY`-dispatcher for å holde sync med kart og audio-tour-state.

**KD2: Slank generisk tekst > rik kuratert tekst.**
Gemini-eksperimentet viste at en pitch-stil narrativ-tekst (60-90 ord) føles *komplett* selv uten POI-detaljer i samme view — for én forfatter på ett prosjekt. Premissen er ikke ekstern-validert ennå. KD7 håndterer denne risikoen ved å kreve ekstern stemme før irreversibel sletting, og R15b/scope-boundary beholder lead/body som inert data for rollback.

**KD3: Play-knapp som modus-toggle, ikke kategori-velger.**
Per-kategori-play er konseptuelt "start tour herfra", ikke "spill bare denne kategorien". Det gir én mental modell (manuell vs auto-narrativ) og enklere bruker-mental-modell enn en kompleks per-spor-kontroll.

**KD4: POI-overlay over inline POI-cards.**
Inline POI-detaljer (Punkter-toggle, Les mer-disclosure) tilfører støy i en narrativ flyt. Markør-klikk er den mest direkte intent-signalen for "jeg vil vite mer om akkurat dette stedet". Overlay-pattern holder kategori-seksjonen ren.

**KD5: Én canonical tekst per kategori — TTS-uttale parkert som senere arbeid.**
*Tidligere versjon: "to renderinger fra én kilde". Skjerpet 2026-05-20 til én tekst.*
Tekst i sidebar = tekst voice-over leser. Stedsnavn beholdes for lokal forankring og SEO-verdi. TTS-uttale av problemord (kajakk, Nidelva, Bakklandet) tas i en senere fase via fonetisk-transform-pipeline eller PVC (jf. PROJECT-LOG 2026-05-20). I pilot aksepteres dagens Erik @ turbo_v2_5-uttale som "godt nok"; opplevelses-koherens (én tekst, karaoke-synk) prioriteres over uttale-perfeksjon. Konsekvens: editorial drift mellom synlig tekst og audio-manus elimineres som mulighet — det er én tekst.

**KD6: 1-2 timer/prosjekt er edit-target, ikke skalerings-target.**
1700 listinger/år × 1-2 timer = 1-2 årsverk redaktør-arbeid — ikke nok for Propr-skala. 1-2 timer reserveres for premium-listinger eller spesialtilfeller som krever menneskelig touch. Default må være null-touch-bygg fra grounding alene; redaksjonell innsats er opt-in, ikke standard. Skalerings-modus og edit-modus valideres separat.

**KD7: Ingen irreversibel sletting før ekstern validering.**
Slank-tekst-premissen (KD2) er bekreftet av ett Gemini-eksempel og forfatterens egen vurdering. Før POI-card-arkitekturen slettes irreversibelt (datamodell, komponenter, generator-pipeline) må minst én ekstern stemme (megler-kontakt fra Propr eller representativ kjøper) bekrefte at slank-pitch + pins + overlay føles komplett. lead/body beholdes som inert data inntil dette er gjort, for lav-kostnad rollback.

**KD8: Audio er en av tre uavhengige ambisjoner, ikke fundamentet.**
Refactoret bundler editorial-skalering, UI-renhet, og audio-som-modus. Disse løses av distinkte mekanismer (pitch-pipeline, overlay, audio-tour) og må evalueres hver for seg. Konsept-modus-tabellen (audio off vs on) i Konsept-i-ett-blikk er kontrakten for at dette holdes ortogonalt — om audio-piloten skulle reverseres, må kjernen fortsatt stå.

**KD9: Karaoke ord-for-ord, kun i auto-modus.**
*Lagt til 2026-05-20.*
Karaoke-effekten visualiserer hvor voice-over ER i teksten — den er en *audio-forankret* effekt, ikke en generell lese-hjelp. I manual-modus er det ingen audio-forankring, og scroll-progress er en dårlig proxy fordi leseøyet hopper rundt i tekst, ikke beveger seg linært. Konsekvens: pipeline må bytte til `/with-timestamps`-endpoint og lagre character-level timing per spor. Token-mapping fra timing-array til DOM-spans skjer client-side på avspillingstidspunkt.

**KD10: Cinematic sidebar-active-state, alltid på.**
*Lagt til 2026-05-20. Lukker Open Question #2 fra opprinnelig brainstorm.*
Sidebar-rail-en er oppgradert fra "navigasjons-affordance" til "aktivt fokus-element". Inaktive kategorier opacity 30%, aktiv opacity 100% + scale 1.15 + glow + rail-bg fader. Effekten kjøres i begge moduser (scroll-driven i manual, audio-driven i auto) for å bevare visuell koherens. Argumentet for "kun i auto" ble forkastet fordi manual-modus uten cinematic ville degenerere sidebar til en flat lab-strip uten visuell forankring — selv om brukeren leser i sitt eget tempo, er det fortsatt verdi i å se hvilken kategori-seksjon han er i.

## Open Questions

**Tekstgenererings-prosess.** Skal pitch-tekstene genereres som en del av eksisterende `/generate-bolig`-pipeline (nytt steg som tar grounding inn), eller som en Claude Code-skill (slik audio-manus genereres i dag)? Den siste er mer fleksibel for iteration, første er mer reproduserbar. KD5 og KD6 lener mot pipeline-steg (reproduserbarhet for null-touch-bygg), men dette må bekreftes i plan-fasen.

**~~Sidebar-highlight under autoscroll.~~** *Lukket 2026-05-20 av KD10 + R19: cinematic active-state med opacity 30/100, scale 1.15, glow og rail-bg-fade. Alltid på i begge moduser.*

**Karaoke edge-cases.** R18b nevner timing-data og token-mapping. Plan-fase må håndtere: (a) bruker scrubber i player → karaoke-state må re-syncs til ny timestamp, (b) pause midt i ord → siste-spilte-ord forblir 100% opacity, neste går til 0%, (c) modus-bytte mid-track → karaoke-state nullstilles, (d) hopp til neste spor → forrige spors karaoke-state ryddes (kanskje med en fade-out på alle ord-spans).

**Karaoke ved track-overgang.** Når voice-over glir fra ett spor til neste (autoscroll i R6b snapper scroll til ny seksjon): skal karaoke i forrige seksjon "fryses" på 100% opacity for alle ord, eller fade tilbake til base-opacity? Visuell detalj, plan-fase. Forslag: behold 100% for forrige (signaliserer "fullført"), start ny på 40%.

**TTS-uttale-problemet henger.** KD5 parkerer dette som senere arbeid. Trigger for å re-åpne: (a) ekstern bruker melder uttale som distraherende, (b) vi tar PVC-investering i kommersiell pilot, (c) ElevenLabs lanserer pronunciation-support på turbo_v2_5. PROJECT-LOG 2026-05-20-entry holder TODO-listen.

**Ekstern validerings-kanal.** Hvilken konkret megler-kontakt eller pilot-kjøper skal validere KD7-kriteriet? Kjetil/Karoline (Propr) er åpenbar kandidat — men når i Propr-pilot-flyten tas dette opp? Strategi-spørsmål, ikke teknisk.

**Avhengighet til 2026-05-16-megler-pitch-brainstorm.** Mye av audio-mekanikken (player-banner, track-skifte, iOS Safari autoplay-handling) er allerede beskrevet der. Denne brainstormen bygger PÅ den, ikke som erstatning. Plan-fasen må eksplisitt referere til R3 (iOS audio-unlock), R11 (TTS-pipeline), og audio-tour-state-store fra den brainstormen.
