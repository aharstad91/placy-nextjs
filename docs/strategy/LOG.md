# Strategi-loggbok

> Kronologisk loggbok over strategiske beslutninger, sporvalg, og forretningsmodell-endringer.
> Speiler `PROJECT-LOG.md`-mønsteret, men holder strategiske beslutninger separat fra tekniske/operasjonelle.
> Oppdateres etter strategi-sesjoner, salgs-/kunde-møter, sporvalg, prising-endringer, eller når en strategisk hypotese valideres/falsifiseres.
> Aldri slett — bare legg til. Beslutninger som superseders, markeres med peker til ny dato.

**Format per entry:**
- `## YYYY-MM-DD — <kort tittel>`
- **Beslutning:** Hva ble landet (1-3 setninger)
- **Begrunnelse:** Hvorfor (1-2 setninger)
- **Detaljer:** Lenke til strategi-dokument hvis det finnes
- **Status:** Aktiv / Supersedert <dato> / Validert / Falsifisert

---

## 2026-06-02 — Marketer/HomeKey kartlagt som konkurrent/benchmark

**Beslutning:** Marketer Real Estate Technologies (Oslo, 2016, ~68 ansatte, ~$26,9M reist, ~32 % NO-markedsandel nybygg, rebrander til HomeKey.ai / M360-plattform) kartlagt som proptech-aktøren bak Stasjonskvartalets boligvelger + 3D-flythrough-intro. Posisjonering landet: **ikke konkurrér på transaksjonslaget** (boligvelger/annonser/CRM — de har skala + kapital), **konkurrér/komplementér på kontekstlaget** (lokasjons-/nabolagsintelligens via Report) der de er tynne. Marketer er potensiell distribusjons-partner (Placy som innholdslag inni deres boligvelger) ELLER fremtidig konkurrent hvis de utvider inn i område-innhold.

**Begrunnelse:** Stasjonskvartalet (klient vi jobber med) har kjøpt en Marketer-leveranse — synlig på `stasjonskvartalet.no/boligvelger`. Flythrough-videoen deres (3D-bymodell + prosjektets arkitekt-modell plassert inn + waypoint-kamera) er nettopp det rapport-boardet vårt gjør *live* på ekte Google-fotogrammetri. Det gir både en teknisk benchmark og et klart bilde av hvor Placy IKKE bør slåss head-on. Antatt prising: flythrough alene ~20–60k NOK, full kampanje 6–7-sifret — vs. Placys ~120 kr for hele image-to-video-showcasen (unit-economics-argument).

**Detaljer:** `docs/strategy/2026-06-02-marketer-homekey-konkurrent.md` — full profil, leveranse-teknikk, pris-estimat, differensiering (transaksjonslag vs kontekstlag), partner-vs-konkurrent.

**Status:** Aktiv — konkurrent-intel, ikke kontakt. Åpent: bekreft Stasjonskvartalets utbygger + DNBs rolle; vurder partner-tilnærming til Marketer/HomeKey.

---

## 2026-06-02 — Megler-stemme-kloning som personaliserings- og avtale-spak

**Beslutning:** ElevenLabs voice cloning anerkjennes som fremtidig grep med to dokumenterte bruk: (a) **per-megler personalisering** — gjenskap meglerens egen stemme så Rapport/Reels/audio-tour høres ut som *deres* megler, tilbudt som premium-oppgradering; (b) **dialekt-stemme som kjede-avtale-spak** — en lokal dialekt-husstemme (f.eks. trønder) som komponent i en meglerkjede-avtale. Default forblir nøytral husstemme ("Erik"); kloning er oppside-akse, ikke MVP-krav. Endrer ikke prioriteringen i 2026-05-06-beslutningen.

