# Setningsformer til de 46 FAQ-byggerne

**Dato:** 2026-09-06
**Fra:** Fable, som svar på [bestillingen](2026-09-06-faq-byggere-bestilling-fable.md)
**Grunnlag lest:** [den sammenslåtte katalogen](2026-09-06-faq-katalog-sammenslatt.md) (alle 80 *Kilde*-linjer), `lib/generators/faq-generator.ts` (alle 34 eksisterende byggere og hjelperne), `lib/generators/opening-hours.ts`, `ReportBoardFactsSchema` og `POI.travelTime` i `lib/types.ts`
**Status:** Leveranse. Ingen kode, ingen svar for noe konkret board. 46 av 46 levert, 12 S / 27 S+ / 7 K.

---

## 0. Slik leser du leveransen

Hver form er én template-literal slik den skal se ut i koden. `${slot}` er et oppslag noen andre skriver; alt utenfor krøllparentesene er ordene leseren ser.

Fire ting går igjen i alle 46 og står derfor her én gang:

1. **Terskelen for «nærmeste X er …» mot «Nærmeste X på kartet er …»** er den konvensjonen `tannlege`, `kafe`, `uteliv`, `bading`, `svommehall` og `treningspark` alt bruker: innenfor radiusen stoler vi på at poolen er tett nok til at «nærmeste» er sant; utenfor scopes påstanden til kartet. Radiusen er `WALK_RADIUS_MIN` (10) med mindre *Kilde*-linja sier 15 — da står det i merknaden.
2. **Åpningene er bevisst ulike.** Fila har en test som holder byggernes første ord fra hverandre innenfor et tema, og kommentaren øverst sier hvorfor (41 av 158 Ranheim-tekster åpnet likt). Der jeg måtte velge bort en naturlig åpning fordi en nabo alt har den, står det i merknaden.
3. **«Ingen treff» er «utelat raden»** i alle 46. Der det finnes en fristelse til noe annet — en nasjonal konstant som kunne stått alene, et «0 avganger» — sier jeg det eksplisitt under det spørsmålet.
4. **Sykkel- og biltid brukes bare der de er precomputet.** `POI.travelTime` bærer `walk`, `bike` og `car` allerede; koden har bare en hjelper for den første. Se hjelper 1 og 2 under.

### Hjelpere jeg foreslår, med hva de skal gjøre

| Ny hjelper | Gir | Brukes av |
|---|---|---|
| `sykkelMinutter(poi)` / `bilMinutter(poi)` | `travelTime.bike` / `.car` med nøyaktig samme kontrakt som `walkMinutes`: et endelig tall eller `undefined`, aldri et estimat. | alt som bruker `reisetid` |
| `reisetid(poi)` | «8 minutter til fots» når gangtiden er ≤ `WALK_RADIUS_MIN` eller ingen alternativ tid er målt. Ellers «42 minutter til fots eller 18 med sykkel» — sykkel når sykkeltiden er ≤ 15, ellers bil. **Aldri tre tall**: katalogens eksempler skriver «37 til fots, 17 med sykkel eller 9 med bil», og det er en liste, ikke en setning. | 30 av de 46 (slot `${reise}`) |
| `aerendtyper(anker)` | Ærendtypene ankerets medlemmer dekker, fra `ÆREND`-lista som alt finnes: «dagligvare, apotek, bakeri og treningssenter». Typer, aldri butikknavn — det er slik `uten-bil` alt snakker, og det er det som holder regel 5. | `tjenester-samme-sted` |
| `navnefilter(poi, { krever?, utelukker? })` | Kategori-portet ordfilter på navnet: sann bare når navnet bærer minst ett `krever`-ord og ingen `utelukker`-ord. Går ALDRI på navnet alene — alltid inne i én kategori (samme regel som `norskStedsnavn`). | `legesenter`, `bibliotek`, `museum`, `kirke`, `hund`, `pizza`, `idrettsanlegg` |
| `slagAvType(poi, kart)` | Google-typen → det norske ordet leseren trenger: `concert_hall` → «konsertsal», `seafood_market` → «fiskebutikk». Forutsetter at typen lagres (v2.pois har ingen `types`-kolonne i dag — katalogen § 5 pkt 9). | `kulturscene`, `spesialtrening`, `spesialbutikk-mat`, `is-skoyter` |
| `gangavstandTekst(m)` | Under én kilometer: `roundedMeters`. Fra én kilometer: «1,4 kilometer», én desimal. | `skoleskyss`, `blir-det-bygget` |

Fire hjelpere finnes alt men sto ikke i bestillingens tabell, og formene under lener seg på dem: `klokkeslett(min)` («23», «21.30», «midnatt»), `formatHourRange(tider)` («10–22»), `sundayHours(days)` og `poiLink(navn, poi)` (lenke uten anker-logikk, for skolene).

### Fire avvik fra bestillingen som du må avgjøre

- **Regel 5 mot tre *Kilde*-linjer.** `museum` sier «nærmeste + to neste», `til-arbeidsplassene` har tre destinasjoner i konfigurasjonen, `kjopesenter` (eksisterende) sier «maks fem medlemmer». Jeg har holdt to navngitte steder overalt. Det ene stedet jeg mener regelen bør vike er `til-arbeidsplassene`: destinasjonene ER spørsmålet, og tre reisemål er ikke en liste leseren ikke leser. Formen står med to, varianten med tre står under.
- **Eksterne lenker finnes ikke i svarformatet.** `answer` bærer `[tekst](poi:id)` og `[tekst](category:id)`, ingenting annet. Katalogens «se skisporet.no», «står på helsenorge.no», «kulturskolens sider» er derfor tatt ut av formene. Enten utvides lenkeoppløseren, eller de forblir borte — de tilfører ingen fakta om adressen.
- **Fire faste setninger som ville stått likt på alle 108 000 boards.** `hvem-bor-her` («Tallene gjelder dagens beboere …») er pålagt av katalogens § 6 og står. De tre andre — «Legevakten nås på 116 117», «Sentralen er åpen for alle som vil delta eller bidra», «En vedtatt plan er ikke det samme som at bygging er i gang» — er sanne, men er nøyaktig den typen setning som felte `barnehage-plass`. **Anbefaling: drop dem.** De står som valgfri hale i formene, merket.
- **`regnvaersdag` har ingen «på kartet»-variant.** Spørsmålet lover nærhet, og Området-siden skal ikke sende familien 40 minutter av gårde — det svaret bor i Opplevelsers egne rader (`bibliotek`, `kino`). Utenfor 15 minutter til fots eller 15 med sykkel utelates raden.

---

## 4.1 Området (startsiden)

### `tjenester-samme-sted` — Hvor kan jeg samle flere ærender på én tur? (S)

