# Distribusjons-wedgen: megler-systemet, ikke portalen (norsk marked)

**Dato:** 2026-07-09
**Type:** Distribusjons-/konkurrent-analyse (eiendomssporet) — norsk parallell til Local Logic-benchmarken
**Deltakere:** Andreas + Claude (+ 3 web-researchere)
**Status:** Aktiv — kartlegging levert. Direkte input til forretningsutvikler-sporene (Aleksander/Markus). Bygger på `2026-07-09-locallogic-benchmark-eiendom.md` (åpent spørsmål #1: hvem er den norske «MoxiWorks/Delta Media»-en Placy skal ri på?).

> Foranledning: Local Logic embeddes bredt i USA ved å ri megler-CRM-/nettsted-leverandører (MoxiWorks, Delta Media), ikke ved å selge megler-for-megler. Andreas ba om dyp research på den norske analogen — «spesielt mot forretningsutviklere». Dette dokumentet kartlegger megler-system-laget, hvem som allerede okkuperer nærområde-plassen, og den skarpeste inngangen.

---

## TL;DR — fem funn som endrer GTM

1. **Wedgen er IKKE hvitt lerret.** FINN har allerede bundlet en nabolagsprofil (bygget på Eiendomsprofil-produktet) inn i sine annonsepakker **og** i begge de store megler-systemene. Placy konkurrerer som det *dype/kuraterte/interaktive* laget over en generisk commodity-profil — ikke som «førstemann». Nøyaktig moat-under-scoren-argumentet fra Local Logic-doccen, i norsk drakt.
2. **Skarpeste inngang = systemleverandøren, ikke kjeden.** Markedet er et **duopol**: **Vitec Next** (størst) + **Broker/Core by Visma**. Én integrasjon mot **Vitec Next HUB-API** (50+ partnere, åpen OpenAPI, formell partner-onboarding) treffer samtidig DNB Eiendom, Krogsveen, Nordvik, Aktiv, Notar, Rede, Sørmegleren og Heimdal — bekreftet fra Vitecs egen kundeliste. Det er «vinn én kjede» × 8, i én avtale.
3. **Premiss korrigert: `partners.no` er IKKE EiendomsMegler 1.** Det er **&Partners / White Label Estate AS (WLE)** — en hvit-etikett-allianse av frittstående meglerhus. Norkart-Solkart-bundlingen vi observerte ligger i WLE-økosystemet (Bolignytt PARTNERS), ikke hos EM1. Dette justerer 06-27-notatet.
4. **Inkumbenten er slåbar på dybde, ikke på pris/tilstedeværelse.** Nabolagsprofilen er avstand-til-POI, ikke-redaksjonell, ingen lokalkunnskap, ingen 3D/visuelt lag. Placys Moat 1 + Innsikt + immersjon er det strukturelle gapet.
5. **Konkret lavthengende frukt: NEFs proptech-kart** (Norges Eiendomsmeglerforbund) — 140+ selskaper, årlig revidert, vist på NEFs proptech-konferanser. Presedens: Placepoint kom på kartet → partnerskap med Visma. Kopier mønsteret: synlighet → system-leverandør-partnerskap. Kontakt: svein@nef.no.

---

## 1. Det norske «nabolag»-laget finnes allerede (og er bundlet)

**FINN Nabolagsprofil** er de-facto-standarden. Vises som PDF i salgsoppgave + digital lenke/widget + i selve FINN-annonsen, i tre varianter (Bolig/Fritid/Næring): skole, barnehage, kollektiv, demografi, boligtype-sammensetning, naboinnsikt, kart/flyfoto. **Inkludert i FINNs «Large»/«Medium»-annonsepakker** — bundlet, ikke solgt separat. FINN navngir egne partnere bak profilen: **Visma, GeoData, EnTur, Vitec, SSB**.

Produktet er bygget på **Eiendomsprofil AS** (Bergen, ~21,6 MNOK omsetning, ~4 ansatte, etablert 2005), som også står som egen «Data & Eiendomsinformasjon»-standardpartner i Vitec Next.

**Åpen datakonflikt (verifiseres):** Researcher A leste FINN som å ha *absorbert* Eiendomsprofil-produktet inn i sitt eget bedriftskunde-produkt; researcher B leste Eiendomsprofil AS som en fortsatt *uavhengig* Bergen-leverandør FINN henter data fra («FINN mottar informasjonen sin fra Eiendomsprofil AS»). Substansen er lik uansett: én generisk, ikke-redaksjonell nabolagsprofil, bundlet bredt. Eierskaps-/uavhengighets-spørsmålet påvirker om Eiendomsprofil er en oppkjøps-/partner-kandidat eller en FINN-intern funksjon — verdt å avklare før innsalg.

**Konsekvens for pitch:** Placys vinkel kan ikke være «dette finnes ikke». Den må være «dette er det dype laget over en flat avstand-til-POI-profil»: kart-UX, drill-in, kuratert Lokalkunnskap, 3D, VO, og — det ingen av dem har — **Innsikt tilbake til megler** (engasjement per listing). Se `2026-07-09-locallogic-benchmark-eiendom.md` §5 for angreps-flaten.

---

## 2. Markedsstrukturen: et system-duopol

Tre fagsystemer i markedet (bekreftet via Boligporten), reelt et duopol:

| System | Eier | Status | Integrasjonsflate |
|---|---|---|---|
| **Vitec Next** (Vitec Megler AS) | Vitec Software Group (Nasdaq Stockholm) | Størst. Bygget via oppkjøp (IT-Makeriet 2011, Midas Data 2012, Fox Publish 2015, Plania 2016). ~40 ansatte, Oslo. Selv-hevdet «~70 % av norske meglere» (**vendor-rapportert, ikke uavhengig verifisert — behandles som «størst», ikke hardt tall**). | **Next HUB** — åpen OpenAPI, 50+ partnere, partner-portal (hubdoc.vitecnext.no), HMAC-auth, formell onboarding |
| **Broker / Core by Visma** (Broker AS, tidl. Visma Real Estate) | Visma | Kjøpte **Webmegler** (Websystemer AS) 2018 + Meglerfront/Create-Solutions/Codegarden/Fenistra 2020 → rollup. Produkt-API-er «Broker» og «Core». Ingen navngitte kjedekunder funnet offentlig. | API-flater Broker/Core, egen partneravtale-prosess |
| **Webmegler** | Visma (siden 2018) | Fortsatt utbredt merkenavn; integrert mot Infoland/Norkart/Eiendomsverdi | — |

**Presedens for integrasjon:** Ambita har flere dype backend-integrasjoner i Vitec Next (saldoforespørsel, e-tilstandsrapport, oppgjørs-overvåking). **Kvass** og **Boligvelger** bygger allerede mot Next HUB for nybygg/prosjektsalg. Dyp modul-integrasjon er et etablert, akseptert mønster — ikke bare enkle widgets. Det senker teknisk risiko for et Placy-modul.

---

## 3. Kjede ↔ system-mapping (bekreftet via Vitecs egen kundeliste)

| Kjede | Eierskap | System | Konfidens |
|---|---|---|---|
| **DNB Eiendom** | DNB (bank), kontor bankeid direkte | **Vitec Next** | Bekreftet |
| **Krogsveen** | Pareto Bolig AS (Svein Støle) | **Vitec Next** | Bekreftet |
| **Nordvik** | Partner-eid (ikke bank). «Like mye teknologiselskap som meglerforetak» | **Vitec Next** | Bekreftet |
| **Aktiv Eiendomsmegling** | Eika Gruppen (franchise) | **Vitec Next** | Bekreftet |
| **Sørmegleren, Heimdal, Notar, Rede** | — | **Vitec Next** | Bekreftet |
| **EiendomsMegler 1** | Allianse: 12 selvstendige regionale SpareBank1-/Eika-selskap | **Ukjent** — IKKE på Vitecs liste; systemvalg kan variere regionalt | Antatt usikkerhet |
| **PrivatMegleren** | Nordea 67 % / grunnleggere 33 % (franchise) | **Ukjent** | Gap |
| **Sem & Johnsen** | ~80 % partner-eid / ~20 % Pareto Bank | Sier selv «frihet til å velge egne verktøy» | Uavklart |
| **&Partners / Nylander & Partners** | White Label Estate AS (WLE), hvit-etikett-allianse | WLE-pakke (CRM «Intra»), system uspesifisert; Norkart Solkart bundlet i «Bolignytt PARTNERS» | Bekreftet modell |

**Nøkkelinnsikt:** de sentralstyrte kjedene (DNB, Krogsveen, Nordvik) har **én beslutningstaker** og er raskere å forhandle med enn allianse-/franchisemodellene (EM1s 12 selskap, Aktivs franchise, &Partners/WLE) der beslutningen er spredt.

---

## 4. Bransjetall (Eiendom Norge)

- **~57–60 foretaksmedlemmer, ~714–760 kontorer/filialer** (kilde-avvik mellom snapshots — størrelsesorden bekreftet).
- Medlemmene = **~98 % av alle boligtransaksjoner**.
- **134 955 transaksjoner i 2024**; juni 2026: 11 757 solgt (−2 % YoY), 40 dagers snittsalgstid.
- **Topp-3-konsentrasjon: ikke funnet** (eneste tall fra 2014, for gammelt). Krever Eiendom Norges egne (dels betalte) boligmeglingsrapporter — **åpent hull**.

---

## 5. BD-vinkel — for forretningsutviklerne (Aleksander/Markus)

Dette er kjernen Andreas ba om. Tre inngangsveier, rangert:

**① Systemleverandøren (Vitec Next) — bredest wedge.**
Én partner-integrasjon mot Next HUB → embeddet på tvers av 8+ bekreftede kjeder samtidig. Dette er den ekte «Local Logic rir MoxiWorks»-analogen, og et **nytt strategisk alternativ ved siden av «vinn én kjede»** (06-27). Teknisk risiko lav (etablert partner-program, presedens i Kvass/Boligvelger/Ambita). Handelen man må vinne: en plass i systemet der FINN Nabolagsprofil allerede ligger → **fortrengning/premium-oppsalg, ikke greenfield**.

**② Sentralstyrt kjede direkte (Nordvik først).**
Nordvik = partner-eid, teknologi-drevet, én beslutningstaker → raskest mottakelige for en pilot. DNB/Krogsveen = større, men mer byråkratiske. Dette er Markus' volum-tese og Andreas' «vinn én kjede» konkretisert til navn. Kjede-data mater deretter system-leverandør-pitchen (referanse-case).

**③ Portalen (FINN) — høy friksjon, deprioritér.**
FINN har kun et enveis annonse-leverings-API for annonsører; **ingen funnet åpning for tredjeparts nabolagsmoduler i annonsevisningen**. FINN eier egen produkt-roadmap og har allerede sin egen bundlede profil. Anker på lang sikt, ikke førstevalg.

**Lavthengende frukt nå (begge BD-ere kan eksekvere):** kom på **NEFs proptech-kart** (svein@nef.no) → bruk synlighet + NEF-konferansene som varm inngang mot Vitec/Visma partner-program. Placepoint gjorde nettopp dette (kart → Visma-partnerskap).

**Kobling til de to sporene:**
- **Aleksander (utbygger/nybygg):** Kvass/Boligvelger dekker allerede nybygg-annonsering via Next HUB → det er den naturlige prosjekt-/utbygger-kanalen å ri på.
- **Markus (bruktmegler/volum):** system-leverandør-wedgen ER volum-spillet. Nordvik-pilot → Vitec-partner = stigen fra første betaling til bred distribusjon.
- **Alignment-kapital (fra Local Logic-doccen):** verdt å teste om en teknologi-drevet kjede (Nordvik) eller systemleverandør vil ta strategisk posisjon, ikke bare være kunde — binder distribusjonen (jf. NAR/SCV-grepet).

**Åpent hull:** ingen navngitte IT-/produktdirektører per kjede offentlig tilgjengelig → LinkedIn-jobb (titler «Digitaliseringsdirektør»/«IT-direktør» hos DNB Eiendom, Pareto Bolig, Nordvik, Vitec Partner-portal).

---

## 6. Konsekvenser for eksisterende strategi

- **06-27 «vinn én kjede»** består, men får et bredere alternativ over seg: **vinn én systemleverandør**. Anbefalt sekvens: Nordvik-pilot (proof) → Vitec Next HUB-partner (skala).
- **`partners.no` = &Partners/WLE, ikke EM1** — korriger i aktor-map og fremtidige notater. Norkart-Solkart-«plattform-bundlet»-observasjonen gjelder WLE-økosystemet.
- **Prisdisiplin (06-27-advarselen) forsterkes:** FINN Nabolagsprofil er *gratis-bundlet* → Placy må prises som premium-lag, ikke som «nabolagsprofil» (som er et løst, gratis commodity-ord i dette markedet nå).
- **Moatene (06-27):** FINN Nabolagsprofil beviser at commodity-laget (Lag A) allerede er tatt. Placys eneste holdbare posisjon er Lag B — Lokalkunnskap + Innsikt + immersjon. Bekrefter moat-fra-linje-1-imperativet.

## Åpne spørsmål
1. Er Eiendomsprofil AS uavhengig (oppkjøps-/partner-kandidat?) eller FINN-intern? (påvirker konkurranse-dynamikk)
2. Hvilket system bruker EM1 (kjeden Andreas kjenner best) — regionalt varierende?
3. Skal Placy sikte på Vitec Next HUB-partner som primær distribusjons-hypotese, med Nordvik-pilot som proof foran?
4. Topp-3-kjede-konsentrasjon (Eiendom Norge-rapport) — kjøp/skaff tallet.

## Kilder
Vitec Next (Referanser, Samarbeidspartnere, Hvorfor-velge, hubdoc), Vitec Software Group (oppkjøpsliste), Boligporten (integrasjoner), Visma (Webmegler-kjøp 2018, Codegarden 2020), Broker.no, FINN Nabolagsprofil (bedriftskunde) + FINN Hjelpesenter (API), nabolag.no, Eiendomsprofil AS (proff.no), Ambita/Spir Group, Eiendomsverdi, Hjemla/Placepoint, DN.no (Pareto/Krogsveen), Eiendom Norge (medlemmer), White Label Estate (wle.no), NEF proptech-kart.

## Koblinger
- `2026-07-09-locallogic-benchmark-eiendom.md` (US-benchmarken dette svarer på — §3 åpent spørsmål #1)
- `2026-06-27-premium-single-bruktmarked-spor.md` §7 (Norkart/Solkart, «vinn én kjede», widget-fellen)
- `2026-06-27-data-moatene-lokalkunnskap-innsikt.md` (Lag A tatt av FINN Nabolagsprofil → Lag B er Placys eneste holdbare posisjon)
- `2026-06-25-markus-bruktmegler-vs-utbygger.md` + `2026-06-23-aleksander-kommersialisering-utbygger-spor.md` (BD-sporene dette mater)
- `aktor-map.md` (nytt distribusjons-lag-avsnitt + partners.no-korreksjon)
</content>
