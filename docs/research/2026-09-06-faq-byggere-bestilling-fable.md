# Bestilling: setningsformer til 46 FAQ-byggere

**Dato:** 2026-09-06
**Til:** Fable, i egen sesjon
**Fra:** Opus-sesjonen som åpnet Opplevelser-temaet (commit `05a48d7`)
**Kilde du skal lese først:** `docs/research/2026-09-06-faq-katalog-sammenslatt.md`

---

## Hva du skal levere

**Setningsformene** til 46 FAQ-byggere. Ikke svarene.

Et FAQ-svar på Placy-boardet skrives ikke — det regnes ut fra dataen på den
adressen. Byggeren for apotek ser slik ut i sin helhet:

```ts
function apotek(input: FaqGeneratorInput): string | undefined {
  const [naermest] = naermesteMedTid(input, "pharmacy");
  if (!naermest) return undefined;
  return `${namedPoi(naermest)} ligger ${minutter(walkMinutes(naermest)!)} unna.`;
}
```

Én linje er prosa. Resten er oppslag, og `if (!naermest) return undefined` er
linja som gjør at boardet aldri dikter: mangler faktumet, utelates raden.

Du skriver **den ene prosalinja**, per spørsmål, i alle formene den trenger.
Noen andre skriver oppslaget, porten og testen rundt den.

### Leveranseformat per spørsmål

```
### `id` — Spørsmålsteksten som står i katalogen

**Hovedform:**    Én setning med {slots} i krøllparentes.
**Utenfor gangavstand:**  Formen når nærmeste ligger over radiusen (se regel 4).
**Flere steder:**  Formen når svaret navngir to (aldri flere enn to).
**Ingen treff:**   Skriv «utelat raden» — med mindre du mener noe annet, og si da hvorfor.
**Slots:**        Hver {slot} forklart: hva den inneholder og hvilken type.
**Merknad:**      Bare når noe i katalogens *Kilde*-linje endrer formen.
```

Skriv formene som template-literaler slik de skal se ut i koden, med norske
slot-navn. Eksempel på formen jeg forventer:

```
**Hovedform:** `${navn} ligger ${gangtid} unna.`
**Slots:** navn = `namedPoi(poi)` — POI-navn, kan bære lenke og «i Valentinlyst Senter».
           gangtid = `minutter(w)` — «8 minutter» / «ett minutt».
```

---

## De ufravikelige reglene

Disse er ratifisert i katalogen (§2) og gjelder hver eneste form du skriver.

1. **DIKTER ALDRI.** Ingen påstand uten et faktum bak. Kan ikke dataen bære
   setningen, skal raden utelates — ikke omskrives til noe vagere.
2. **Bare positive påstander.** Aldri «det finnes ingen X i nabolaget». Poolen
   er recall-begrenset: fravær i dataen er ikke fravær i verden. Vi kan si hva
   som ER der, aldri hva som ikke er det.
3. **Første setning svarer.** Leseren skal ha svaret før hun har lest ferdig.
   40–60 ord totalt.
4. **Nærhet må være sann.** Lover formen «i nabolaget» eller «i nærheten», må
   stedet ligge innenfor radiusen. Utenfor skal formen scopes til kartet:
   «Nærmeste kafé **på kartet** er …». Radiene i koden: `WALK_RADIUS_MIN = 10`
   (ærendsavstand til fots), `DINING_RADIUS_MIN = 15` (servering, der
   spørsmålet er «slipper jeg å dra til byen»).
5. **Maks to navngitte steder** per svar (`MAX_NAMED = 2`). Flere blir en liste
   leseren ikke leser.
6. **Én svarform per spørsmål-id.** Samme spørsmål skal se likt ut på alle
   1 000 boards. Varianter er for datatilfeller, ikke for variasjon.
7. **Ingen vurderinger.** «Godt utvalg», «hyggelig», «barnevennlig nabolag» er
   dommer. Kilden leverer steder og tall.
8. **Tall som kan etterprøves.** Nevner du et antall, må leseren kunne telle
   det samme på kartet.

---

## Hjelperne du kan bruke i slots

Disse finnes i `lib/generators/faq-generator.ts` og skal brukes framfor rå felt.