**Hovedform:** `På ${anker} ligger ${aerend} samlet, ${gangtid} til fots.`
**Utenfor gangavstand:** `Nærmeste sted på kartet som samler flere ærender er ${anker}, ${reise}, med ${aerend}.`
**Flere steder:** hale `${anker2} samler ${aerend2}, ${reise2}.`
**Ingen treff:** utelat raden. Det gjelder også når ankeret bare dekker ÉN ærendtype — da er det ikke «samle».
**Slots:** anker = `namedPoi(anker)` for selve ankeret (`isAnchorPOI`), lenker til senterkortet. aerend = `aerendtyper(anker)` — «dagligvare, apotek, bakeri og treningssenter», typer fra `ÆREND`-lista, aldri butikknavn. gangtid = `minutter(walkMinutes(anker))`. reise2 = `reisetid(anker2)` — *Kilde* ber om sykkeltid på neste, og det er det `reisetid` gir når gangtiden er over ti.
**Merknad:** Regel 5 holdes ved at medlemmene beskrives som typer: to ankre er de to navngitte stedene. Katalogens § 6 avgjorde at Området eier medlemslista og at Hverdagslivs `kjopesenter` IKKE skal liste medlemmer — den formen står ikke i denne leveransen, men implementasjonen må vite det.

### `regnvaersdag` — Hva finnes innendørs i nærheten? (S)

**Hovedform:** `${navn1} er nærmeste ${slag1}, ${reise1}, og ${navn2} nærmeste ${slag2}, ${reise2}.`
**Utenfor gangavstand:** finnes ikke, se avvik 4. Innenfor betyr gangtid ≤ 15 ELLER sykkeltid ≤ 15 (*Kilde*).
**Flere steder:** hovedformen ER to-steds-formen. Bare ett innendørs sted: `${navn1} er nærmeste ${slag1}, ${reise1}.`
**Ingen treff:** utelat raden.
**Slots:** navn1/navn2 = `namedPoi` for det nærmeste stedet i hver av to ULIKE kategorier — to kinoer svarer ikke på «hva finnes». slag = kategoriordet: «bibliotek», «svømmehall», «museum», «kino», «treningssenter», «idrettshall» (idrett-POI med «hall» i navnet). reise = `reisetid(poi)`.
**Merknad:** Leser `allPois`, ikke ett tema. Filtrene for `bibliotek`, `museum` og `kirke` under gjelder her også — et forskningsbibliotek er ikke mer innendørs-tilbud for en familie på Området enn i Opplevelser.

### `blir-det-bygget` — Er det nye reguleringsplaner i nærheten? (S+)

**Hovedform:** `${plan} ble vedtatt i ${aar} og regulerer ${avstand} fra boligen til ${formaal}.`
**Utenfor gangavstand:** ikke relevant — *Kilde* er en fast ring på 500 meter, og avstanden står i setningen.
**Flere steder:** hale `${plan2} ligger til behandling hos ${kommune}.` — det nyeste planforslaget under behandling. Er begge vedtatt: `${plan2} (${aar2}) regulerer til ${formaal2}.`
**Ingen treff:** utelat raden. Aldri «ingen planer i nærheten».
**Slots:** plan = plannavnet slik planregisteret skriver det, ren tekst (ingen lenkeform for planinnsyn). aar = vedtaksår. avstand = `gangavstandTekst(m)` fra boligen til plangrensen. formaal = registerets arealformål i klartekst («boliger», «næring», «grøntområde»), `ogJoin` ved flere. kommune = kommunenavnet fra geokodingen.
**Merknad:** Ingen antall («fire planer innen 500 meter») — regel 8 krever at leseren kan telle det samme på kartet, og planene tegnes ikke der. Valgfri fast hale «En vedtatt plan er ikke det samme som at bygging er i gang.» — anbefalt droppet, se avvik 3.

### `hvem-bor-her` — Hvem bor i nabolaget? (S+)

**Hovedform:** `I ${krets} bodde det ${antall} personer 1. januar ${aar}, ${andelBarn} prosent under 18 år og ${andelEldre} prosent 67 år eller eldre. Tallene gjelder dagens beboere i grunnkretsen, ikke de som flytter inn.`
**Utenfor gangavstand:** ikke relevant.
**Flere steder:** ikke relevant. Valgfri hale mellom de to setningene når feltet finnes: `${andelPar} prosent av husholdningene var par med barn.`
**Ingen treff:** utelat raden. Mangler andelene men ikke totalen: `I ${krets} bodde det ${antall} personer 1. januar ${aar}.` + den faste setningen.
**Slots:** krets = grunnkretsnavnet fra SSB/Kartverket. antall, andelBarn, andelEldre, andelPar = SSB-tall, hele prosent. aar = statistikkåret — **vises alltid**, det er katalogens regel.
**Merknad:** Den faste andre setningen er pålagt av § 6 og er det ene stedet en setning står likt på alle boards med vilje. Regel 8 tåles fordi kilden er navngitt og etterprøvbar hos SSB, ikke på kartet.

### `ferdig-ved-innflytting` — Hva er klart ved innflytting? (K)

**Form prosjektet fyller ut:** `Ved innflytting ${tidspunkt} er ${ferdig} ferdig. ${senere} kommer etter innflytting, ${naar}.`
**Standard-hale fra poolen (valgfri, deterministisk):** `Rundt boligen finnes i dag ${navn1} (${gangtid1}) og ${navn2} (${gangtid2}).`
**Ingen treff:** ingen kuratert tekst = ingen rad. Det er hele poenget: bruktbolig får aldri denne raden.
**Slots:** tidspunkt, ferdig, senere, naar = prosjektets egne ord fra en datert utbygger-bekreftelse. navn1/navn2 = de to nærmeste stedene på boardet med målt gangtid, holdeplasser unntatt (samme sortering som `naermest`, men to og ikke tre).
**Merknad:** Standarden tilfører ALDRI et tidspunkt. Ferskvare-regelen for kuraterte svar (ingen tider og priser) møter her sitt ene unntak: innflyttingstidspunktet er det spørsmålet handler om, og det er prosjektets løfte, ikke vårt.

---

## 4.2 Barn & oppvekst

### `skolevei` — Hvor lang er skoleveien til fots? (S)

**Hovedform:** `Skoleveien til ${skole} er ${gangtid} til fots.`
**Utenfor gangavstand:** samme form. Spørsmålet lover ikke nærhet, det spør om et tall, og skolen er gitt av kretsen — ikke «nærmeste». Ingen «på kartet».
**Flere steder:** `Skoleveien til ${skole} er ${gangtid} til fots, og til ${ungdomsskole}, der ungdomstrinnet hører til, ${gangtid2}.` Bare ungdomsskolen målt: `Skoleveien til ${ungdomsskole}, der ungdomstrinnet hører til, er ${gangtid2} til fots.`
**Ingen treff:** utelat raden. Mangler én av skolene gangtid, utelates DEN setningen — aldri et estimat (Eberg skole har ingen målt tid i dag, § 5 pkt 7).
**Slots:** skole = `poiLink(fact.navn, findSchoolPoi(allPois, fact))` med `fact = boardFacts.schools.barneskole` — kretsskolen, ikke nærmeste skole-POI. gangtid = `minutter(walkMinutes(skolePoi))`.
**Merknad:** Åpner med «Skoleveien» og ikke «Til …», fordi `tilSentrum` åpner med «Til» — de står ikke i samme tema, men `skoleskyss` under gjør det, og den trenger «Til».