**Begrunnelse:** Teknisk nesten gratis å innføre — pipelinen tar allerede `voiceId` som parameter, så en klone er en konfig-akse, ikke en ombygging. Personlig megler-stemme er differensiator mot statiske områdesider i boligkjøper-segmentet; lokal dialekt-stemme er et eksklusivt, lavmarginalkost-salgsargument *til* en kjede og autentisitet *til* deres kunder. To veier i ElevenLabs: IVC (1–2 min opptak, few-shot) for spike/demo, PVC (30 min–3 t, fine-tuner) for produkt.

**Avlastet:** Ikke et aktivt spor — hotell-prioritet står. Per-megler-onboarding (opptaks-/klone-rutine) og self-serve er separate utviklings-fasespørsmål, ikke MVP. Samtykke-/opphørs-flyt for navngitt stemme er uløst og blokkerer ekstern pilot. Emosjonell respons (tillitsbyggende vs. creepy) er udokumentert og må valideres.

**Detaljer:** `docs/strategy/2026-06-02-megler-stemme-kloning-spor.md` — IVC vs PVC-sammenligning, de to grepene utdypet, samtykke/jus/opphør, risici, neste steg.

**Status:** Hypotese — ikke validert. Neste konkrete trinn: IVC-spike (én megler, ~2 min opptak, swap `voiceId` i ett Reels-spor, lytt) før PVC-investering.

---

## 2026-05-24 — Placy Reels lansert som tverr-sporvalg-asset

**Beslutning:** SOME-video-konseptet brainstormet med Markus får navnet **Placy Reels** og defineres som funnel-asset for ALLE Placy-produkter (Explorer/Guide/Report), ikke et separat produkt. Tech-spike validert (Veo 3.0 fast + ElevenLabs Erik + ffmpeg single-pass) med Stasjonskvartalet-pilot, per-video variabel kost ~$1-3. Reels bakes inn i eksisterende pilot-pakker som tilleggs-verdi (hotell-pilot 1490/mnd får Explorer + Reels, ikke prising-separasjon i fase 1). Pipelinen designes cross-vertical fra dag 1 (bolig + hotell + event + cruise + DMO) selv om aktive spor per LOG.md-beslutning 2026-05-06 forblir uendret (hotell først, cruise til fase 3).

**Begrunnelse:** Reels er strategisk hevarm med liten downside: gratis komposisjons-lag (ffmpeg), nesten-gratis variabel kost, men forsterker salgsargumentet i hvert eksisterende spor med en konkret SOME-distribuerbar asset som målgrupper faktisk ser. Hotell-spor: pre-arrival excitement vs. lobby-QR. Event-spor: ferdig markedsføringsverktøy til arrangør, ikke bare Placy-link. Megler-spor: SOME-funnel inn til Rapport. Cross-vertical-design fra start unngår teknisk gjeld når cruise/DMO-faser åpner. Markus' "voice over er gull på mobile flater" + tech-spike-resultat ("haha dette er veldig bra!") gir produkt-konfidens.

**Avlastet:** Reels endrer ikke prioriteringen i 2026-05-06-beslutningen. Det erstatter ikke profesjonelle visningsvideoer for premium-prosjekter. Det krever ikke separat GTM i fase 1. Self-serve-UI for meglere (Propr-skalering) er separat utviklings-faseproblem, ikke MVP. End-card-design er kjent gap som må lukkes før ekstern demo. Varemerke-verifikasjon av "Reels" mot Meta er åpent punkt med plan B-navn (Placy Stories/Teaser/Snippets).

**Detaljer:**
- `docs/brainstorms/2026-05-24-placy-reels-brainstorm.md` — produkt-konseptet (navn, formål, målgrupper, MVP, tech-pipeline, åpne spørsmål)
- `docs/strategy/2026-05-24-placy-reels-cross-vertical.md` — strategisk plassering (hvordan Reels forsterker hvert eksisterende spor, prising-bake-inn, cruise-design-from-day-1)
- `PROJECT-LOG.md` 2026-05-24 — tech-spike-verifikasjon

