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