### `barnehage-alder` — Tar barnehagene i nærheten imot ettåringer? (S)

**Hovedform:** `${navn} tar imot barn i alderen ${alder}, ${gangtid} til fots.`
**Utenfor gangavstand:** finnes ikke — *Kilde* sier ≤ 15 minutter, og «i nærheten» står i spørsmålet. Utenfor utelates.
**Flere steder:** samme aldersgrense: `${navn1} (${gangtid1}) og ${navn2} (${gangtid2}) tar imot barn i alderen ${alder}.` Ulik grense: to setninger i hovedformen.
**Ingen treff:** utelat raden.
**Slots:** navn = `namedPoi`. alder = NBR `AlderstrinnFra`–`AlderstrinnTil` skrevet som «1–6 år» (samme form som `trinnPhrase`, «0–6 år» når registeret sier 0). gangtid = `minutter(walkMinutes(poi))`.
**Merknad:** **Bare barnehager med `AlderstrinnFra` ≤ 1 kvalifiserer** — det er dem som svarer ja. De andre utelates; aldri «tar ikke imot». Aldersfeltet ligger i barnehagemalen (`alder`) i dag; byggeren må kunne lese det fra POI-en. Kan den ikke det, er spørsmålet S+ og ikke S.

### `skoleskyss` — Har barna rett på gratis skoleskyss? (S+)

**Hovedform:** `Til ${skole} er det ${meter} langs gangveien. Gratis skoleskyss gjelder fra to kilometer for 1. trinn og fire kilometer fra 2. trinn.`
**Utenfor gangavstand:** ikke relevant — avstanden er svaret.
**Flere steder:** `Til ${skole} er det ${meter} langs gangveien, og ${meter2} til ${ungdomsskole}. Gratis skoleskyss …`
**Ingen treff:** utelat raden. **Lovsetningen alene er ikke en rad** — den er identisk på alle adresser, og det var nøyaktig derfor `barnehage-plass` gikk ut av katalogen.
**Slots:** skole = som i `skolevei`. meter = `gangavstandTekst(m)` fra gangrutens lengde til kretsskolen — S+-feltet: i dag precomputes bare minutter, ikke meter.
**Merknad:** Bare positiv form — «gjelder fra», aldri «har ikke rett». Katalogens eksempel hadde en tredje setning om trafikkfarlig vei; den er tatt ut fordi den er en generell lovopplysning uten adressefakta og sprenger 60 ord.

### `helsestasjon` — Hvor er nærmeste helsestasjon? (S+)

**Hovedform:** `${navn} er nærmeste helsestasjon, ${gangtid} til fots.`
**Utenfor gangavstand:** `Nærmeste helsestasjon på kartet er ${navn}, ${reise}.`
**Flere steder:** hale `${navn2} ligger ${reise2} unna.`
**Ingen treff:** utelat raden.
**Slots:** navn = `namedPoi`. reise = `reisetid(poi)`.
**Merknad:** Ny kategori `helsestasjon`; til den finnes, `navnefilter` på `doctor` med `krever: ["helsestasjon"]`. Hvilken helsestasjon familien HØRER TIL bestemmer kommunen etter adresse og står ikke i kilden — formen sier «nærmeste», aldri «deres».

---

## 4.3 Hverdagsliv

### `legesenter` — Hvor er nærmeste legesenter? (S)

**Hovedform:** `${navn} er nærmeste legesenter, ${gangtid} til fots.`
**Utenfor gangavstand:** `Nærmeste legesenter på kartet er ${navn}, ${reise}.`
**Flere steder:** hale `${navn2} ligger ${reise2} unna.`
**Ingen treff:** utelat raden.
**Slots:** navn = `namedPoi` (Valentinlyst Legesenter ligger i senteret → «Valentinlyst Legesenter» uten påheng, `nameCarriesAnchor` tar det). reise = `reisetid(poi)`.
**Merknad:** Filteret er et krav: `navnefilter` på `doctor` med `krever: ["legesenter", "legekontor", "legegruppe", "fastlege", "helsesenter", "medisinsk"]`. En **allowlist**, ikke en blocklist — `doctor` rommer gynekolog, urolog og nevrolog, og lista over spesialister er lengre enn lista over ord for allmennlege. Ledig fastlegeplass påstås aldri (*Kilde*).

### `pakker-post` — Hvor er nærmeste Post i butikk? (S+)

**Hovedform:** `${navn} har Post i butikk, ${gangtid} til fots.`
**Utenfor gangavstand:** `Nærmeste Post i butikk på kartet er ${navn}, ${reise}.`
**Flere steder:** hale `${navn2} er alternativet, ${reise2} unna.`
**Ingen treff:** utelat raden.
**Slots:** navn = `namedPoi` for vertsbutikken — Bring-punktet matches til butikk-POI-en på koordinat, eller importeres som eget POI i `post`.
**Merknad:** Bring Pickup Point API bærer også Postens pakkebokser. **De svarer ikke på dette spørsmålet** og utelates: en pakkeboks er ikke «Post i butikk», og spørsmålsteksten ble snevret nettopp til det kilden lover. PostNord og Helthjem finnes ikke i kilden og nevnes ikke.

### `dagligvare-lengst-apent` — Hvor sent kan jeg handle mat på hverdager? (S+)

**Hovedform:** `${navn} holder åpent til ${stengetid} på hverdager, ${gangtid} til fots.`
**Utenfor gangavstand:** `Lengst åpent på kartet har ${navn}, til ${stengetid} på hverdager, ${reise}.`
**Flere steder:** samme stengetid: `${navn1} og ${navn2} holder åpent til ${stengetid} på hverdager, ${gangtid1} og ${gangtid2} til fots.` Ulik: hale `${navn2} stenger ${stengetid2}, ${gangtid2} unna.`
**Ingen treff:** utelat raden. Ingen cachede tider = ingen påstand, aldri «stenger tidlig».
**Slots:** stengetid = `klokkeslett(hverdagstider(poi).closeMin)` — «23», «21.30», «midnatt». Bare steder der `hverdagstider` gir et svar (alle fem hverdager like) kvalifiserer. Sortering: seneste stengetid først, så kortest gangtid.
**Merknad:** Radius 15 (*Kilde*), ikke ærend-radiusen på 10. Kategorier `supermarket` + `convenience`, ingen annen port trengs. Kilden er `refresh-opening-hours`-cachen til feltet ligger i pipelinen (§ 5 pkt 3) — det er derfor det er S+.

### `dagligvare-sondag` — Hvor kan jeg handle dagligvarer på søndag? (S+)

