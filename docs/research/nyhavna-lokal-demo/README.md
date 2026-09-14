# Nyhavna lokal demo

**Åpne:** http://localhost:3103/demo/nyhavna-lokal

Demoen leser faginnhold fra `data/demo/nyhavna-lokal/`. Ingen Supabase-oppslag under samtalen; utvalgte steder importeres kontrollert til JSON.
Per 14. september 2026: 8 kategorier, 8 manusdeler, 19 FAQ-er, 48 kartpunkter totalt (43 eksisterende steder og 5 planområder), hvor 29 vises fra start, og 61 kilder.
Tidligere bred research er arkivert; den aktive demoen bruker det kuraterte utvalget.

## Prøv presentasjonen

1. Last siden på nytt og start samtalen.
2. Velg «planene for Nyhavna» eller «steder som finnes i dag» i den nye introen.
3. Placy presenterer én del, åpner tilhørende kategori og viser stedene.
4. Avbryt med et spørsmål. Si «fortsett» for å vende tilbake til presentasjonen.
5. Velg en annen kategori med stemmen eller i sidepanelet.

Ved et bredt spørsmål om dagens nærområde gir Anja to temavalg og venter. «Nyhavna som bydel» gir felleskontekst og fem delområder som kan velges i kartet. Etter en presentasjon velger brukeren hva de vil høre om videre.
Etter hver del inviterer stemmen til et valg og venter. Stillhet skal ikke starte neste del.
Manuset er et formidlingsgrunnlag; modellen kan formulere setningene naturlig.

## Redigere innhold

| Fil | Innhold |
|---|---|
| `board.json` | Kategorier, kartinnstillinger, hilsen og `presentation` |
| `faq.json` | Korte svar og stedslenker for sidebar og stemme |
| `places.json` | Steder, koordinater, reisetider og fakta |
| `topics.json` | Søkbare fakta på tvers av steder |
| `sources.json` | Kilder med URL og kontrolldato |
| `conversations.json` | Testgrunnlag, aldri faktakilde |
| `eksempel.json` | Formatdokumentasjon, lastes ikke |

Hver manusdel har `id`, `categoryId`, `text`, `placeIds`, `sourceIds` og `checkedAt`.
Rekkefølgen i `presentation` bestemmer omvisningen. Et kategorihopp fortsetter derfra i rekkefølgen. Steder skal nevnes i samme rekkefølge
som `placeIds`. Alle referanser og stedenes kategoritilhørighet valideres når datasettet lastes. Manusdelen kan være høyst 1200 tegn.

FAQ-lenker bruker `[navn](poi:sted-id)` og `[tema](category:kategori-id)`.
Bruk stabile ID-er. Skillet mellom eksisterende tilbud, planer og uavklart informasjon
må beholdes i både manus, fakta og svar. Minutter skal ha et beregningsgrunnlag;
demoen bruker ett fast geografisk utgangspunkt, ikke en bestemt framtidig bolig.

Lagre JSON og last siden på nytt. En pågående samtale beholder sitt datasett;
start en ny samtale etter endringer. Det er ikke nødvendig å bygge på nytt.

## Samtale og grensesnitt

`lib/live/demos.ts` velger lokal samtale og egne stemmeinstruksjoner.
`lib/demo/nyhavna-lokal/presentation.ts` holder manusposisjonen gjennom faktaspørsmål.
Verktøyet `present_neighbourhood` starter, fortsetter eller bytter kategori. Parallelle backend-verktøykall er deaktivert for denne demoen for å unngå samtidige fremdriftsendringer.
`voice.ts` gir backenden detaljert faggrunnlag; `voice-instructions.ts` gir stemmen
korte regler for formidling og avbrudd.

Kategori og kartgruppe oppdateres samlet. Det sist navngitte stedet får ekstra
visuell fokus mens stemmen snakker. Resten av den omtalte gruppen forblir synlig. Fokus bygger på transkript og registrert
lydavspilling, **ikke ordnøyaktige lydtidskoder**. Ved avbrudd fjernes det ekstra
fokuset, mens den omtalte gruppen blir stående. Retur til riktig manusdel er
styrt i kode; hvor i setningen stemmen fortsetter, avhenger av samtaletranskriptet.

Modellene leses fra `OPENAI_BOARD_LIVE_MODEL` og `OPENAI_BOARD_BACKEND_MODEL`;
standardene i denne prototypen er `gpt-live-1` og `gpt-5.6-terra`.
Integrasjonen følger eksisterende Live-protokoll. Denne iterasjonen bytter ikke modell.

## Verifisering og grenser

Skjema og laster: `lib/demo/nyhavna-lokal/schema.ts` og `dataset.ts`.
Målrettede tester dekker manusposisjon, kategoribytte, avbruddsfokus og kartkommandoer.
Desktop og mobil er kontrollert i nettleser. Faktisk lydflyt og tidspunktet for
markørfokus må vurderes i lyttetesten; det kan ikke bevises av DOM- og enhetstester.

Demoen er lokal og returnerer 404 i produksjonsmodus. Ingen produksjonsutrulling.
Skolekrets er ikke avklart for en bestemt bolig. Reisetider er beregnede eller
daterte rutetabelleksempler; trygg skolevei og faktiske avganger er ikke garantert.

Den opprinnelige Leve-demoen bruker sitt eget datagrunnlag. Regler for guidet
presentasjon og automatisk kategoribytte ved fremheving gjelder den lokale demoen.

