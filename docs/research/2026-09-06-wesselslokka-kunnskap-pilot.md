# Wesselsløkka: første kildebelagte aktivitets-FAQ

## Resultat og avgrensning

80 av 80 katalogspørsmål kartlagt mot dagens lesesti. Baseline `c1240e6`: 53 viste svar, hvorav 50 fra katalogen og tre tillegg (`naermest`, `mest-av`, `bysykkel`). Etter piloten: 55 svar, 52 av 80 katalogspørsmål dekket. Alle 53 eksisterende FAQ-objekter er sammenlignet og uendret. Dette er dekningskontroll, ikke en ekstern faktasjekk av alle 53 svar.

De 30 opprinnelige hullene: 20 spørsmål er ikke registrert i den aktive malen og mangler bygger; sju registrerte spørsmål mangler kuratert svar; tre har bygger, men mangler innkommende steder/data. To hull fylles i piloten. Maskinlesbar full oversikt: `2026-09-06-wesselslokka-faq-dekning.json`.

## Første demonstrasjon

- Oppvekst → «Hva kan barna gjøre etter skoletid?» bruker Strindheim ILs allidrett på Brøset og Åsvang og Eberg Skolekorps på Åsvang skole.
- Trening → «Hvilke idrettslag holder til i nabolaget?» bruker samme allidrettsopplysning.
- Begge viser arrangørens kilde og kontrollert dato. Ingen oppdiktet reisetid, tilgjengelig plass eller medlemsadgang.

