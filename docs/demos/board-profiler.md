# Board-profiler og strukturert prosjektkunnskap

**Status:** `housing-development` er implementert. `resale` og `commercial` er dokumenterte grenser, ikke tilgjengelige valg.
**Kode:** `lib/demo/local-board/profiles.ts`, `lib/demo/local-board/development.ts`, `lib/demo/local-board/schema.ts`.
**Sist oppdatert:** 2026-09-18.

## Hva profilen er, og hva den ikke er

Profilen sier hva slags **kunnskap** et datasett må bære. Den sier ingenting om hvordan flaten ser ut.

Boardet har allerede to ord som lett forveksles med den:

| Begrep | Hvor det bor | Hva det avgjør |
|---|---|---|
| `boardMode` | flatens tilstand | hvilken visning som er aktiv |
| `venueType` | prosjektet | hva slags sted markøren står på |
| `profile` | `board.json` | hvilke kunnskapsbegreper datasettet må ha innhold til |

Blandes de sammen, blir «hvordan ser flaten ut» og «hva må være kildekontrollert» samme spørsmål — og da arver et nytt datasett enten alt eller ingenting fra det forrige.

## De tre profilene

**`housing-development` (boligprosjekt) — implementert.**
Bygg, fasiliteter og uteområder under utvikling. Må kunne skille byggestatus fra åpning, forventet tidspunkt fra bekreftet dato, og adgang fra tilgjengelighet. Må kunne bære at kildene spriker.

**`resale` (bruktbolig) — ikke implementert.**
Boligen slik den står i dag og nabolaget rundt: boligens egne opplysninger, skolekrets, nærtilbud og hverdagsavstander. Ingen byggestatus, ingen innflyttingskobling. Trenger i stedet begreper for boligens egne data, som denne leveransen ikke har definert.

**`commercial` (næring) — ikke implementert.**
Bygget og virksomhetene i det: arealer, leietakere, adkomst, åpningstider og fellesfunksjoner. Adgang handler om leietakere og besøkende, ikke om beboere.

Et datasett som oppgir en uimplementert profil **lastes ikke**. Feilen navngir profilen, sier at den er dokumentert men ikke implementert, og lister de implementerte. Alternativet — å la den laste og bli behandlet som et boligprosjekt — ville gitt en demo som later som den har kunnskap ingen har bygd.

## Felles mot profilspesifikt

**Felles for alle profiler:** kartet, kategoriene, stedskortene, spørsmål og svar, presentasjonen, kilderegisteret, kontrolldato og forbehold. Kort sagt hele `board.json`, `sources.json`, `places.json`, `faq.json` og resten av `topics.json`.

**Profilspesifikt i dag:** `development`-objektet på et tema, som bare `housing-development` bruker. Det er et valgfritt felt, så de andre profilene får ikke et tomt skall de må fylle.

## Evidence-modellen: `development` på et tema

Objektet ligger på et tema i `topics.json` og ikke i en egen fil, fordi et bygg eller en fasilitet **allerede er** temakunnskap: en tittel, en tekst, kilder og en kontrolldato. Det som mangler for et boligprosjekt er skillet mellom de fire opplysningene som ligner på hverandre.

| Felt | Verdier | Betydning |
|---|---|---|
| `objectType` | `project`, `building`, `facility`, `outdoor-area` | Hva objektet er. |
| `buildStatus` | `existing`, `under-construction`, `planned`, `adopted-plan`, `vision`, `unresolved` | Byggets egen status. **Ikke** det samme som åpning eller adgang. |
| `buildStatusClaimId` | id i `claims` | Påstanden statusen hviler på. |
| `availability` | `open`, `not-open`, `expected`, `unknown` | Er tilbudet åpnet? Gjelder den konkrete fasiliteten. |
| `availabilityClaimId` | id i `claims` | **Påkrevd når `availability` er `open`.** At noe er åpent må ha kilde. |
| `timing.text` | fritekst | Kildens egen presisjon: «Q2 2027», «høsten 2027». Aldri normalisert til en dato. |
| `timing.qualifier` | `expected`, `confirmed` | Forventet eller bekreftet. |
| `moveInLinks[]` | `{ buildingId, confirmedBy, claimId? }` | Den **eneste** måten å si «tilgjengelig ved innflytting». Gjelder ett navngitt bygg og én kilde. |
| `access.scope` | `all-residents`, `named-buildings`, `public`, `unresolved` | Hvem som har adgang. |
| `access.buildingIds[]` | tema-ID-er med `objectType: "building"` | Bare med `scope: "named-buildings"`. |
| `access.conditions` | fritekst | Dokumenterte vilkår, f.eks. «med nøkkelbrikke». |
| `conflicts[]` | `{ claimIds[], note }` | Motstridende påstander. Begge blir stående; ingen rangering. |
| `mapAnchor.placeId` | id i `places.json` | Kontrollert koordinat. |
| `mapAnchor.approximateArea` | fritekst | Eksplisitt omtrentlig anker. |
| `claims[]` | `{ id, text, sourceId, checkedAt, verification }` | Objektets egne påstander. Feltene over peker hit, så et sammendrag kan spores. |

