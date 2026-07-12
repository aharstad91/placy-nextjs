# Local Logic — benchmark for bolig-sporet (kommersiell struktur + score-kritikk)

**Dato:** 2026-07-09
**Type:** Konkurrent-/benchmark-analyse (eiendomssporet)
**Deltakere:** Andreas + Claude (+ 2 web-researchere)
**Status:** Aktiv — deep-dive levert. Score-primitivet forkastet som Placy-retning (låst, jf. `LOG.md` 2026-07-09). Kommersiell struktur = hovedlæringen.

> Andreas delte Realtor.com-listingens «Neighborhood & schools»-seksjon som «en løsning Placy kan ta inspo fra». Dette dokumentet er dypdykket på **den viktigste biten: hvordan Local Logic er kommersielt strukturert**, pluss ammunisjonen mot score-tilnærmingen (som vi forkaster). Kildebelagt av to parallelle web-researchere.

---

## TL;DR — de fem tingene som betyr noe for oss

1. **Local Logic er «vinn distribusjons-laget → fast inventar på hver listing», utført i praksis.** Men volum-motoren er **ikke** portalen — det er **MLS-/plattform-laget**: én integrasjon i et megler-system når titusenvis av meglere og alle portaler som syndikerer. Norsk parallell er ikke «selg til Finn» — det er **vinn ett megler-system (Vitec/Webmegler) eller én kjede-plattform (partners.no)**.
2. **Portal-tilgangens holdbarhet er strukturell, ikke bare kontraktuell.** NARs egen venture-arm (Second Century Ventures) eier aksjer i Local Logic, og NAR lisensierer Realtor.com-merket. Lærdom: durabel distribusjon kan kjøpes med *alignment-kapital*, ikke bare en leverandøravtale.
3. **Local Logic har ingen Moat 2.** Det er en *statisk scores-widget*. Ingen engasjements-løkke, ingen innsikt tilbake til megler, ingen ARR-mekanisme. Placys Innsikt er den rene differensiatoren.
4. **Scoren er både commodity OG regulatorisk sårbar.** Ingen publisert vekt/decay-funksjon, ingen konfidens, subjektivitet bortforklart som «preferanse». Sitter midt i US GAO-rapportens (des. 2025) «false cloak of neutrality»-risiko. Andreas' forkastelse er dermed korrekt på mer enn smak — den er *forsvarbar*.
5. **Europa/Norden er åpent farvann.** Kategori-lederen (US+Canada-only) har ikke tatt Norden.

---

## 1. Hva Local Logic er

Location-intelligence-selskap (Montreal, grunnlagt 2015). Leverer nærområde-**scores (0–10)** + demografi + kart, embedded i eiendoms-flater via JS-widgets/SDK-er, API-er og white-label PDF-rapporter. På Realtor.com utgjør de **scores-laget** i «Neighborhood & schools»-modulen — de eier *ikke* hele widgeten (se §4).

**Skjermbilde-fakta (primærkilde, 2026):** Realtor.com-modulen er et komposit — «Scores provided by **Local Logic**», «Locations provided by **Yelp**», «Ratings provided by **GreatSchools**», skolegrenser «provided by **Precisely**». Local Logic bidrar med ett lag; Move Inc./News Corp (Realtor.com) eier integrasjonen og limer sammen resten. Dette forklarer hvorfor Local Logics egne sider *ikke* nevner Yelp/GreatSchools/Precisely (researcher 2 fant dem ikke der) — de er Realtor.coms leverandørvalg, ikke Local Logics.

---

## 2. Kommersiell struktur — hovedlæringen

### 2.1 Eierskap + finansiering
- **Uavhengig, VC-finansiert.** Ingen oppkjøp funnet (bekreftet-ved-fravær, moderat konfidens).
- **~$26,65M CAD (~$20M USD) over 3 runder:** Seed $1,15M (2017, Cycle Capital) → Serie A $8M (2020) → **Serie B $17,5M CAD (juni 2023)**.
- **Serie B-investorer:** GroundBreak Ventures + Investissement Québec (co-leads), Band Capital (Triovest-affiliert), Cycle Capital, Desjardins, Jones Boys Ventures, **Second Century Ventures**, Shadow Ventures.
- Skala 2025 (egen «Year in Review»): **5,01 mrd API-kall**, 443M SDK-visninger, 100+ enterprise-kunder, data på 6 000–8 000+ eiendoms-nettsteder, 250M nordamerikanske adresser. ~60–71 ansatte.

### 2.2 Forretningsmodell
Data-as-a-service, B2B/B2B2C, tre leveranseflater:
- **Widgets/SDK-er** (NeighborhoodMap, NeighborhoodSchools, NeighborhoodCharacteristics, NeighborhoodMatch) — embeddes i listing-maler.
- **API-er** (Local Content, Local Demographics, Local Maps).
- **White-label PDF-rapporter** (NeighborhoodIntel).