**Status:** Aktiv — neste konkrete trinn er (1) SOME-best-practice-research for short-form lokasjons-marketing, (2) alternativ manus-versjon for Stasjonskvartalet (A/B-grunnlag), (3) polert end-card-design før kunde-demo, (4) demo i pågående megler-samtaler + bake inn i hotell-pilot-pitch når VT-intro materialiserer.

---

## 2026-05-08 — Fellesmail sendt til Kulturnatt/Midtbyen Mgmt/VT-trio

**Beslutning:** Fellesmail sendt til Nanna Berntsen (Kulturnatt), Sissel Piene (Midtbyen Management) og Kari Aarnes (Visit Trondheim) som oppfølging fra introduksjonsmøtet 2026-05-06. Subject: *"Takk for møtet — her er Kulturnatt-prototypen"*. Innhold: takk + kort oppsummering av møtepunkter (TRD Events som levende feed, multi-nettsted-arkitektur, næring på midtbyen.no) + Kulturnatt-prototype-URL + flag-løfte om dedikert mail til Kari. Myk CTA (*"tar gjerne en runde to når dere har snakket internt"*). Bevisst ingen pris/pitch — strukturert som hold-varm.

**Begrunnelse:** Sissel ba i møtet eksplisitt om at Andreas sender oppfølgings-info til Sissel + Kari (talegjenkjent som "Cicero og Karesan", korrigert 2026-05-08). Mailen leverer på den asken og holder Nanna varm mens hun er i intern prat. Bevisst ingen ide-liste eller produktforslag — det ville flyttet mailen fra hold-varm til pitch og presset mottakerne til å reagere på Andreas' agenda istedenfor å lande egen prioritering.

**Detaljer:** `docs/strategy/2026-05-06-events-spor-trondheim.md` — sesjons-dokument fra møtet, inneholder versjon C-formulering og topp 3 hotell-prospects. `aktor-map.md` oppdatert med send-status for alle tre mottakere.

**Status:** Aktiv — venter på respons. Neste konkrete trinn: dedikert versjon C-mail til Kari (hotell-pilot + felles møte med Susanne på Convention Bureau).

---

## 2026-05-06 (kveld 2) — Hotell-fokus først, performance pilot, cruise/Hurtigruten parkert

**Beslutning:** Hotell er primært gå-til-marked-spor for events/turist-pitchen. Topp 3 prospects: Britannia, Nidaros Pilegrimsgård, Scandic Nidelven. Visit Trondheim (Kari Aarnes) brukes som intro-mekanisme — versjon C-formulering: *"vi tilbyr 30-60 dagers gratis pilot for 2-3 Trondheim-hoteller før sommer-sesongen, måler engagement, leverer case study du kan bruke i medlemsrapport — hvilke hoteller har mest nytte? Kan du sende intro?"* Performance pilot-modell: 30 dagers gratis + promosjons-forpliktelse fra hotellet + pre-avtalt konverterings-terskel + tidsbegrenset eksklusivitet → 1 490/mnd × 12 mnd ved suksess. Cruise-spor (Hurtigruten Group + Havila Voyages som pilot-by-skalering) **parkert til fase 3** — etter hotell-pilot har levert case study.

**Begrunnelse:** Hoteller er stasjonære (forutsigbar salgssyklus, fast lobby for QR, samme markedssjef over tid), VT er medlemsorganisasjon for dem (lavt friksjon for varm intro), gjentatte gjester gir tidsserie-data vs. cruise som er punktdata. Eksisterende fundament: pricing finnes, Scandic-demo finnes, 17 hoteller listet i kundeprospekter. Cruise har større skalerings-potensiale (Hurtigruten 32 havner, Havila 14, pilot-by-modell elegant) men krever hotell-case study først for troverdighet, flerspråklig produkt (norsk + engelsk + tysk minimum), og lengre salgssyklus. Solo-Andreas kan ikke seriøst forfølge begge spor parallelt.