**Hovedform:** `På søndag holder ${navn} åpent ${tider}, ${gangtid} til fots.`
**Utenfor gangavstand:** `Nærmeste søndagsåpne dagligvare på kartet er ${navn}, åpent ${tider}, ${reise}.`
**Flere steder:** hale `${navn2} har åpent ${tider2}, ${gangtid2} unna.`
**Ingen treff:** utelat raden.
**Slots:** tider = `formatHourRange(sundayHours(days))` — «10–22». `"closed"` og `null` kvalifiserer ikke, og det står ingenting om dem.
**Merknad:** Radius 15 (*Kilde*). Søndagsåpne dagligvarer i Norge er i praksis småbutikkene, så raden vil oftest navngi en Joker eller en Bunnpris-kiosk — det er riktig svar, ikke en feil i dataen. «På søndag» (entall) skiller seg fra `sondagsapent` i Mat & drikke, som åpner «På søndager holder …».

### `vinmonopol` — Hvor er nærmeste Vinmonopol? (S+)

**Hovedform:** `${navn} er nærmeste Vinmonopol, ${gangtid} til fots.`
**Utenfor gangavstand:** `Nærmeste Vinmonopol på kartet er ${navn}, ${reise}.`
**Flere steder:** hale `${navn2} ligger ${reise2} unna.`
**Ingen treff:** utelat raden.
**Slots:** navn = `namedPoi` — «Vinmonopolet Valentinlyst i Valentinlyst Senter» blir «Vinmonopolet Valentinlyst» via `nameCarriesAnchor`. Valgfri hale når tidene er cachet på POI-en: `, med åpent ${tider} på hverdager` (`formatHourRange(hverdagstider(poi))`).
**Merknad:** Kilden er Vinmonopolets butikk-API → POI i `liquor_store`; til den er koblet, `navnefilter` med `krever: ["vinmonopolet"]` på samme kategori. «Søndag stengt» er en nasjonal konstant og står ikke i raden.

### `legevakt-sykehus` — Hvor er nærmeste legevakt? (S+)

**Hovedform:** `${navn} er nærmeste legevakt, ${reise}.`
**Utenfor gangavstand:** hovedformen ER den — legevakten ligger nesten alltid utenfor, og `reisetid` gir «28 minutter til fots eller 12 med bil». Ingen «på kartet»: kilden er kommunens egen oppføring, og den er komplett per kommune.
**Flere steder:** hale når Entur-mønsteret er lagret for legevakten (samme S+-mekanisme som videregående): `Med ${linje} fra ${holdeplass} tar det ${minutter} minutter.`
**Ingen treff:** utelat raden.
**Slots:** navn = `poiLink`. reise = `reisetid(poi)`, som her vil velge bil siden sykkel sjelden er ≤ 15. linje = `ogJoin(pattern.lines)`, holdeplass = `poiLink(stop.name, stopPoi(...))`.
**Merknad:** Aldri Google `hospital` (*Kilde*). Valgfri fast hale «Legevakten nås på 116 117 når fastlegen er stengt.» — anbefalt droppet, se avvik 3.

---

## 4.4 Mat & drikke

### `pizza` — Hvor er nærmeste pizzasted? (S)

**Hovedform:** `${navn} er nærmeste pizzasted, ${gangtid} til fots.`
**Utenfor gangavstand:** `Nærmeste pizzasted på kartet er ${navn}, ${reise}.` — radius `DINING_RADIUS_MIN` (15).
**Flere steder:** hale `${navn2} ligger ${reise2} unna.`
**Ingen treff:** utelat raden.
**Slots:** navn = `namedPoi`. Porten er Google-typen `pizza_restaurant`.
**Merknad:** Typen lagres ikke i dag (§ 5 pkt 9), så katalogens S «forutsetter» kolonnen. Mellomløsningen er `navnefilter` på `restaurant` med `krever: ["pizza", "pizzeria"]` — ingen merkevareliste (en liste over kjeder er kuratering, ikke data).

### `takeaway` — Hvor henter jeg takeaway? (S+)

**Hovedform:** `${navn} har takeaway, ${gangtid} til fots.`
**Utenfor gangavstand:** `Nærmeste sted med takeaway på kartet er ${navn}, ${reise}.` (15)
**Flere steder:** `${navn1} og ${navn2} har takeaway, ${gangtid1} og ${gangtid2} til fots.`
**Ingen treff:** utelat raden.
**Slots:** Porten er Places-attributtet `takeout === true`; `false` og `undefined` behandles likt — ingen påstand. Levering som hale bare når `delivery === true`: `${navnL} tilbyr også levering.` Er det samme sted: `${navn} har takeaway og tilbyr levering, ${gangtid} til fots.`
**Merknad:** «Tilbyr levering» er stedets tilbud. Aldri «leverer hit» eller «leverer til adressen» — attributtet bærer ingen leveringspolygon (*Kilde*).

### `sitte-ute` — Hvor kan jeg sitte ute og spise? (S+)

**Hovedform:** `${navn} har uteservering, ${gangtid} til fots.`
**Utenfor gangavstand:** `Nærmeste uteservering på kartet er ${navn}, ${reise}.` (15)
**Flere steder:** `${navn1} og ${navn2} har uteservering, ${gangtid1} og ${gangtid2} til fots.`
**Ingen treff:** utelat raden.
**Slots:** Porten er `outdoorSeating === true`.
**Merknad:** Attributtet sier ikke NÅR — formen sier verken «i sommer» eller «nå».

### `barnevennlig` — Hvor kan vi spise ute med barna? (S+)

**Hovedform:** `${navn} har barnemeny, ${gangtid} til fots.`
**Utenfor gangavstand:** `Nærmeste spisested med barnemeny på kartet er ${navn}, ${reise}.` (15)
**Flere steder:** `${navn1} og ${navn2} har barnemeny, ${gangtid1} og ${gangtid2} til fots.`
**Ingen treff:** utelat raden.
**Slots:** `menuForChildren === true` gir «har barnemeny» og vinner. Bare `goodForChildren === true`: `${navn} er merket som barnevennlig, ${gangtid} til fots.` — «merket» legger dommen der den hører hjemme, hos kilden, uten å navngi Google i setningen.
**Merknad:** Barnestol og vognplass påstås aldri (*Kilde*).

### `spesialbutikk-mat` — Finnes det spesialbutikk for mat i nærheten? (S+)

**Hovedform:** `${navn} er ${slag}, ${gangtid} til fots.`
**Utenfor gangavstand:** `Nærmeste spesialbutikk for mat på kartet er ${navn}, ${slag}, ${reise}.` (15)
**Flere steder:** `${navn1} er ${slag1} og ${navn2} ${slag2}, ${gangtid1} og ${gangtid2} til fots.`
**Ingen treff:** utelat raden.
**Slots:** slag = `slagAvType`: `seafood_market` → «fiskebutikk», `butcher_shop` → «slakter», `asian_grocery_store` → «asiatisk matbutikk».
**Merknad:** `food_store` alene er for vagt til å love «spesial» og bør ikke kvalifisere uten en av de tre andre typene. SUMART Dagligvare bærer trolig `grocery_store` og dukker ikke opp her — det er `hverdagshandel` sin rad.

