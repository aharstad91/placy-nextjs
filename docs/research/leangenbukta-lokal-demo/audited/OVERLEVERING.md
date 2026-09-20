# Overlevering: prosjektfakta-revisjon Leangenbukta

> **Fullført 18.09.2026.** Denne overleveringen er historisk arbeidsdokumentasjon. Sluttleveransene er [kontrollrapporten](2026-09-18-project-facts-audit.md) og [den maskinlesbare faktapakken](2026-09-18-project-facts-package.json). Ingen data er importert til runtime.

Skrevet 2026-09-18 av Claude Code mens arbeidet ennå ikke var fullført. Dokumentet beskriver mellomtilstanden som gjorde det mulig å ta over uten å gjenta kildearbeidet.

Ingenting er committet. Ingen runtime-data er endret. Rårapporter og mottaksnotater er urørt.

---

## 1. Oppgaven

Bestillingen er å gjøre prosjektfakta for Leangenbukta klare for kontrollert bruk i Placy. Rårapporten er kandidatmateriale, ikke sannhet; hver påstand skal kontrolleres mot kilde før den godkjennes.

**Prosjektidentitet som er gitt av bruker og skal legges til grunn:**

- Prosjekt: Leangenbukta
- Adresse: Haakon VIIs gate 14, 7041 Trondheim
- Korrekt reguleringsplan: **r20160019**
- **r20170034 gjelder travbaneområdet/naboprosjektet Leangen Bolig og skal aldri brukes som dokumentasjon for Leangenbukta.** Dette er nå bekreftet mot kommunen, se funn 3 under.

**Inngangsdokumenter:**

| Rolle | Sti |
|---|---|
| Rårapport (kandidatmateriale) | `docs/research/leangenbukta-lokal-demo/raw/2026-09-18-opus-prosjektresearch-runde-1.md` |
| Kontrollnotat med K1–K15 | `docs/research/leangenbukta-lokal-demo/2026-09-18-research-mottak.md` |
| Masterplan (U5 er denne oppgaven) | `docs/plans/2026-09-18-1124-feat-leangenbukta-board-master-plan.md` |

**Leveranser som gjenstår:**

1. `docs/research/leangenbukta-lokal-demo/audited/2026-09-18-project-facts-audit.md`
2. `docs/research/leangenbukta-lokal-demo/audited/2026-09-18-project-facts-package.json`
3. Oppdatering av masterplanen — marker **bare** at prosjektfakta-revisjonen er levert, og bare hvis begge artefaktene faktisk er ferdige. Ikke marker kategoriresearch som ferdig behandlet.

Ikke gjør: endre applikasjonskode, importere data til runtime, opprette kartpunkter, endre rårapporter eller mottaksnotater, kontakte virksomheter eller kommunen, committe eller pushe.

---

## 2. Hva som er gjort

### Steg 1 — atomisering (ferdig)

Rårapporten er delt i **556 atomiske påstander** av sju parallelle agenter, én per seksjon (A–G). Hver påstand har `local_id`, `subject`, `subject_kind`, `field`, `value`, `temporal_kind`, `asserted_source_urls`, `verbatim_from_report` og `why_atomic`.

556 er høyt med vilje: «34 leiligheter fra 41–79 m², bygging igangsatt, ferdig 2027/2028» er fire påstander. De skal slås sammen igjen i vurderingen der to påstander beviselig uttrykker samme forhold — men aldri på tvers av bygg, fasiliteter eller tidspunkt.

Fordeling: `building` 132, `facility` 136, `plan` 65, `project` 55, `building_phase` 54, `outdoor_area` 39, `organisation` 36, `infrastructure` 25, `other` 14.
Etter tidsform: `existing` 178, `regulated` 92, `planned` 91, `marketed` 88, `under_construction` 40, `inference` 25, `absence_of_evidence` 22, `historical` 20.

**313 av 556 påstander har ingen kilde-URL i rårapporten.** De kan ikke bli `approved` uten at en kilde finnes i bevispakken.

### Steg 2 — kildeinnhenting (ferdig)