**Avlastet:** Karis QR-utsagn fra møtet ("alle hoteller, cruise, Værnes, flybuss bør ha QR-kode") dekomprimert til 30+ separate salg, ikke ett bredt prosjekt. VT er anbefalingspartner / trust-signal, ikke betalende kunde eller gateway. Avinor (Værnes) og AtB (flybuss) parkert pga. offentlig anskaffelse-treghet. Butikker via Midtbyen Management er sekundært (lav pris-tolleranse for individuelt salg).

**Detaljer:** `docs/strategy/2026-05-06-events-spor-trondheim.md` — oppdatert med diskusjons-seksjon "Sesjon 2026-05-06 kveld 2" som inneholder QR-distribusjons-analyse, pilot-by-modell-vurdering (parkert), performance pilot-struktur, og topp prospects med inngangsvinkler.

**Status:** Aktiv — neste konkrete trinn er VT-intro-mail til Kari + 1-siders pilot-pakke. Tre åpne underbeslutninger: (1) konverterings-terskel-modell (låste tall / subjektiv / hybrid), (2) parallell vs sekvensiell pitch til 3 hoteller, (3) pris-justering etter pilot-data (holde 1 490/mnd eller revurdere).

**Lukker tidligere åpne tema:** S1 (hvem blir første pilot) → hotell, S2 (VT som kunde vs partner) → partner/intro-mekanisme, S4 (cruise/turist-segment) → parkert til fase 3.

---

## 2026-05-06 (kveld) — Strategi-arbeid formalisert som eget spor (business-logg)

**Beslutning:** `docs/strategy/`-mappa opprettet for forretnings- og produktstrategi-dokumenter, separert fra `docs/brainstorms/` (tekniske feature-brainstorms) og `PROJECT-LOG.md` (worklog). Mappa inneholder:
- `LOG.md` — kronologisk strategi-loggbok som speiler `PROJECT-LOG.md`-mønsteret
- `aktor-map.md` — levende kontaktdatabase på tvers av spor (events, eiendom, hotell)
- `YYYY-MM-DD-<topic>-spor.md` — datert sesjons-dokument per stort strategisk møte/diskusjon
- `README.md` — beskriver mappa og konvensjon

CLAUDE.md oppdatert med:
- Tabell-rad for `docs/strategy/` som "business-logg" (parallell til "worklog" for `PROJECT-LOG.md`)
- Trigger-fraser: "sjekk strategien" / "sjekk business-loggen" → strategi-mappa, "sjekk loggen" / "sjekk worklogen" → PROJECT-LOG
- Implicit-trigger-regel: ved tema om strategi/kunder/prising/forretningsmodell skal `docs/strategy/` leses *før* råd gis
- Auto-prompt ved sesjon-slutt: ja/nei-spørsmål om loggføring både i business-logg og worklog

**Begrunnelse:** Strategi-beslutninger (sporvalg, kunder, prising, distribusjon) ble tidligere blandet inn i `PROJECT-LOG.md` eller fanget i feature-brainstorms (f.eks. Propr-piloten 2026-04-30 og pricing-grunnlaget 2026-02-01). Det gjorde kronologisk overblikk vanskelig og risikerte at fremtidige sesjoner gjentok eller motsa beslutninger som allerede var tatt. Andreas pekte selv på at "vi har worklog som loggfører det vi gjør — vi burde ha noe lignende for det mer strategiske".

**Detaljer:** `docs/strategy/README.md` (struktur og konvensjon), `docs/strategy/LOG.md` (denne filen), `docs/strategy/aktor-map.md` (kontaktdatabase), `CLAUDE.md` (trigger-fraser og auto-prompt-regel).

**Status:** Aktiv — første sesjon som tester konvensjonen er 2026-05-06 events-spor. Verifiseres ved bruk i kommende sesjoner; juster om noe friksjon dukker opp.

---

## 2026-05-06 — Events-spor åpnet parallelt med Propr-piloten

**Beslutning:** Event-spor (Kulturnatt Trondheim, Midtbyen Management, Visit Trondheim) kjøres parallelt med Propr-piloten på eiendomssporet. Ingen pivot — eksplisitt arbeidsdeling med begge spor i live.