## Bydelen som kommer

[Bo-grunnlaget](2026-09-14-bo-grunnlag.md) dokumenterer alle sidene under `/bo/` og kartankrene. Felleskonteksten er et globalt tema i `topics.json`; hvert delområde har planstatus, eget sammendrag, fakta og kilder i `places.json`. Det er delområder, ikke fem fast nummererte byggetrinn. Kartpunktene er omtrentlige områdeankre uten beregnet reisetid.

## Samtalepatch etter siste lyttetest

Brede spørsmål om dagens nærområde skal få to temaknagger før en kategori velges. Oppfølging blir i valgt tema; delområder har spørsmål om boligplanene eller dagens nærområde. Manus og svar bruker «fra Nyhavna» og rutetabelltid uten standardtillegg om trafikk.

Live har nå lokal grense på 30 minutter, med synlig varsel rundt to minutter før stopp. Mikrofonknappen kan starte en ny samtale etterpå; samtalehistorikken videreføres ikke automatisk. Leverandørgrenser og forbindelsesbrudd kan fortsatt avslutte tidligere. Testet med simulerte tidsforløp, ikke en faktisk 30-minutters samtale.


### Ekstrautvalg ved interesse (2026-09-14)

Trening er første prøve: Nyhavna Padel vises fra starten. CrossFit Trondheim og Lilleby Treningssenter ligger i `places.json` med `revealOnRequest: true`. De vises først når brukeren trykker «Vis flere steder» eller ber Anja om flere treningssteder. To nye steder vises og fremheves samtidig. Utvalget varer til siden lastes på nytt; ny stemmesamtale får vite hva som allerede er vist. Knappen skjules når kategorien er tom for ekstra steder.

Dette er et lokalt, kuratert uttrekk, ikke runtime-søk i Supabase eller på nettet. Kandidatene og koordinatene kom fra `data/demo/nyhavna-snapshot.json`; navn, adresse og tilbud ble kontrollert mot https://www.crossfittrondheim.com/ og https://lillebytreningssenter.no/om-oss/ samt https://lillebytreningssenter.no/salgsbetingelser/. Nye ruteanslag er ikke lagt til. CrossFit omtales ikke som fritt drop-in.

Test: last siden på nytt → velg Trening → se ett sted → «Vis flere steder» → se tre steder og to nummererte nye markører. For tale: ny sidelasting → be Anja fortelle om trening → takk ja til flere alternativer. Faktisk muntlig etterlevelse må lyttetestes; knappen, datafiltrering, serververktøy og SSE-håndtering er kontrollert.

## Radius og flere steder (14. september)

Trening og natur har et kontrollert utvalg fra Supabase innen 10 km i luftlinje fra boardets senter. Fra start vises manusstedene og de tre nærmeste i hver av disse kategoriene (fire i hver med dagens overlapp). Første «flere» fyller på resten innen 2 km, sortert nærmest først, før radius utvides. Kategoripanelet tilbyr én «Vis flere steder»-knapp for neste utvidelse. Anja inviterer naturlig til flere steder i nærheten, uten å lese opp antall eller radius med mindre brukeren spør. Taleverktøyet `reveal_more_places` bruker samme avstandsutvalg. Alle nye punkter legges til; alle fremheves og omtales i samme rekkefølge, med én kort beskrivelse og pause per sted. Begge kartmotorene tegner radiusringen. Utvidelsen huskes per kategori gjennom besøket og ved ny stemmesamtale, men nullstilles ved full sidelasting. Kartkameraet rammer først inn Nyhavna og de kommende stedene. Etter kameraflyturen legges de nye markørene til, og først etter rendering bekreftes verktøyet til stemmen; hele radiusringen trenger ikke passe i utsnittet. 3D-kameraets vanlige 4000m-grense kan overskrides ved denne innrammingen.

| Radius | Trening | Natur |
|---|---:|---:|
| 2 km | 8 | 5 |
| 5 km | 11 | 8 |
| 10 km | 15 | 12 |

23 Supabase-poster er importert med `provenance.recordId` og importdato. Lagrede beskrivelser er forenklet til stedstype og område; åpningstider, priser og rutetider er ikke importert. `checkedAt` for disse postene betyr kontroll mot lagret databaseoppføring, ikke ny kontroll av nettsiden. Naturpunkter representerer lagrede plasseringer, ikke nødvendigvis turinnganger. Se `2026-09-14-radius-import.json` for de 24 vurderte forslagene og det utelatte Reppe-punktet. 796 kandidater ble klassifisert fra 5119 databaseposter; 732 er ikke ferdig kuratert eller faktakontrollert.

Før ny import: gjennomgå kildedata og dubletter, behold eksisterende lokale ID-er, kontroller koordinater/kategorier, legg bare valgte poster til `places.json` og kilde/proveniens. Ingen automatisk import av hele poolen. Radius er foreløpig 2/4/6/8/10 km og bare utvidelse; tomme større intervaller tilbys ikke.

Test: velg Trening, utvid til 5 km, deretter 10 km. Bytt til Natur (fortsatt 2 km) og prøv «vis flere natursteder innen ti kilometer». Kontroller at kart og stedsliste følger med. Willow og måltempo 80–90 ord/minutt beholdes. Ti korte ventefraser gir språklig variasjon; effekten må lyttetestes.