17 kildepakker hentet, alle tilgjengelige, til sammen 261 funn. Hvert funn har ordrett sitat, nøytral lesning, URL og tidsform. Kildene er faktisk åpnet — ikke lest av søkeutdrag.

`leangenbukta-hoved` · `leangenbukta-underside` · `koteng-obos` · `finn-knutepunktet` · `finn-parktunet` · `finn-saltakshus` · `finn-byggEH` · `hem-saltakshusL` · `byggno-byvilla` · `byggno-saltakshus` · `brreg-selskaper` · `arkitektroller` · `knutepunktet-status` · `barnehage-o_BBH` · `trondheim-kommune-planregister` · `ladestien` · `presse`

### Steg 3 — plandokumentene (ferdig, lest direkte)

Alle fire vedtatte plandokumenter for r20160019 er lastet ned fra kommunen og lest i sin helhet av hovedløpet, ikke av en agent. Utdragene ligger i `_arbeidsdata/plangrunnlag-r20160019.md` med ordrette bestemmelser. PDF-ene ligger i `_arbeidsdata/plandokumenter/`.

Dette er den autoritative kilden for alt planrelatert. Bruk den framfor rårapportens gjengivelse.

### Steg 4 — vurdering og motprøve (**ikke gjort**)

Dette er det som gjenstår. Se seksjon 5.

---

## 3. Arbeidsdata

Alt ligger under `docs/research/leangenbukta-lokal-demo/audited/_arbeidsdata/`. **Denne katalogen er arbeidsmateriale, ikke leveranse** — slett den når de to leveransefilene er ferdige, eller la den ligge som dokumentasjon. Den skal ikke committes uten at bruker bestemmer det.

| Fil | Innhold |
|---|---|
| `kildepakker-og-pastander.json` | `{claims: [...7 seksjoner...], harvests: [...17 kildepakker...]}`. Hele grunnlaget. |
| `pastander-per-domene.json` | De samme 556 påstandene fordelt på fire domener D1–D4, klare til vurdering. |
| `plangrunnlag-r20160019.md` | Ordrette utdrag fra vedtatte bestemmelser, planbeskrivelse, plankart og illustrasjonsplan. |
| `plandokumenter/*.pdf` | De fire originaldokumentene. `pdftotext -layout` fungerer på de to tekstdokumentene. |
| `utkast-vurderingsrunde.js` | Ferdig skrevet workflow-skript for vurdering + motprøve + dekningskontroll. Ikke kjørt. |

Domenefordelingen i `pastander-per-domene.json`:

- **D1** (156): prosjekt, organisasjoner, reguleringsplan
- **D2** (186): bygg og byggetrinn
- **D3** (161): fasiliteter og infrastruktur
- **D4** (53): uteområder og øvrig

---

## 4. Funn som allerede er avklart

Disse er kontrollert mot primærkilde og kan legges til grunn. De endrer bildet fra rårapporten.

**4.1 Leangenbukta AS og «Haakon VII's gate 14 AS» er samme selskap.**
Org.nr. 914507774. Enhetsregisteret viser `historiskeNavn: [{navn: "HAAKON VIIS GT. 14 AS", fraDato: 2014-11-27, tilDato: 2020-10-08}]`. Forslagsstilleren i reguleringsplanen fra 2018 er altså dagens utviklerselskap under nytt navn, ikke et annet selskap. Forretningsadresse Travbanevegen 2, 7061 Trondheim.
Øvrige selskaper bekreftet med org.nr.: Koteng Jenssen AS 923448381, Koteng Bolig AS 988965391, Koteng Eiendom AS 981039939, OBOS Nye Hjem AS 935283280, Utstillingsplassen Eiendom AS 940615291, Jenssen Holding AS 937070721.
**Eierandeler er ikke offentlige i Enhetsregisteret og skal ikke oppgis.**

**4.2 Knutepunktet har ingen datert dokumentasjon på ferdigstillelse eller drift.**
All tekst fra alle kilder står i framtidsform: «ferdigstilles i løpet av året», «antatt ferdigstillelse er planlagt i perioden oktober november 2026», «innflytting i siste kvartal 2026». FINNs eget statusfelt viser bindestrek for planlegging, salgsstart, byggestart og overtakelse. Bygget står ikke på utbyggers liste over innflyttingsklare boliger. Kommunens byggesaksinnsyn er en interaktiv portal som ikke lot seg spørre.
Konsekvens: fellesfasilitetene kan verken godkjennes som «i drift» eller som «ikke i drift». Begge deler er `unresolved`. Dette løser kontrollpunkt K7.