---

## 4.5 Natur & friluftsliv

### `hund` — Hvor er nærmeste hundepark? (S)

**Hovedform:** `${navn} er nærmeste hundepark, ${gangtid} til fots.`
**Utenfor gangavstand:** `Nærmeste hundepark på kartet er ${navn}, ${reise}.`
**Flere steder:** hale `${navn2} ligger ${reise2} unna.`
**Ingen treff:** utelat raden.
**Slots:** Kandidater = kategori `hundepark` ELLER `navnefilter` på `park` med `krever: ["hundepark"]` (*Kilde*: begge Wesselsløkka-parkene ligger som `park` til de er omkategorisert).
**Merknad:** Inngjerding påstås aldri — det er derfor spørsmålet sier hundepark og ikke løsområde.

### `ski` — Hvor er nærmeste skiløype? (S+)

**Hovedform:** `${rute} er nærmeste skiløype, ${gangtid} til fots til nærmeste punkt på løypa. Løypa er ${lengde} kilometer${gradering}.`
**Utenfor gangavstand:** `Nærmeste skiløype på kartet er ${rute}, ${reise} til nærmeste punkt på løypa. Løypa er …`
**Flere steder:** ikke relevant — ett spørsmål, én løype.
**Ingen treff:** utelat raden.
**Slots:** rute = rutenavnet fra Turrutebasen (ren tekst, eller `[navn](poi:id)` hvis påkoblingspunktet importeres som POI). gangtid/reise = precomputet til påkoblingspunktet, som for POI-er. lengde = km, én desimal. gradering = `, gradert ${grad}` når Turrutebasens gradering finnes (grønn/blå/rød/svart), ellers tomt.
**Merknad:** «På kartet» forutsetter at løypa tegnes på boardet (trails-laget). skisporet.no er tatt ut, se avvik 2 — og «dagens preparering» er ferskvare uansett.

### `sykkelrute` — Hvor går nærmeste sykkelrute? (S+)

**Hovedform:** `${rute} er nærmeste sykkelrute, ${sykkeltid} på sykkel til påkoblingspunktet. Ruta er ${lengde} kilometer.`
**Utenfor gangavstand:** ikke relevant — man sykler dit.
**Flere steder:** ikke relevant.
**Ingen treff:** utelat raden.
**Slots:** sykkeltid = `minutter(sykkelMinutter(punkt))`. Resten som `ski`.
**Merknad:** Samme kilde og bygger som `turstier`/`ski`, objekttype Sykkelrute. Sykkeltid og ikke gangtid er det som skiller formen fra naboene.

### `tur-med-vogn` — Hvor er nærmeste turvei for barnevogn? (S+)

**Hovedform:** `${rute} er tilrettelagt for ${tilpasning}, ${gangtid} til fots fra boligen, og er ${lengde} kilometer${underlag}.`
**Utenfor gangavstand:** `Nærmeste turvei tilrettelagt for ${tilpasning} på kartet er ${rute}, ${reise}, ${lengde} kilometer${underlag}.`
**Flere steder:** ikke relevant.
**Ingen treff:** utelat raden. Ingen Tilpasning-verdi for kommunen = ingen rad (*Kilde*).
**Slots:** tilpasning = registerets kode i klartekst: B → «barnevogn», R → «rullestol», begge → «barnevogn og rullestol». underlag = `, med ${underlagstype} underlag` når feltet finnes (grus/asfalt).
**Merknad:** En rute merket bare R er farbar med vogn i praksis, men registeret sa ikke B — formen sier «rullestol» og lar leseren trekke slutningen. Det er den ene plassen der DIKTER ALDRI koster litt lesbarhet.

### `lysloype-lopetur` — Hvor er nærmeste lysløype? (S+)

**Hovedform:** `${rute} er nærmeste lysløype, ${gangtid} til fots, med ${belyst} kilometer belyst strekning.`
**Utenfor gangavstand:** `Nærmeste lysløype på kartet er ${rute}, ${reise}, med ${belyst} kilometer belyst strekning.`
**Flere steder:** ikke relevant.
**Ingen treff:** utelat raden.
**Slots:** belyst = belyst lengde i km, én desimal — ALDRI hele lengden når bare deler er belyst (*Kilde*).
**Merknad:** Turrutebasens `belysning=Ja` på Fotrute eller Skiløype. Om det er ski- eller fotrute nevnes ikke; spørsmålet er «lysløype», og løperen bruker begge om vinteren.

### `akebakke` — Hvor er nærmeste akebakke? (K)

**Form prosjektet fyller ut:** `${navn} er nærmeste akebakke${gangtid}.`
**Ingen treff:** ingen kuratert tekst = ingen rad.
**Slots:** navn = kurators eget stedsnavn. gangtid = `, ${minutter(walkMinutes(poi))} til fots` BARE når akebakken finnes som POI på boardet med målt tid — kurators eget minuttall er ikke tillatt i standardformen (tall som ikke er målt, skrives ikke).
**Merknad:** Kurator kan legge til én setning om hvor bakken ligger («i Spruten friområde»). Navnesøket «akebakke» er heuristikk (*Kilde*) og bygger ingen rad av seg selv.

---

## 4.6 Transport

### `frekvens` — Hvor ofte er det avganger på hverdager? (S+)

**Hovedform:** `Mellom 07 og 09 på hverdager går det ${rush} avganger mot ${retning} fra ${holdeplass}, og ${kveld} mellom 19 og 21.`
**Utenfor gangavstand:** ikke relevant.
**Flere steder:** ikke relevant — én holdeplass, én retning (*Kilde*).
**Ingen treff:** utelat raden når ett av vinduene ikke er telt. **`0` i kveldsvinduet er et tall og skrives** — Enturs avgangsliste er komplett for én valgt dato, og «0 avganger» er etterprøvbart hos Entur. Det er ikke poolens recall-problem, det er en rutetabell.
**Slots:** rush/kveld = antall avganger i vinduet — **ikke per time**. Katalogen sier «ganger i timen», men et to-timers vindu delt på to gir halve avganger; tellingen i vinduet er det tallet leseren kan slå opp. retning = `destinations[0]` for quayen, holdeplass = `poiLink`.
**Merknad:** Retningen som telles er quayen hvis linjer overlapper med `cityCentre.patterns[0].lines` — sentrumsretningen. Finnes ikke overlappet, den quayen med flest avganger. Åpner «Mellom» fordi `linjer` alt åpner «Fra ${holdeplass} går».

### `til-arbeidsplassene` — Hvor lang tid tar det til de store arbeidsplassene? (S+)