### Reglene som ikke er til forhandling

- **`checkedAt` er aldri en åpningsdato.** Det er når noen kontrollerte påstanden.
- **Datoer endrer ingenting av seg selv.** Ingen kode sammenligner `timing` med dagens dato. En passert forventning blir en gammel forventning, ikke en åpning.
- **Bygg B arver ikke bygg As bekreftelse.** Derfor er `moveInLinks` en liste med bygg-ID og kilde, ikke et ja/nei-flagg.
- **Et objekt uten koordinat er lovlig.** Det forblir tema, er søkbart i samtalen, og får ingen markør.
- **Kartets `developmentStatus` er en grovklassifisering** (her nå / kommer). Den kan ikke erstatte objektet: et ferdig bygg med et uåpnet treningsrom er `existing` i kartet og «ikke åpnet» i opplysningene, samtidig.

## Projeksjonen: ett kall, to flater

`projectDevelopment(topic, names)` i `lib/demo/local-board/development.ts` lager både den korte visningen på skjermen (`facts`) og forbeholdene stemmen får (`caveats`), i samme kall. Lå ordvalget to steder, ville kortet og guiden driftet fra hverandre — og sagt hver sin ting om samme fasilitet.

Forbeholdene går til kunnskapsverktøyet som **uavklarte fakta**, som er det verktøyet returnerer under `uncertainties` og aldri siterer som fakta.

## Eksempel (syntetisk — ikke et ekte prosjekt)

```jsonc
// topics.json — OPPDIKTET EKSEMPEL, brukes ikke av noe datasett
[
  {
    "id": "bygg-a",
    "title": "Bygg A",
    "status": "existing",
    "text": "Bygg A er det første byggetrinnet.",
    "checkedAt": "2026-09-18",
    "sourceIds": ["eksempel-prosjektside"],
    "development": {
      "objectType": "building",
      "buildStatus": "existing",
      "availability": "open",
      "availabilityClaimId": "bygg-a-overtatt",
      "access": { "scope": "all-residents" },
      "mapAnchor": { "placeId": "bygg-a-sted" },
      "claims": [
        {
          "id": "bygg-a-overtatt",
          "text": "Bygg A er overtatt av beboerne.",
          "sourceId": "eksempel-prosjektside",
          "checkedAt": "2026-09-18"
        }
      ]
    }
  },
  {
    "id": "treningsrom",
    "title": "Treningsrommet",
    "status": "unresolved",
    "text": "Treningsrommet ligger i første etasje.",
    "checkedAt": "2026-09-18",
    "sourceIds": ["eksempel-prosjektside"],
    "keywords": ["trening", "trene"],
    "development": {
      "objectType": "facility",
      "buildStatus": "existing",
      "availability": "unknown",
      "timing": { "text": "Q1 2027", "qualifier": "expected" },
      "access": { "scope": "named-buildings", "buildingIds": ["bygg-a"] },
      "claims": [
        { "id": "c-prospekt", "text": "Treningsrom i bygg A.", "sourceId": "eksempel-prosjektside", "checkedAt": "2026-01-02" },
        { "id": "c-nettside", "text": "Treningsrom i bygg B.", "sourceId": "eksempel-prosjektside", "checkedAt": "2026-09-01" }
      ],
      "conflicts": [
        { "claimIds": ["c-prospekt", "c-nettside"], "note": "Kildene plasserer treningsrommet i hvert sitt bygg." }
      ]
    }
  }
]
```

Treningsrommet over gir denne projeksjonen:

- **Opplysninger:** Status: eksisterende. Åpning: åpning ikke oppgitt. Forventet tidspunkt: Q1 2027. Adgang: Bygg A.
- **Forbehold:** at kildene ikke sier om det er åpent, at «Q1 2027» er en forventning, at ingen kilde bekrefter tilgjengelighet ved innflytting, og at kildene spriker om hvilket bygg det ligger i.

Bygget er ferdig. Treningsrommet er det ingen som har sagt er åpent. De to er forskjellige opplysninger, og det er hele grunnen til at modellen finnes.