**4.3 r20170034 er bekreftet et annet prosjekt.**
Gjelder Tungavegen 1, gnr/bnr 4/2, 4/10 og 4/13 m.fl. på Leangen (travbaneområdet), forslagsstiller Leangen Bolig AS, plankonsulent Lund Hagem Arkitekter AS. Merk at kommunens eget saksframlegg til sluttbehandling bruker plan-ID `r20180029` for samme arkivsak 16/44556 — verdt å vite hvis noen søker.

**4.4 45 250 m² og 43 550 m² er ikke motstridende.**
Bestemmelsenes §3.2-1 (juridisk bindende): «Maksimal tillatt utnyttelse samlet for felt B1, B2, B3, B4 og B5 skal ikke overskride 43 550 m² BRA og 12 000 m² BYA.»
Planbeskrivelsen (beskrivende): «Maksimal tillatt utnyttelse for hele planområdet skal ikke overskride 45.250 m² BRA og 11.300 m² BYA», med tabell som summerer BRA til 45 250 inkludert barnehagens 1 700.
Ulike størrelser, begge riktige. Rårapportens forbehold (c) er feil på dette punktet. Den reelle interne uoverensstemmelsen er 11 300 (tekst) mot 11 320 (tabellsum) — begge i planbeskrivelsen.

**4.5 Skolekapasitet er ikke et rekkefølgekrav.**
§8.8 er et vilkår for gjennomføring. §9 har nøyaktig fire rekkefølgekrav: turveg før brukstillatelse for barnehage (§9.1), offentlig kjøreveg og fortau før brukstillatelse til bebyggelse (§9.2), avfallssug og returpunkt før første boliger (§9.3), uteoppholdsareal per byggetrinn med småbarnslekeplass (§9.4). Rårapporten plasserer skolekapasitet feil.

**4.6 Ladestien legges ikke om gjennom boligfeltet ifølge planen.**
Planbeskrivelsen ordrett: «Sti som ligger gjennom planområdet i retning Ladestien er definert som offentlig turveg. Stien planlegges tilkoplet framtidig planlagt turveg retning Ladestien.» På plankartet er o_GT en smal stripe i planområdets **østkant**, ved o_GF på 0,3 daa. Illustrasjonsplanen tegner «eksisterende turvei» **utenfor** planområdet, øst for det, forbi Leangen gård.
Rårapportens «den ca. 14 km lange kyststien skal legges om og slynge seg gjennom boligfeltet» er utbyggertekst, ikke planhjemmel. Behandle som tre atskilte påstander: dagens farbare trasé, regulert o_GT, og framtidig omlegging.

**4.7 Næring tillates i første OG andre etasje, i B1 og B2 langs Lade allé.**
§3.2: «Det tillates etablert tjenesteyting og/eller kontor i første og andre etasje i bebyggelse langs Lade allé i felt B1 og felt B2. Samlet areal til kontor/tjenesteyting skal ikke overstige 3 000 m² BRA.» Rårapportens «1. etasje langs hovedgatene» er upresist.

**4.8 Planen forbyr svalgangsløsninger.**
§3.3: «Det tillates ikke svalgangsløsninger for adkomst til boenhetene i planområdet. Boenheter i felt B1, B2, B3 og B5 skal ha adkomst via trapperom/heis innenfor bebyggelsen.» Rårapporten sier flere byvillaleiligheter har egen svalgang. Uavklart konflikt som må håndteres eksplisitt.

**4.9 r20240046 finnes ikke i kommunens register.**
Søkt i kunngjøringsarkiv, vedtatte planer, igangsatt planarbeid, ISY Plandialog og web-søk uten treff. Rårapportens henvisning blir `unresolved`.