**Hovedform:** `Reisen til ${maal1} tar ${min1} minutter${linje1}, og til ${maal2} ${min2} minutter${linje2}.`
**Utenfor gangavstand:** ikke relevant.
**Flere steder:** hovedformen er to. **Variant med tre**, hvis avvik 1 avgjøres slik: `Reisen til ${maal1} tar ${min1} minutter${linje1}, til ${maal2} ${min2} minutter${linje2} og til ${maal3} ${min3} minutter${linje3}.`
**Ingen treff:** utelat raden. Mangler ett reisemål mønster, utelates det målet.
**Slots:** maal = destinasjonsnavnet fra konfigurasjonen. min = `pattern.minutes`. linje = ` med linje ${ogJoin(lines)}` eller ` til fots` når lista er tom — nøyaktig som `cityCentreSentence`.
**Merknad:** Åpner «Reisen til» fordi `tilSentrum` alt åpner «Til ${sentrum} tar det». Destinasjonslista er per by og ligger i samme `destinations`-array som sentrum og videregående (*Kilde*).

### `siste-buss` — Når går siste avgang hjem fra sentrum? (S+)

**Hovedform:** `Siste avgang fra ${sentrumsstopp} til ${holdeplass} går ${tidHverdag} på hverdager, med ${linjeHverdag}. Natt til lørdag og søndag går den ${tidHelg}${linjeHelg}.`
**Utenfor gangavstand:** ikke relevant.
**Flere steder:** ikke relevant. Bare én ukedagstype lagret: første setning alene.
**Ingen treff:** utelat raden.
**Slots:** tid = klokkeslett i døgnform — «23.45», «00.30». linjeHelg = `, med linje ${x}` BARE når nattlinja er en annen enn dagslinja (*Kilde*: nattavgangene i Trondheim er ofte andre linjer). holdeplass = den Entur-reisen ender på, med `poiLink`.
**Merknad:** `klokkeslett` gir «midnatt» for 1440 og har ingen form for tider etter midnatt — nattavganger trenger en variant `klokkeslettDøgn` som skriver «00.30». Det er modus-nøytralt i teksten («avgang», ikke «buss») selv om id-en sier buss.

### `sykkel-til-byen` — Hvor lang tid tar det å sykle til sentrum? (S+)

**Hovedform:** `Sykkelturen til ${sentrum} tar ${sykkeltid}.`
**Utenfor gangavstand:** ikke relevant.
**Flere steder:** valgfri hale når `bike`-kategorien har et stativ på boardet (leses via `allPois`): `Nærmeste bysykkelstativ, ${stativ}, ligger ${gangtid} til fots.`
**Ingen treff:** utelat raden.
**Slots:** sentrum = `cityCentre.name`. sykkeltid = `minutter(cityCentre.bikeMinutes)` — nytt S+-felt på `cityCentre` fra Mapbox cycling, samme rutemotor som POI-tidene.
**Merknad:** Åpner «Sykkelturen» av samme grunn som `til-arbeidsplassene` unngår «Til». Byen har ikke bysykkel? Ingen hale, ingen rad om det.

### `bil-til-byen` — Hvor lang tid tar det med bil til sentrum? (S+)

**Hovedform:** `Kjøreturen til ${sentrum} tar ${biltid} utenom rush.`
**Utenfor gangavstand / Flere steder:** ikke relevant.
**Ingen treff:** utelat raden.
**Slots:** biltid = `minutter(cityCentre.carMinutes)` — samme Mapbox-kall som sykkel, profil driving.
**Merknad:** «Utenom rush» er kallets forutsetning og må stå, ellers lover tallet mer enn kilden. Katalogens «parkering inngår ikke» er tatt ut — generell setning uten adressefakta.

---

## 4.7 Trening & aktivitet

### `idrettsanlegg` — Hvor finnes baner og idrettshaller i nærheten? (S)

**Hovedform:** `${navn} er nærmeste idrettsanlegg, ${gangtid} til fots.`
**Utenfor gangavstand:** `Nærmeste idrettsanlegg på kartet er ${navn}, ${reise}.`
**Flere steder:** hale med nærmeste HALL når det nærmeste anlegget er en bane: `${hall} er nærmeste idrettshall, ${reise2}.` Er det nærmeste alt en hall: `${bane} er nærmeste bane, ${reise2}.`
**Ingen treff:** utelat raden.
**Slots:** Kandidater = kategori `idrett` fra **`allPois`** — kategorien ligger i Oppvekst-temaet, ikke Trening (§ 5 pkt 8). hall = `navnefilter` med `krever: ["hall", "arena"]`, `utelukker: ["svømme"]`. navn = `namedPoi` — anker-familien for idrett gir «Bingen i Leangen idrettspark» gratis.
**Merknad:** Spørsmålet nevner BÅDE baner og haller; formen svarer med én av hver når begge finnes, og det er de to navngitte stedene. Ingen antall («11 anlegg innenfor et kvarter») — ankere teller som én på kartet og tallet ville ikke stemt med det leseren ser.

### `spesialtrening` — Finnes det yoga, kampsport eller klatring her? (S+)

**Hovedform:** `${navn} tilbyr ${slag}, ${gangtid} til fots.`
**Utenfor gangavstand:** `Nærmeste sted med ${slag} på kartet er ${navn}, ${reise}.` (15, *Kilde*)
**Flere steder:** `${navn1} tilbyr ${slag1} og ${navn2} ${slag2}, ${gangtid1} og ${gangtid2} til fots.` — to ULIKE slag foretrekkes.
**Ingen treff:** utelat raden.
**Slots:** slag = `slagAvType`: `yoga_studio` → «yoga», `martial_arts_school`/`boxing_gym` → «kampsport», `climbing_gym` → «klatring».
**Merknad:** Bare de idrettene som faktisk er funnet navngis. Aldri «yoga, kampsport og klatring» som påstand om alle tre — det er spørsmålets liste, ikke svarets.

### `padel-tennis` — Hvor kan jeg spille padel, tennis eller squash? (S+)

**Hovedform:** `${navn} har ${sport}, ${reise}.`
**Utenfor gangavstand:** `Nærmeste sted for ${sport} på kartet er ${navn}, ${reise}.` — dette er normalen; anleggene ligger langt, og `reisetid` gir sykkel eller bil.
**Flere steder:** hale `${navn2} har ${sport2}, ${reise2}.` — helst en annen idrett enn den første.
**Ingen treff:** utelat raden.
**Slots:** sport = idrettene taggen bærer, `ogJoin` når ett anlegg har flere («padel og tennis»). Fra OSM `sport=*` eller Google-type på `idrett`-POI-er.
**Merknad:** Vis bare idrettene som er funnet (*Kilde*). I dag er anleggene bare identifiserbare på navn; formen tåler navneporten som mellomløsning, men typetaggen er det som gjør den S+.

### `is-skoyter` — Hvor er nærmeste ishall eller skøytebane? (S+)