| Hjelper | Gir |
|---|---|
| `namedPoi(poi)` | Stedets navn, klikkbart. Ligger det inne i et kjøpesenter, blir det «Boots Apotek i Valentinlyst Senter» og lenker til senteret. |
| `minutter(w)` | «8 minutter», «ett minutt». |
| `walkMinutes(poi)` | Precomputet gangtid, eller `undefined`. |
| `erINaerheten(poi)` | Sann når gangtiden er ≤ `WALK_RADIUS_MIN`. |
| `naermesteMedTid(input, ...kategorier)` | POI-ene i kategoriene, sortert på gangtid, uten dem som mangler tid. |
| `ogJoin(items)` | «A, B og C». |
| `hverdagstider(poi)` | Man–fre-åpningstid når alle fem er like, ellers `null`. |
| `roundedMeters(m)` | Avstand i runde tall. |
| `cleanSchoolName(navn)` | Registerformen ned til det folk sier. |

Du kan foreslå en ny hjelper hvis en form trenger den. Si hva den skal gjøre.

---

## Tre filtre som er krav, ikke ønsker

Målt på Wesselsløkka-boardet 2026-09-06, etter at Opplevelser ble åpnet. Tre
av fire «nærmeste» er feil sted, og formene dine må ta høyde for det:

- **`bibliotek`:** nærmeste er «NTNU Marinbiblioteket», 13 minutter — et
  forskningsbibliotek som ikke låner ut til publikum. Katalogen sier eksplisitt
  at bare utlånsbibliotek skal telle. Formen må kunne si hva slags bibliotek
  det er, og byggeren må kunne utelate resten.
- **`museum`:** nærmeste er «Berlin Wall Segments», 33 minutter — et monument,
  ikke et museum med åpningstid.
- **`kirke`:** nærmeste er «Zion bo- og servicesenter kapell», 7 minutter — et
  sykehjemskapell, ikke en menighet med åpne tilbud.

Bare `kino` (Nova Kinosenter, 38 minutter) traff riktig. Fellesnevneren er at
Google-kategorien er bredere enn spørsmålet. Der katalogens *Kilde*-linje
nevner et slikt filter, skal formen tåle at det finnes.

---

## De 46

Hvert spørsmål har en full spesifikasjon i katalogen: *Hvorfor*, *Kilde* (som
sier hva dataen faktisk bærer) og et Wesselsløkka-eksempel. **Les
Kilde-linja for hvert enkelt før du skriver formen** — den avgjør hva setningen
har lov til å love.

Klassene: **S** = bygges av data boardet har i dag. **S+** = trenger én
navngitt ny kilde, som står i Kilde-linja. **K** = kuratert, ingen bygger —
der skriver du formen prosjektet skal fylle ut, ikke et svar.

Eksempeltallene i katalogen er regnet ut FØR radtak-fiksen 2026-09-06 og er
ikke til å stole på som tall. Formen de viser er fortsatt gyldig.

### 4.1 Området (startsiden)
- S  `tjenester-samme-sted` — Hvor kan jeg samle flere ærender på én tur?
- S  `regnvaersdag` — Hva finnes innendørs i nærheten?
- S+ `blir-det-bygget` — Er det nye reguleringsplaner i nærheten?
- S+ `hvem-bor-her` — Hvem bor i nabolaget?
- K  `ferdig-ved-innflytting` — Hva er klart ved innflytting?

### 4.2 Barn & oppvekst
- S  `skolevei` — Hvor lang er skoleveien til fots?
- S  `barnehage-alder` — Tar barnehagene i nærheten imot ettåringer?
- S+ `skoleskyss` — Har barna rett på gratis skoleskyss?
- S+ `helsestasjon` — Hvor er nærmeste helsestasjon?

### 4.3 Hverdagsliv
- S  `legesenter` — Hvor er nærmeste legesenter?
- S+ `pakker-post` — Hvor er nærmeste Post i butikk?
- S+ `dagligvare-lengst-apent` — Hvor sent kan jeg handle mat på hverdager?
- S+ `dagligvare-sondag` — Hvor kan jeg handle dagligvarer på søndag?
- S+ `vinmonopol` — Hvor er nærmeste Vinmonopol?
- S+ `legevakt-sykehus` — Hvor er nærmeste legevakt?