**4.10 KPA-status er uavklart.**
Rårapporten sier eiendommen er omfattet av Kommuneplanens arealdel 2022–2034 med sentrumsformål. Dette lot seg ikke bekrefte; plankartet er interaktivt. KPA 2022–2034 ble vedtatt 26.9.2024, fikk rettskraft 27.3.2025 og er revidert etter departementsvedtak 30.3.2026. Da r20160019 ble vedtatt gjaldt KPA 2012–2024, der eiendommen sto som næringsformål (bekreftet ordrett i planbeskrivelsen). `unresolved`.

**4.11 Ting som ikke ble funnet, og som derfor ikke kan bli negative fakta.**
Marina, båtplasser, brygge, badstue, kommersiell kafé, byggestart for barnehagen, leietakere i næringslokalene, interne broer eller underganger, livsløpsstandard utover heis. Manglende funn er ikke bevis. Alle blir `unresolved` og formuleres som manglende dokumentasjon.

---

## 5. Det som gjenstår

### 5.1 Vurdering

Klassifiser hver av de 556 påstandene som `approved`, `approved_time_sensitive`, `unresolved`, `rejected` eller `historical`. Slå sammen der to påstander beviselig uttrykker samme forhold, og behold alle `raw_refs`.

Et ferdig workflow-skript ligger i `_arbeidsdata/utkast-vurderingsrunde.js`. Det er skrevet for Claude Codes Workflow-verktøy og må tilpasses hvis en annen assistent tar over, men regelsettet i `GRUNNREGLER` og skjemaene er verdt å gjenbruke ordrett. Skriptet forventer `args = {claims, harvests, planEvidence}`.

**Beviskrav som må håndheves:**

- Primærkilder prioriteres: kommunen, vedtatt plan r20160019, utbyggers offisielle materiale, daterte salgsoppgaver, offisielle registerkilder.
- Fagpresse og lokalpresse kan avdekke kandidater og konflikter, men er normalt ikke alene nok for en publiserbar prosjektfakta. Unntak: historiske hendelser fagpressen selv dekket.
- Hver `approved` må ha minst én direkte kilde **på påstandsnivå**. En generell kildeliste teller ikke.
- Kilde ikke åpnet eller innhold ikke bekreftet ⇒ `unresolved`.
- Søkemotorutdrag er aldri dokumentasjon.

**Skilleregler:**

- Reguleringsmulighet er ikke gjennomføringsvedtak.
- Utbyggers framtidsformuleringer dokumenterer ikke vedtak, finansiering, bygging eller åpning.
- Manglende funn blir aldri en godkjent negativ påstand.
- Ikke overfør fakta fra naboprosjekter.
- Ikke kombiner byggetrinn eller sameier uten dokumentasjon.
- Solgt, videresolgt, innflyttingsklart, overlevert og innflyttet er ikke utbyttbare.
- Ferdig bygg dokumenterer ikke fasilitet i drift.
- En passert dato vender aldri en status automatisk.
- Kontrolldato er når **vi** åpnet kilden — aldri en åpningsdato eller publiseringsdato.

### 5.2 Motprøve

Hver godkjent påstand skal forsøkes revet ned, med to innfallsvinkler:

1. **Kildedekning** — sier kilden faktisk dette, uten tolkningssprang? Er den primær for nettopp dette forholdet? Er den faktisk åpnet, eller bare sitert videre fra rårapporten? Er den knyttet til påstanden eller bare til temaet?
2. **Sammenblanding og tid** — gjelder den Leangenbukta og ikke Leangen Bolig eller travbanen? Er byggetrinn, sameie, bygg og salgstrinn holdt fra hverandre? Er planlagt framstilt som ferdig? Er kilden eldre enn tidspunktet den lovte?

Default til «revet ned» ved tvil.

### 5.3 Dekningskontroll

To ting må kontrolleres til slutt:

- **Rårapportdekning:** X av Y rådpåstander gjenfinnes i det vurderte settet. Gå gjennom TL;DR, Key Findings, alle seks avsnitt, Recommendations, Caveats, faktatabellen, kildetabellen, kjøperspørsmålene, kartpunkt-tabellen og spørsmålene til utbygger.
- **K1–K15:** hvert kontrollpunkt i mottaksnotatet skal ha en eksplisitt håndtering. K7 er løst av funn 4.2. K6 er delvis løst av funn 4.4.