**Hovedform:** `${navn} er nærmeste ${slag}, ${reise}.`
**Utenfor gangavstand:** `Nærmeste ${slag} på kartet er ${navn}, ${reise}.`
**Flere steder:** hale `${navn2} er nærmeste ${slag2}, ${reise2}.` når slaget er et annet, ellers `${navn2} ligger ${reise2} unna.`
**Ingen treff:** utelat raden.
**Slots:** slag = «ishall» når OSM `covered=yes`/`building=*` eller navnet bærer «hall»/«arena», ellers «skøytebane».
**Merknad:** Sesong påstås aldri — en skøytebane i juli er fortsatt nærmeste skøytebane. Publikumstider er ikke i kilden (*Kilde*).

### `gruppetrening` — Hvor kan jeg bli med på gruppetrening? (K)

**Form prosjektet fyller ut:** `${senter} har gruppetimer${typer}, ${gangtid} til fots. ${adgang}.`
**Ingen treff:** ingen kuratert tekst = ingen rad.
**Slots:** senter = `namedPoi` for gym-POI-en når den er på boardet (da er gangtiden pipelinens); ellers kurators navn uten tall. typer = ` i ${liste}` («i yoga, spinning og styrke»), kurators ord. adgang = kurators ene setning om vilkår: «Timene krever medlemskap» / «Drop-in er mulig».
**Merknad:** Timeplan og pris er ferskvare og hører ikke i et kuratert svar (`ReportFaqAnswer`-regelen).

---

## 4.8 Opplevelser

### `bibliotek` — Hvor er nærmeste bibliotek? (S)

**Hovedform:** `${navn} er nærmeste ${slag}, ${gangtid} til fots.`
**Utenfor gangavstand:** `Nærmeste ${slag} på kartet er ${navn}, ${reise}.`
**Flere steder:** hale `${navn2} ligger ${reise2} unna.`
**Ingen treff:** utelat raden.
**Slots:** slag = «folkebibliotek» når navnet bærer ordet, ellers «bibliotek». reise = `reisetid(poi)`.
**Merknad — filteret er et krav:** `navnefilter` på `library` med `utelukker: ["ntnu", "universitet", "høgskole", "høyskole", "fylkesbibliotek", "forsknings", "marin", "skolebibliotek", "institutt", "fakultet"]`. Det er en **ekskluderingsliste med vilje**: en allowlist på «bibliotek» ville tatt hele Oslo, der filialene heter «Deichman Grünerløkka» uten ordet i navnet. Lista fjerner de kjente feilene (NTNU Marinbiblioteket, Trøndelag fylkesbibliotek); det ærlige S+-skrittet er Nasjonalbibliotekets Base Bibliotek med `bibliotektype = folkebibliotek`, som katalogen alt navngir.

### `kino` — Hvor er nærmeste kino? (S)

**Hovedform:** `${navn} er nærmeste kino, ${gangtid} til fots.`
**Utenfor gangavstand:** `Nærmeste kino på kartet er ${navn}, ${reise}.` — «Nova Kinosenter, 38 minutter til fots eller 15 med bil».
**Flere steder:** hale `${navn2} ligger ${reise2} unna.`
**Ingen treff:** utelat raden.
**Slots:** navn = `namedPoi`. reise = `reisetid(poi)`.
**Merknad:** Bussreisen til kinoen er ikke målt — Entur-tallet i `cityCentre` gjelder Trondheim S og skal ikke gjenbrukes (*Kilde*). Kino traff riktig på Wesselsløkka; ingen filter.

### `kirke` — Hvor er nærmeste kirke eller menighetshus? (S)

**Hovedform:** `${navn} er nærmeste ${slag}, ${gangtid} til fots.`
**Utenfor gangavstand:** `Nærmeste ${slag} på kartet er ${navn}, ${reise}.`
**Flere steder:** hale `${navn2} ligger ${reise2} unna.`
**Ingen treff:** utelat raden.
**Slots:** slag = ordet navnet bærer: «kirke», «kapell», «menighetshus», «bedehus», «kirkesenter»; bærer navnet ingen av dem, «kirke».
**Merknad — filteret er et krav:** `navnefilter` på `kirke` med `utelukker: ["sykehjem", "bo- og service", "helsehus", "sykehus", "omsorgssenter", "krematorium", "gravlund", "gravplass", "kirkegård"]`. Zion bo- og servicesenter kapell faller på det andre ordet, og et gravlundskapell er heller ikke en menighet med åpne tilbud. Menighetshusets faste tilbud (kor, formiddagstreff) er K (*Kilde*) og står ikke her.

### `museum` — Hvor er nærmeste museum? (S)

**Hovedform:** `${navn} er nærmeste museum, ${gangtid} til fots.`
**Utenfor gangavstand:** `Nærmeste museum på kartet er ${navn}, ${reise}.`
**Flere steder:** hale `${navn2} ligger ${reise2} unna.` — *Kilde* ber om «to neste»; regel 5 gir én, se avvik 1.
**Ingen treff:** utelat raden.
**Slots:** navn = `namedPoi`. reise = `reisetid(poi)`.
**Merknad — filteret er et krav:** kvalifiserer bare når navnet bærer «museum», «museet», «musea», «samling», «galleri» eller «kunsthall», ELLER stedet har cachede åpningstider. Berlin Wall Segments har ingen av delene; et museum med publikum har begge. Åpningstidene er stedfortreder for «åpent for publikum» — feltet katalogen sier ikke finnes i poolen.

### `kulturscene` — Hvor er nærmeste scene eller kulturhus? (S+)

**Hovedform:** `${navn} er nærmeste ${slag}, ${gangtid} til fots.`
**Utenfor gangavstand:** `Nærmeste ${slag} på kartet er ${navn}, ${reise}.`
**Flere steder:** hale med nærmeste ARENA når den finnes (*Kilde*: «nærmeste scene + nærmeste arena»): `${arena} er nærmeste arena, ${reise2}.` Ingen arena: `${navn2} ligger ${reise2} unna.`
**Ingen treff:** utelat raden.
**Slots:** slag = `slagAvType`: `performing_arts_theater` → «teater», `concert_hall` → «konsertsal», `cultural_center` → «kulturhus»; ukjent → «scene». arena = `idrett`-POI med `navnefilter` `krever: ["arena", "stadion"]`, fra `allPois`.
**Merknad:** Olavshallen bærer alle tre typene; `primaryType` avgjør ordet. Program påstås aldri — «Hva som spilles der» er ikke i kilden, og setningen om det er tatt ut (avvik 2).

### `frivilligsentral` — Hvor er nærmeste frivilligsentral? (S+)

**Hovedform:** `${navn} er nærmeste frivilligsentral, ${gangtid} til fots.`
**Utenfor gangavstand:** `Nærmeste frivilligsentral på kartet er ${navn}, ${reise}.`
**Flere steder:** hale `${navn2} ligger ${reise2} unna.`
**Ingen treff:** utelat raden.
**Slots:** navn = `poiLink` for den importerte sentralen. reise = `reisetid(poi)`.
**Merknad:** Valgfri fast hale «Sentralen er åpen for alle som vil delta eller bidra.» — anbefalt droppet, se avvik 3; det er sentralenes mandat og står likt overalt.