### 4.4 Mat & drikke
- S  `pizza` — Hvor er nærmeste pizzasted?
- S+ `takeaway` — Hvor henter jeg takeaway?
- S+ `sitte-ute` — Hvor kan jeg sitte ute og spise?
- S+ `barnevennlig` — Hvor kan vi spise ute med barna?
- S+ `spesialbutikk-mat` — Finnes det spesialbutikk for mat i nærheten?

### 4.5 Natur & friluftsliv
- S  `hund` — Hvor er nærmeste hundepark?
- S+ `ski` — Hvor er nærmeste skiløype?
- S+ `sykkelrute` — Hvor går nærmeste sykkelrute?
- S+ `tur-med-vogn` — Hvor er nærmeste turvei for barnevogn?
- S+ `lysloype-lopetur` — Hvor er nærmeste lysløype?
- K  `akebakke` — Hvor er nærmeste akebakke?

### 4.6 Transport
- S+ `frekvens` — Hvor ofte er det avganger på hverdager?
- S+ `til-arbeidsplassene` — Hvor lang tid tar det til de store arbeidsplassene?
- S+ `siste-buss` — Når går siste avgang hjem fra sentrum?
- S+ `sykkel-til-byen` — Hvor lang tid tar det å sykle til sentrum?
- S+ `bil-til-byen` — Hvor lang tid tar det med bil til sentrum?

### 4.7 Trening & aktivitet
- S  `idrettsanlegg` — Hvor finnes baner og idrettshaller i nærheten?
- S+ `spesialtrening` — Finnes det yoga, kampsport eller klatring her?
- S+ `padel-tennis` — Hvor kan jeg spille padel, tennis eller squash?
- S+ `is-skoyter` — Hvor er nærmeste ishall eller skøytebane?
- K  `gruppetrening` — Hvor kan jeg bli med på gruppetrening?

### 4.8 Opplevelser
- S  `bibliotek` — Hvor er nærmeste bibliotek?  ← filter, se over
- S  `kino` — Hvor er nærmeste kino?
- S  `kirke` — Hvor er nærmeste kirke eller menighetshus?  ← filter, se over
- S  `museum` — Hvor er nærmeste museum?  ← filter, se over
- S+ `kulturscene` — Hvor er nærmeste scene eller kulturhus?
- S+ `frivilligsentral` — Hvor er nærmeste frivilligsentral?
- S+ `bowling-aktivitet` — Hvor kan vi spille bowling?
- K  `samlingspunkt` — Hvilke møteplasser er åpne for alle?
- K  `voksenaktivitet` — Hvor kan jeg bli med på kor, kurs eller klubb?
- K  `kulturskole` — Hvor går barna på kulturskole?

---

## Rekkefølge, hvis du vil dele opp

De 12 **S**-spørsmålene først: de bygges av data boardet har i dag, så de kan
implementeres og testes umiddelbart etter at du leverer. `theatre` og `bowling`
er unntaket i Opplevelser — kildene ble lagt inn i dag, men kategoriene fylles
først ved neste provisjonering.

## Hva du IKKE skal gjøre

- **Ikke skriv svar for Wesselsløkka** eller noe annet konkret board. Du har
  ikke sett dataen, og et svar du skriver er per definisjon diktet.
- **Ikke endre spørsmålsteksten** uten å si det eksplisitt og begrunne det.
  Id-en er kontrakten mellom bygger, kurator og framtidig chat.
- **Ikke foreslå nye id-er.** Katalogen er ratifisert.
- **Ikke skriv kode.** Setningsformer og slots. Implementasjonen skjer et annet
  sted, mot tester.

## Bonusoppdrag, hvis du har kapasitet

En gjennomgang av **ordlyden på alle 80** spørsmålene i katalogen — ikke bare
de 46. Kriteriet er om en boligkjøper ville kjent igjen sitt eget spørsmål i
formuleringen. Lever som en liste over de du ville endret, med forslag og
begrunnelse, slik at endringen kan avgjøres per spørsmål.