---

## 6. Krav til leveransene

### 6.1 Audit-dokumentet

Skal inneholde: kort konklusjon · verifisert prosjektidentitet · godkjente prosjektfakta · tidsfølsomme prosjektfakta · avviste påstander med begrunnelse · uløste spørsmål · dokumenterte kildekonflikter · objekter som skal opprettes i Placy · objekter eller påstander som skal holdes utenfor · forslag til kort, nøktern Placy-tekst basert kun på approved-påstander · full sporbarhet fra hver konklusjon til kilde.

I tillegg, etter arkitekturpresiseringen fra bruker: en seksjon som beskriver **hvilke entities som er gjenbrukbare, hvilke som er prosjektspesifikke, og hvilke som må beregnes per adresse.**

**Redaksjonelle krav:** klart norsk uten markedsføringsspråk. Forbudt: «kort vei», «gangavstand», «nærmest», «familievennlig», «attraktivt» og andre udokumenterte vurderinger. Ikke beregn avstander eller reisetider. Ikke rangér. Ikke presenter planlagte forhold som ferdige. Ikke skriv at noe ikke finnes fordi det ikke ble funnet. Ingen juridiske løfter om adgang, kostnader, eierskap eller framtidig gjennomføring.

### 6.2 JSON-pakken

```json
{
  "project": {
    "id": "leangenbukta",
    "name": "Leangenbukta",
    "address": "Haakon VIIs gate 14, 7041 Trondheim",
    "planning_case": "r20160019",
    "reviewed_at": "2026-09-18"
  },
  "entities": [],
  "claims": [],
  "unresolved_questions": [],
  "excluded_claims": []
}
```

Hver claim minst: `claim_id`, `subject_id`, `field`, `value`, `status`, `source_urls`, `source_titles`, `source_type`, `source_date` når kjent, `observed_at`, `valid_from`/`valid_to` når relevant, `confidence`, `conflict_notes`, `editorial_note`, `approved_copy` bare når status tillater publisering.

Krav: gyldig JSON, ingen kommentarer, ingen sammensatte påstander i samme claim, `null` når et felt faktisk er ukjent, ingen oppdiktede koordinater/datoer/identifikatorer, alle approved har minst én direkte kilde, tidsfølsomme har dato eller eksplisitt oppfriskningsbehov.

### 6.3 Arkitektur — fire scopes

Brukeren har presisert at resultatet skal støtte gjenbruk på tvers av alle Placy-boards. Legg til på entities og claims der relevant: `scope`, `canonical_id`, `geography`, `reusable_across_boards`, `reuse_constraints`, `board_id` (null med mindre påstanden faktisk bare gjelder ett board).

| Scope | Betydning | Eksempel |
|---|---|---|
| `global_place` | Kanonisk fysisk sted som alle boards kan bruke | `place:leangen-gard` |
| `project` | Gjelder bare boligprosjektet | `facility:leangenbukta:knutepunktet` |
| `address` | Avhenger av konkret boligadresse | skolekrets, rute, avstand |
| `board_view` | Redaksjonelt utvalg og board-tilknytning | — |

**Regler:** kanoniske ID-er skal ikke inneholde «leangenbukta» når objektet er et selvstendig sted. Prosjektfasiliteter kan bruke Leangenbukta i ID-en. Stedsfakta og board-medlemskap lagres separat. Ikke lag kopier av globale steder inne i prosjektobjektet. Ruter, avstander, reisetider og skolekrets skal aldri lagres som globale stedsfakta. Kilder, gyldighet og konflikter følger den kanoniske claimen, slik at én oppdatering kan brukes av alle boards.

**Konkret for denne runden:** det meste blir `project`. Tre objekter er `global_place` og får kanoniske ID-er uten prosjektnavn: `place:leangen-gard` (fredet lystgård, nabo i øst, navngitt på plankartet), `place:lade-behandlingssenter` (nabo i nord/nordøst, navngitt i bestemmelsene §3.2.5 og §3.6-3), `place:ladestien` (offentlig kyststi). Reguleringsplanen blir `plan:r20160019` med feltene som underobjekter, `plan:r20160019:b1` og så videre.