### `bowling-aktivitet` — Hvor kan vi spille bowling? (S+)

**Hovedform:** `Dere kan spille bowling hos ${navn}, ${gangtid} til fots.`
**Utenfor gangavstand:** `Nærmeste bowlinghall på kartet er ${navn}, ${reise}.`
**Flere steder:** hale `${navn2} er alternativet, ${reise2} unna.`
**Ingen treff:** utelat raden.
**Slots:** navn = `namedPoi`. reise = `reisetid(poi)`.
**Merknad:** Kategorien `bowling` fikk produsent i dag (`bowling_alley`) og fylles ved neste provisjonering. «Dere» speiler spørsmålets «vi» — den ene raden i katalogen som stilles i flertall.

### `samlingspunkt` — Hvilke møteplasser er åpne for alle? (K)

**Form prosjektet fyller ut:** `${sted} er ${rolle}${gangtid}. ${sted2} ${status2}.`
**Ingen treff:** ingen kuratert tekst = ingen rad.
**Slots:** sted = `namedPoi` når stedet er en POI på boardet (gangtid = `, ${minutter} til fots` fra pipelinen), ellers kurators navn uten tall. rolle = kurators ord: «bydelens åpne møteplass i dag». sted2/status2 = det planlagte (torget i områdeplanen) eller fellesrommet MED adgangsvilkår i klartekst (*Kilde*: skill eksisterende, planlagt og beboer-fellesrom).
**Merknad:** Standarden bidrar bare med gangtider til steder som finnes på kartet. Absorberer `stamsted`.

### `voksenaktivitet` — Hvor kan jeg bli med på kor, kurs eller klubb? (K)

**Form prosjektet fyller ut:** `${arrangor} tar imot nye deltakere til ${aktivitet}. Øvingene er på ${sted}${gangtid}.`
**Ingen treff:** ingen kuratert tekst = ingen rad.
**Slots:** arrangor, aktivitet = kurators ord («Strinda kammerkor», «kor»). sted = `namedPoi` når øvingsstedet er en POI (gangtid fra pipelinen), ellers navn uten tall.
**Merknad:** Påmelding, pris og øvingsdag er ferskvare og hører ikke her. Kurators valgfrie tredje setning er veien inn («Påmelding hos arrangøren»), uten adresse eller telefonnummer.

### `kulturskole` — Hvor går barna på kulturskole? (K)

**Form prosjektet fyller ut:** `${kulturskole} underviser i ${fag} på ${sted}${gangtid}.`
**Ingen treff:** ingen kuratert tekst = ingen rad.
**Slots:** kulturskole = kommunens kulturskolenavn. fag = kurators liste, `ogJoin` («musikk, dans og teater»). sted = **undervisningsstedet i bydelen** (skolen der timene holdes), `namedPoi` når det er en POI, ellers navn uten tall.
**Merknad:** Administrasjonsadressen er det registeret gir, og det er ikke svaret (*Kilde*). Søknad, pris og ventetid er tatt ut — ferskvare og eksterne lenker.

---

## Bonus: ordlyden på alle 80

Kriteriet var om en boligkjøper kjenner igjen sitt eget spørsmål. 71 av 80 gjør det. Ni ville jeg endret; hver kan avgjøres for seg. Id-ene rører jeg ikke.

| id | Står i katalogen | Forslag | Hvorfor |
|---|---|---|---|
| `vgs-naerhet` | Hvilke videregående skoler kan jeg nå med buss? | Hvilke videregående skoler er raskest å nå? | Katalogens egen regel 7 gjorde alle transport-spørsmålene modus-nøytrale — og lot «med buss» stå her. På en Oslo-adresse er svaret T-bane, og byggeren rangerer alt på reisetid uansett modus. |
| `barnevennlig` | Hvor kan vi spise ute med barna? | Hvor kan vi ta med barna på restaurant? | Står rett under `sitte-ute`, som betyr utendørs. Da leses «spise ute» som utendørs her også, og to rader ser ut som samme spørsmål. |
| `spesialbutikk-mat` | Finnes det spesialbutikk for mat i nærheten? | Finnes det fiskebutikk, slakter eller internasjonal matbutikk her? | «Spesialbutikk for mat» er kategoriens navn, ikke kjøperens ord. `spesialtrening` bruker alt mønsteret med tre konkrete ord — det virker. |
| `marka` | Hvor lang tid tar det til marka? | Hvor lang tid tar det til nærmeste turområde? | Katalogen er ÉN nasjonal. «Marka» er Oslo og Trondheim; i Bergen heter det fjellet, i Tromsø noe tredje. Naturbase-kilden heter «Store turområder», så forslaget ER kildens ord. |
| `pakker-post` | Hvor er nærmeste Post i butikk? | Hvor henter jeg pakker fra Posten? | Kjøperen spør med verbet «hente». «Fra Posten» beholder innsnevringen til det Bring-API-et bærer, som var grunnen til at teksten ble snevret. |
| `regnvaersdag` | Hva finnes innendørs i nærheten? | Hva finnes innendørs når det regner? | Innsnevringen fra «Hva gjør vi» til «Hva finnes» er riktig (kilden skiller ikke drop-in fra booking). Men uten regnet er spørsmålet ikke lenger noe noen stiller — id-en sier hva det handler om, teksten bør også. |
| `krets` | Hvilken skolekrets sogner boligen til? | Hvilken skole sogner boligen til? | Forelderen spør om skolen, ikke om kretsen; kretsen er meglerens mellomregning. «Sogner» beholdes — det er ordet svaret alt bruker, og det er presist. |
| `treningspark` | Er det utendørs treningspark? | Finnes det treningsapparater utendørs? | «Treningspark» er kommunens anleggsord. Den som skal komme i gang sier «apparater» eller «tufteparken». Middels sikker — behold hvis `faq_opened` viser at raden åpnes. |
| `samlingspunkt` | Hvilke møteplasser er åpne for alle? | Hvor møtes folk i nabolaget? | «Åpne for alle» er skillet KURATOREN skal gjøre i svaret (eksisterende / planlagt / beboer-fellesrom), ikke spørsmålet kjøperen stiller. Det var også `stamsted`-formuleringen som ble slått inn her. Middels sikker. |

Én ting til på ordlyd, som ikke er et forslag men et funn: **15 av de 34 eksisterende id-ene har en annen spørsmålstekst i `category-specs.ts` enn i katalogen** (`gangavstand`, `idrettslag`, `kafe`, `lading`, `linjer`, `marka`, `oppvekst-fritid`, `rolig`, `sfo`, `sondagsapent`, `tog`, `turstier`, `uteliv`, `uten-bil`, `vgs-naerhet` — tallet er regnet maskinelt mot begge filene). Katalogens § 7 pkt 2 har det som eget steg; formene over bruker katalogens tekster.