**Begrunnelse:** Introduksjonsmøte 2026-05-06 ga sterkt event-momentum (Nanna Berntsen / Kulturnatt + Sissel Piene / MM + Kari Aarnes / VT). Propr-piloten er ferskt besluttet (6 dager) og ikke testet — for tidlig å pivotere. Events-momentum vil avta hvis ikke fulgt opp innen uker.

**Detaljer:** `docs/strategy/2026-05-06-events-spor-trondheim.md` — 5 hovedinnsikter, 18 åpne tema, people-map.

**Status:** Aktiv — krever konkret arbeidsdeling per uke (åpent tema S5/O2).

---

## 2026-04-30 — Propr som første distribusjonspartner (eiendomssporet)

**Beslutning:** Propr (selvbetjent boligsalg-plattform) er første distribusjonspartner for Placy rapport-board. Vis-don't-tell-åpning: Spro Havn-rapport genereres og sendes til Kjetil Eriksson (CEO) eller Karoline Gjersvik (driftssjef). Manuell pipeline i pilot-fasen — /bestill-skjema utsettes til ~10+ ukentlige bestillinger er reelt.

**Begrunnelse:** Propr har 16 990 listinger 2016-2026 (~1 700/år), svak "Nabolag"-seksjon, og ledelse med Sem & Johnsen-bakgrunn (warm-intro-bro til premium-segmentet). Markedsutvikler-sparring reframet eiendomsmeglere som distribusjonskanal, ikke sluttbruker.

**Detaljer:** `docs/brainstorms/2026-04-30-propr-distribusjons-pilot-brainstorm.md` — fire ikke-forhandlerbare avtalevilkår, suksess-kriterier (30/60/90 dager).

**Status:** Aktiv — Spro Havn-rapport ikke generert/sendt enda per 2026-05-06.

---

## 2026-02-01 — Forretningsmodell-grunnlag etablert (Explorer/Guide/Report)

**Beslutning:** Tre produkter med tre prismodeller:
- Explorer: 1 490 kr/mnd flat (per hotell/lokasjon)
- Guide (nå "Trip"): tier 990 / 1 990 / 3 999 kr/mnd
- Report: 25-35 000 kr per prosjekt
- Tablet: +599 kr/mnd tillegg

Volumtrapp på kjedeforhandling (-20% / -30% / -35% over 11 / 31 / 61 hoteller). Ingen markedseksklusivitet, kun innholdseksklusivitet som premium.

**Begrunnelse:** Markedsanalyse på ~1 200 hoteller / ~80 000 rom i Norge. Konkurranseanalyse mot Schibsted Partnerstudio (52 500+ kr/artikkel) gir Report-prising. Tier-modellen for Guide gir naturlig vekststige.

**Detaljer:** `docs/brainstorms/2026-02-01-placy-pricing-business-model-brainstorm.md` — fullstendig markedsmatrise, kjedeforhandlings-strategier, Report som leadgen.

**Status:** Aktiv som referansegrunnlag, men **ikke validert i marked** (pre-revenue per 2026-05-06). Event-prising og distribusjonsmodell mot VT-nettverket er åpne tema som ikke er dekket av denne modellen.

---

## Konvensjon for endringer

- **Ny strategisk beslutning**: Legg til ny `## YYYY-MM-DD — <tittel>`-blokk på toppen.
- **Beslutning superseders**: La gammel entry stå, men legg til linje under "Status:" → `Supersedert <dato> — se <ny entry>`.
- **Beslutning falsifiseres** (hypotese ikke holdt): Endre Status til `Falsifisert <dato>` med kort forklaring. Ikke slett.
- **Beslutning valideres** (hypotese bekreftet): Endre Status til `Validert <dato>`.
- **Detalj-lenker** skal være repo-relative (eks. `docs/strategy/...`), aldri absolutte.