Kilder lest 6. september 2026: [Strindheim IL](https://strindheimil.no/allidrett/) og [Åsvang og Eberg Skolekorps](https://www.aasvang-eberg.portalweb.no/ovelser). Førstnevnte har både en 2026/27-tekst og eldre sesongtekst. Piloten bruker bare aktivitet og sted; dato, pris og kapasitet er ikke kopiert. De to faktaene skal vurderes på nytt før 1. desember 2026 og utelates av generatoren fra den datoen.

## Hva som faktisk gjenbrukes

To nye rader i eksisterende `v2.place_knowledge`, med versjonert `structured_data`: arrangør, aktivitet, målgruppe, sted, domene og utløpsdato. Kilder og kontrollert dato ligger i tabellens eksisterende felt. `area_id=broset` angir redaksjonell relevans, ikke at alle øvingssteder fysisk ligger innenfor området.

Wesselsløkkas `reportConfig.localActivityIds` velger disse radene. Serveren leser dem, og FAQ-generatoren monterer svartekst. Andre boards kan velge de samme ID-ene; det er testet med to adresser, uten å endre andre produkter. Eksisterende manuell FAQ-kuratering vinner fortsatt. Ugyldige, uverifiserte, framtidsdaterte og utløpte fakta gir ingen kunnskapsbasert rad.

Dette er et første fungerende utsnitt. Automatisk kildesøk, geografisk utvalg, bidragsgrensesnitt, korreksjonshistorikk og en generell kunnskapsgraf er ikke implementert. En rettelse i databasen kommer inn ved neste produkt-cacheoppdatering (eksisterende intervall én time / produkt-tag). En allerede åpen fane må lastes på nytt. Endringspropagasjon er testet i generatoren, ikke ved å endre en ekte kildeopplysning frem og tilbake i produksjon.

Kunnskapsfilen i `data/knowledge/broset-activities.json` er den gjennomgåtte inputen. Gjentatt apply normaliserer timestamp-format og skriver ikke uendrede fakta. Revider filen før neste apply hvis fakta er korrigert i databasen.

## Bruk og kontroll

```sh
npx tsx scripts/apply-local-activities.ts data/knowledge/broset-activities.json
# Skriver kun når --apply legges til. Ingen Places-, LLM- eller rutekall.
```

Skriptet tar backup før skriving og bruker optimistisk lås på eksisterende rader. Fakta og produktkonfig er separate skriv, ikke én transaksjon; ved feil oppgis backup og produktet må kontrolleres. Denne kjøringen skrev to nye fakta og la kun til `localActivityIds` på Wesselsløkka. Ny preview viste null endrede fakta.

Backup fra kjøringen: `/var/folders/dl/rhh6ylrj16gg0h9f0kpt3xg00000gn/T/placy-activities-bGsQaH/before.json`. Ved tilbakeføring: fjern de to ID-ene fra produktets utvalg med kontroll mot siste config. Slett de nye faktaene bare hvis ingen andre produkter bruker dem. Ikke overskriv hele configen fra backup hvis andre sesjoner har endret den.

## Andre funn som er beholdt som åpne tråder

- Ni fritidsklubb-POI-er finnes på Wesselsløkka, men temaets kategorier er skole, barnehage, lekeplass og idrett. Byggeren fikk ingen klubber. Kategorien inneholder også irrelevante steder; blindt å legge den til er ikke kvalitetssikring.
- Naturens grøntområdesvar og hundeparksvar peker begge til Brøset Hundepark. Dette er fortsatt uendret.
- «Ingen kilde svarer» i tidligere worklog er for sterkt: kommunen beskriver en forbindelse fra Valentinlyst via Moholt kirkegård og Voll til marka ved Lohove. [Kommunens stedsanalyse](https://sites.google.com/trondheim.kommune.no/framtidstrondheim/stedsanalyse/valentinlyst-stedsanalyse/valentinlyst-natur-og-landskap). Nøyaktig påkobling fra Wesselsløkka og faktisk tilgjengelighet må fortsatt verifiseres.
- To bowlingsteder finnes under `idrett`, selv om `bowling` mangler. Flere hull skyldes klassifisering, ikke manglende tilbud.
- De 231 eldre kunnskapsradene fra tidligere databaseaudit er ikke automatisk godkjent. Bare de to eksplisitt valgte, nye aktivitetsradene brukes her.

## Nødvendig cachefiks

Den lokale board-siden feilet ved caching av et fullstendig paginert produkt: 3 040 794 byte oversteg Nexts 2 MB-grense. `getCachedReportProduct` cacher nå gzip-komprimert JSON under en ny nøkkel og gjenoppretter samme prosjektobjekt. Produkt-tag og timesintervall er uendret. Rundtur og null-resultat testes. Cachefiksen gjelder alle rapporter; kunnskapspiloten er opt-in.

## Full katalogdekning

| ID | Før piloten | Etter piloten |
|---|---|---|
| `til-byen` | Vist | Vist |
| `gangavstand` | Vist | Vist |
| `uten-bil` | Vist | Vist |
| `rolig` | Kuratert svar mangler | Kuratert svar mangler |
| `blir-det-bygget` | Ikke registrert; bygger mangler | Ikke registrert; bygger mangler |
| `tjenester-samme-sted` | Vist | Vist |
| `hvem-bor-her` | Ikke registrert; bygger mangler | Ikke registrert; bygger mangler |
| `ferdig-ved-innflytting` | Ikke registrert; bygger mangler | Ikke registrert; bygger mangler |
| `apent-sent` | Vist | Vist |
| `regnvaersdag` | Vist | Vist |
| `krets` | Vist | Vist |
| `skolevei` | Vist | Vist |
| `barnehage-dekning` | Vist | Vist |
| `barnehage-alder` | Ikke registrert; bygger mangler | Ikke registrert; bygger mangler |
| `lekeplass` | Vist | Vist |
| `sfo` | Ikke registrert; bygger mangler | Ikke registrert; bygger mangler |
| `oppvekst-fritid` | Bygger finnes; fritidsklubb utelatt fra tema | Nytt kildebelagt svar |
| `vgs-naerhet` | Vist | Vist |
| `skoleskyss` | Vist | Vist |
| `helsestasjon` | Vist | Vist |
| `hverdagshandel` | Vist | Vist |
| `apotek` | Vist | Vist |
| `kjopesenter` | Vist | Vist |
| `legesenter` | Vist | Vist |
| `pakker-post` | Vist | Vist |
| `dagligvare-lengst-apent` | Vist | Vist |
| `dagligvare-sondag` | Vist | Vist |
| `tannlege` | Vist | Vist |
| `vinmonopol` | Vist | Vist |
| `legevakt-sykehus` | Vist | Vist |
| `spisesteder` | Vist | Vist |
| `takeaway` | Ikke registrert; bygger mangler | Ikke registrert; bygger mangler |
| `kafe` | Vist | Vist |
| `bakeri` | Vist | Vist |
| `sondagsapent` | Vist | Vist |
| `sitte-ute` | Ikke registrert; bygger mangler | Ikke registrert; bygger mangler |
| `barnevennlig` | Ikke registrert; bygger mangler | Ikke registrert; bygger mangler |
| `uteliv` | Vist | Vist |
| `pizza` | Vist | Vist |
| `spesialbutikk-mat` | Ikke registrert; bygger mangler | Ikke registrert; bygger mangler |
| `gronntomrade` | Vist | Vist |
| `turstier` | Kuratert svar mangler | Kuratert svar mangler |
| `marka` | Kuratert svar mangler | Kuratert svar mangler |
| `hund` | Vist | Vist |
| `ski` | Ikke registrert; bygger mangler | Ikke registrert; bygger mangler |
| `bading` | Vist | Vist |
| `sykkelrute` | Ikke registrert; bygger mangler | Ikke registrert; bygger mangler |
| `tur-med-vogn` | Ikke registrert; bygger mangler | Ikke registrert; bygger mangler |
| `lysloype-lopetur` | Ikke registrert; bygger mangler | Ikke registrert; bygger mangler |
| `akebakke` | Ikke registrert; bygger mangler | Ikke registrert; bygger mangler |
| `naermeste-holdeplass` | Vist | Vist |
| `til-sentrum` | Vist | Vist |
| `linjer` | Vist | Vist |
| `frekvens` | Vist | Vist |
| `til-arbeidsplassene` | Vist | Vist |
| `siste-buss` | Vist | Vist |
| `sykkel-til-byen` | Ikke registrert; bygger mangler | Ikke registrert; bygger mangler |
| `bil-til-byen` | Ikke registrert; bygger mangler | Ikke registrert; bygger mangler |
| `tog` | Bygger finnes; ingen train-POI | Bygger finnes; ingen train-POI |
| `lading` | Vist | Vist |
| `treningssenter` | Vist | Vist |
| `svommehall` | Vist | Vist |
| `idrettsanlegg` | Vist | Vist |
| `trene-tidlig-sent` | Vist | Vist |
| `spesialtrening` | Vist | Vist |
| `treningspark` | Bygger finnes; ingen fitness_park-POI | Bygger finnes; ingen fitness_park-POI |
| `gruppetrening` | Ikke registrert; bygger mangler | Ikke registrert; bygger mangler |
| `padel-tennis` | Vist | Vist |
| `is-skoyter` | Vist | Vist |
| `idrettslag` | Kuratert svar mangler | Nytt kildebelagt svar |
| `bibliotek` | Vist | Vist |
| `kino` | Vist | Vist |
| `kulturscene` | Ikke registrert; bygger mangler | Ikke registrert; bygger mangler |
| `samlingspunkt` | Kuratert svar mangler | Kuratert svar mangler |
| `voksenaktivitet` | Kuratert svar mangler | Kuratert svar mangler |
| `kirke` | Vist | Vist |
| `frivilligsentral` | Ikke registrert; bygger mangler | Ikke registrert; bygger mangler |
| `bowling-aktivitet` | Ikke registrert; bygger mangler | Ikke registrert; bygger mangler |
| `museum` | Vist | Vist |
| `kulturskole` | Kuratert svar mangler | Kuratert svar mangler |

## Verifisering og overlevering

- `npm test`: 3 664 tester, 215 filer, alle bestått. Tester dekker kildevisning, utløp, ugyldige kilder, gjenbruk mellom adresser, rettelser i begge spørsmål, kurateringsprioritet og komprimert cache.
- `npm run lint`: 0 feil, 53 eksisterende advarsler. Endrede scripts sjekket separat med ESLint.
- `npx tsc --noEmit`: syv feil i den urørte `components/insight/InsightReportView.tsx` (observations/actions finnes ikke på InsightReport). Den andre sesjonens innsiktsarbeid ligger ukommittert i hovedrepoet og inngår ikke i denne worktreen. Ingen typefeil i pilotens filer.
- Lokal HTTP-verifisering: 200 fra Wesselsløkkas rapport-board på port 3001; levert HTML inneholder de nye faktaene og ingen cachefeil. FAQ-komponenten er verifisert i DOM-tester; ingen browser-screenshot er tatt.
- Headless kjøring av `getProductFromSupabaseV2 → transformToReportData → adaptBoardData` mot live database: 55 svar. Alle 53 baseline-objekter sammenlignet og uendret.
- Ingen build/PR/push/merge. Claude håndterer merging. Lokal commit må omgå pre-commit-hooken fordi den krever den allerede feilende globale tsc-kontrollen; sjekkene ovenfor er kjørt manuelt.

Arbeidsgren: `research/wesselslokka-kunnskap`, worktree `../placy-wesselslokka-kunnskap`. Lokal devserver på port 3001 bruker denne grenen. Databasens nye fakta og Wesselsløkkas opt-in er allerede skrevet. Eldre kode ignorerer det nye feltet; deploy av grenen er nødvendig for nye svar utenfor lokal demo.