**Pris:** self-serve/small-site ~**$100/mnd per nettsted** (kun via tredjeparts-aggregatorer — G2/Capterra; Local Logics egen pris-side var blokkert, så lav-moderat konfidens). Enterprise = rabattert per sete/volum, 1–3 års binding. **Ingen kilde oppgir Realtor.com-avtalens verdi eller struktur — reelt informasjonshull.** Ingen PR oppgir betalings-retning, men bredden av motparter tilsier at MLS/portal/megler/långiver betaler Local Logic for feeden.

### 2.3 GTM — 5-lags barbell (dette er lærdommen)
Ikke én wedge — et lagdelt distribusjons-apparat:

1. **Anker-portaler** (Realtor.com, Realtor.ca) — tidligst + høyest prestisje. Realtor.ca/CREA-avtalen er fra **2018** (300 000+ listinger ved lansering) — eldste bekreftede portal-deal, før Serie A.
2. **MLS-laget (2023–2025) = det egentlige volum-spillet.** Én MLS-integrasjon når titusenvis av meglere *og* alle portaler som syndikerer den MLS-en, uten per-megler-salg. Fire MLS-er alene = 160 000+ meglere.
3. **Prestisje-kjeder** — direkte co-brandede avtaler (Brown Harris Stevens «preferred provider» feb. 2025, ONE Sotheby's, CENTURY 21, Royal LePage, RE/MAX). Markedsverdi utover ren datalisens.
4. **Plattform-riding** — bundlet inn i eksisterende megler-nettsted/CRM-leverandører (MoxiWorks, Delta Media, Inside Real Estate, TRIBUS). Multipliserer rekkevidde uten direkte salg per kjede.
5. **Nabo-vertikaler** — långiving/verdivurdering (homegenius/Radian, Plunk), utleie (Rently, Dwellsy). Samme adresse-lag inn i hver workflow der en «nærområde-kontekst»-beslutning skjer.

**Moat-argumentet i hver PR:** dataskala/normalisering (75–100 mrd datapunkter). Klebrigheten er **embedded-infrastruktur-innlåsing** — når scoren ligger i listing-malen, koster det re-engineering å rive den ut (samme dynamikk som gjorde GreatSchools klebrig).

### 2.4 Realtor.com + NAR-alignmentet (det viktigste enkeltfunnet)
Ingen kilde oppgir Realtor.com-avtalens startdato/eksklusivitet/struktur. Men: **NARs egen strategiske venture-arm (Second Century Ventures) er Serie B-investor i Local Logic.** NAR lisensierer Realtor.com-merket (via Move Inc./News Corp). Bransjeorganisasjonen som eier portal-merket har altså *direkte kapital-eksponering* i leverandøren. Det forklarer portal-tilgangens holdbarhet bedre enn noen enkelt-kontrakt: det er strukturell alignment, ikke bare en leveranse.

---

## 3. Overføring til Norge — hva vi faktisk tar med oss

**A. Distribusjons-wedgen er megler-systemet/kjede-plattformen, ikke «Finn».**
Norge har ikke MLS. Den funksjonelle parallellen til Local Logics MLS-/plattform-wedge er (i prioritert rekkefølge som distribusjons-multiplikator):
- **Megler-system-leverandørene** (Vitec Megler / Webmegler o.l.) — CRM/annonse-motoren *hver* norsk megler bruker. Vinner du én, embeddes Placy på hver listing det systemet produserer, på tvers av kjeder. Dette er Local Logics «platform-riding» (MoxiWorks/Delta Media) — og et **nytt GTM-perspektiv** ved siden av dagens «vinn én kjede (EM1)»-framing.
- **Kjede-plattformer** (partners.no for EM1 — der Norkart allerede sitter med Solkart). «Vinn én kjede»-tesen (06-27) består, men Local Logic viser at *plattform-leverandøren under kjeden* kan være en enda bredere wedge.
- **Finn.no** — nærmeste norske «anker-portal»-analog (Schibsted-eid, de-facto monopol på listinger). Høyest prestisje/rekkevidde, men også tregest/dyrest inngang. Anker, ikke førstevalg.

**B. Alignment-kapital som durabilitets-mekanisme.**
NAR/SCV-grepet: durabel distribusjon kan kjøpes strukturelt. Norsk analog verdt å tenke på når Aleksander/Markus strukturerer partner-/kjede-avtaler — kan en kjede (eller kjedens eier / Eiendom Norge / Schibsted) ta en *strategisk posisjon* i Placy fremfor bare å være kunde? Det binder distribusjonen tettere enn en oppsigbar leverandøravtale. (Kobles til Aleksanders eierandel-opsjon-struktur.)

**C. Europa/Norden = ukontestert.** Ingen spor av at Local Logic (eller Walk Score) har tatt Norden/Europa. Kategori-lederen har latt markedet stå. Placys Moat 1 (lokalkunnskap på bakken) + norsk-språklig redaksjon = strukturell hjemmefordel mot en eventuell senere US-inntreden.

**D. Prisgulvet bekrefter widget-fellen.** ~$100/mnd per nettsted for scores-widgeten = commodity-gulvet. Bekrefter 06-27-advarselen: oppfattes Placy som Solkart/Local Logic-widget → pris kollapser dit. Verdien ligger i (i) enterprise/portal-avtalen (udisklosert, antatt mye større) og (ii) for Placy: moat-laget. Ikke selg scoren; selg kunnskapen + innsikten.

**E. Skole = faktum, ikke kvalitets-score.** Selv Local Logic rangerer *ikke* skolekvalitet selv — deres «Education»-scorer er **avstand-til-nærmeste**, kvalitet outsources til GreatSchools. Placy har skolekrets-polygonene (Trondheim). Vi kan levere «hvilken skolekrets + hva som faktisk ligger der» (faktisk, forsvarbart) uten å påta oss en kvalitets-score vi ikke kan forsvare.

---

## 4. Produkt/metodikk — hva scoren faktisk er

**18 «Location Scores»**, internt 0–5, doblet til **0–10** for visning. Seks backend-kategorier (Realtor.coms 3-fane-UI er en presentasjons-regruppering av disse):
- **Transportation (4):** Pedestrian / Cycling / Transit / Car Friendly
- **Amenities (5):** Groceries, Shopping, Cafés, Restaurants, Nightlife
- **Education (3):** High Schools, Primary Schools, Daycares — **avstand-til-nærmeste, ikke kvalitet**
- **Character (3):** Quiet, Historic, Vibrant
- **Nature (2):** Parks, Greenery
- **Wellness (1):** Wellness

**Metodikk (bekreftet så langt det er publisert):**
- Analyse-enhet = **gate-segment** (kvartal mellom to kryss) — kontrastert eksplisitt mot Walk Scores rutenett-celler.
- Amenity-scorer (2026-oppdatering) = «nærhet + variasjon» av POI-er, nå med reell gatenettverks-rute-avstand.
- **Ingen publisert decay-funksjon, vekt-tabell eller kategori-vekting for de 18 scorene.** Til kontrast: Walk Score publiserer sin eksakte decay-kurve.
- Den *eneste* plassen Local Logic viser reell statistisk stringens er **demografi-dataen** (binomial-modellering + NASA befolknings-grid, med konfidensintervall) — **ikke** de 18 scorene.
- «Quiet» har ingen publisert støymodell. «Historic»/«Greenery» er selv-merket «limited coverage». Ingen whitepaper/patent/akademisk artikkel funnet for noen score-algoritme.

**Data-partnere (navngitt på locallogic.co/our-data):** Attom Data, Crimeometer, ClimateCheck, First American, Nature Quant, Niche, Transit App. (Kun Transit App har spesifisert bidrag.) Yelp/GreatSchools/Precisely er Realtor.coms lag, ikke Local Logics — se §1.

---

## 5. Angreps-flaten — hvorfor score-forkastelsen er forsvarbar (pitch-ammunisjon)

Dette er ryggdekningen for Andreas' «score = svada»-beslutning, hevet fra smak til argument:

1. **Subjektivitet bortforklart, ikke løst.** Local Logics egen forklaring reframer subjektivitet som et *preferanse*-problem («ulike folk verdsetter ulikt → derfor 18 scorer du kan velge mellom»), og adresserer aldri om den *enkelte* scoren er skjev eller støyende. Ingen konfidensintervall, ingen «sist oppdatert», ingen metodikk-lenke vist til sluttbruker. → Andreas' poeng bekreftet: «4.5 stjerner var elendig for våre krav» og «walk-score 9 spørs hvor langt du er vant til å gå» er nettopp validitets-problemet de ikke rører.
2. **Presedens som svir:** GreatSchools' 1–10 skole-rating (nabo-kategori) ble vist (Chalkbeat/Urban Institute) å korrelere med rase/fattigdom omtrent like sterkt som med undervisningskvalitet → tvunget formel-overhaul 2020. Local Logics «Character»-scorer (Quiet/Historic/Vibrant) er strukturelt samme slags tetthets-/infrastruktur-proxy som kan doble som demografi-proxy.
3. **Regulatorisk risiko:** US GAO-rapport (des. 2025, «Property Technology for Homebuying») flagger AI/algoritmiske eiendomsverktøy for fair-housing-styringsrisiko og «false cloak of neutrality» — ikke Local Logic ved navn, men eksakt risiko-kategorien en ugjennomsiktig «character»-score sitter i.
4. **Placys posisjon blir dermed:** «Vi tagger ikke nabolaget med et tall du ikke kan stole på — vi viser hva som faktisk ER der, så bestemmer *du*.» Det er ikke bare ærligere; det er **regulatorisk forsvarbart** der en opak score ikke er. (Aligner med [[feedback_editorial_no_years_history]] «hva som ER der» + nivå-modellens minimum-garanti = kategoritekst + drill-in, ikke tall.)

---

## 6. Konkurrentlandskap (kort)

| Aktør | Eier/status | Metodikk-åpenhet | Merknad |
|---|---|---|---|
| **Local Logic** | Uavhengig VC (Montreal) | Lav (18 uforklarte tall) | Konkurrerer på portal/MLS-syndikerings-laget, ikke DTC |
| **Walk Score** | Redfin-eid siden 2014 | Høy (publisert decay + input) | Mest akademisk studert; «single number» alle argumenterer mot |
| **AreaVibes** | Consumer-site | Høyest (publiserte vekt-%) | Mer transparent enn Local Logic tross lavere tier |
| **HowLoud (Soundscore)** | Nisje (støy) | Høy (FHWA-støymodell + 3D-propagasjon) | Ekte fysikk-modell — kontrast til Local Logics umodellerte «Quiet» |
| **Niche** | Consumer + **Local Logic-datapartner** | — | Både konkurrent og leverandør |
| **GreatSchools** | Uavhengig | — | Mest bias-omstridte score i kategorien (jf. §5) |

Poeng: de mest *transparente* aktørene (Walk Score, AreaVibes) sitter i consumer-laget; Local Logic vant portal/MLS-laget via *partnerskap-bredde*, ikke metodisk transparens. Terskelen deres har vært «vil en MLS/portal akseptere en uforklart score» — som de klarer via distribusjon, ikke troverdighet.

---

## 7. Hva vi tar med / hva vi forkaster

**Forkastet:**
- **Score-primitivet (0–10).** Låst beslutning (LOG 2026-07-09). Commodity + subjektivt + regulatorisk sårbart.

**Tar med:**
- **`Add a commute` / «legg inn adresse → se reisetid dit».** Bekreftet retning (Andreas: «tenkt på tidligere»). = ⭐⭐ Innsikt-signal (rute-forespørsler) + build-imperativ «UX er datainnsamlings-apparatet» (06-28). Motoren finnes i pipelinen.
- **3-linse-IA-en som navigasjon** (Nearby/Lifestyle/Transportation) — men som *innhold/kategorier*, ikke scorer.
- **Score+topp-3-navngitte-POI-mønsteret — minus scoren.** «Groceries 9/10: Ralphs 0.1mi, Manarah 0.2mi» → behold de navngitte stedene + avstand (beviset), drop tallet.
- **Distribusjons-arkitekturen (§3)** — megler-system/kjede-plattform-wedge + alignment-kapital. Dette er den egentlige gullbiten.

**Åpne spørsmål:**
1. Hvem er de norske «megler-system»-leverandørene å kartlegge (Vitec Megler, Webmegler, andre)? Er én av dem en raskere wedge enn å vinne en kjede direkte?
2. Kan en kjede/portal ta *strategisk posisjon* i Placy (alignment-kapital à la NAR/SCV) — og hvordan spiller det mot Aleksanders eierandel-struktur?
3. Skal `Add a commute`-UX-en prioriteres inn i board-malen nå (den fanger det rikeste Innsikt-signalet)?

---

## Kilder

**Kommersielt:** BetaKit (Serie B/founders/investorer), PRNewswire (MLS- + Brown Harris Stevens-avtaler), CREA (2018 Realtor.ca-deal), Local Logic «Year in Review 2025», Inman (homegenius/Radian), NAR Second Century Ventures.
**Produkt/metodikk:** docs.locallogic.co (score-taksonomi + API), locallogic.co/our-data (partnere), locallogic.co-blogg (demografi-metodikk, 2026 amenity-oppdatering, «Walkscore isn't enough»), Walk Score / AreaVibes / HowLoud metodikk-sider, SAGE 2023 + Chalkbeat 2019/2020 (score-kritikk), GAO-25-107201.

## Koblinger
- `LOG.md` 2026-07-09 (beslutnings-entry)
- `aktor-map.md` (Local Logic + Walk Score under proptech-benchmark, ved siden av Norkart)
- `2026-06-27-data-moatene-lokalkunnskap-innsikt.md` (Moat 2 = det Local Logic mangler; `Add a commute` = ⭐⭐-signalet)
- `2026-06-27-premium-single-bruktmarked-spor.md` §7 (Norkart/Solkart-benchmark + widget-fellen + «vinn én kjede»)
- `[[project_placy_grunnpakke_chain_model]]` (grunnpakke/kjede-modell = det Local Logic har utført)
</content>
</invoke>