Planfeltet `o_BBH` er et **regulert felt**, ikke en barnehage. Den dagen barnehagen står der, er den et selvstendig `global_place` med egen kanonisk ID. Skriv dette eksplisitt som en framtidig kobling.

`address` blir tomt i denne runden, og det er riktig. Alle påstandene i rårapporten som ville falt der — «kort vei til alt», gangavstander, skolekrets — er nettopp det som skal ut etter de redaksjonelle reglene. Audit-dokumentet skal ha en egen seksjon som sier hvilke spørsmål som må beregnes per adresse og derfor aldri lagres som stedsfakta.

Kategorirundene som kommer senere (Natur, Transport, Hverdag, Oppvekst, Servering, Trening, Opplevelser) skal produsere kanoniske områdesteder med **separat** board-tilknytning. Denne strukturen er obligatorisk der.

---

## 7. Kvalitetskontroll før avslutning

- Valider JSON maskinelt.
- Kjør `git diff --check`.
- Kontroller at ingen r20170034-påstand er knyttet til Leangenbukta.
- Kontroller at alle approved-påstander har kilder på påstandsnivå.
- Kontroller at `planned`, `existing`, `under_construction` og `historical` ikke er blandet.
- Kontroller at redaksjonell tekst bare bruker approved eller approved_time_sensitive.
- Rapporter antall claims i hver status.
- Oppgi hvilke filer som ble skrevet.
- Oppgi hvilke vesentlige spørsmål som fortsatt blokkerer publisering.

---

## 8. Kjente svakheter i grunnlaget

- **313 av 556 påstander mangler kilde-URL** i rårapporten. Bevispakken dekker mange av dem, men ikke alle.
- **Ingen geoverifikasjon.** Rårapportens kartpunkter har verbal «plasseringssikkerhet», som ikke er dokumentasjon. Ingen posisjon kan godkjennes uten kontrollert situasjonsplan eller boligvelger. `geography` skal si i klartekst hva vi faktisk vet. Dette er kontrollpunkt K10 og er **ikke** løst.
- **Kommunens byggesaksinnsyn er ikke avhørt.** Portalen er interaktiv og lot seg ikke spørre automatisk. Brukstillatelser og ferdigattester per bygg er derfor ukjente. Dette er den enkeltkilden som ville løst flest tidsfølsomme spørsmål.
- **FINN-annonser endrer seg.** Parktunet-annonsen (finnkode 459052231) viste «sist endret 26.06.2026» i rårapporten, men 09.09.2026 ved kontroll. Alle FINN-baserte verdier må ha kontrolldato og oppfriskningsbehov.
- **Saltakshus L-tallet er ikke løst.** 39 opprinnelig tegnet, to slått sammen til én gir 38, tabellen sier 37. Uten kilde som forklarer differansen forblir sluttantallet `unresolved`. Kontrollpunkt K3.

---

## 9. Praktisk

- Arbeidskatalog for denne oppgaven: hovedrepoet `/Users/andreasharstad/Documents/placy`. Forskningsfilene ligger der, ikke i worktreen `/Users/andreasharstad/Documents/placy-leangenbukta` (den inneholder kodearbeidet U1–U4 og U8 på grenen `feat/leangenbukta-board`, 14 commits, ikke pushet).
- `pdftotext -layout` er tilgjengelig og fungerer på bestemmelsene og planbeskrivelsen. Plankartet og illustrasjonsplanen må leses visuelt.
- Plandokumentenes basis-URL: `https://www.trondheim.kommune.no/globalassets/10-bilder-og-filer/10-byutvikling/byplankontoret/1c_vedtatt-plan/2019/haakon-viis-gate-14.-r20160019/` med filnavnene `reguleringsbestemmelser.pdf`, `planbeskrivelse.pdf`, `reguleringskart.pdf`, `illustrasjonsplan.pdf`.
- Planside: `https://www.trondheim.kommune.no/haakon-viis-gate-14-r20160019/`
