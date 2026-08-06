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

## 2026-08-06 — Side-gig-sporet åpnet: gjenbruks-enheten er stacken, ikke produktformen. Midtbyen først, Open House som referansestige

**Beslutning/innsikt:** Startet med en turisme-tanke fra London (Citymapper) og endte med et arbeidsprinsipp + ett konkret prospekt. Ingen kontakt tatt, ingen pris besluttet.

1. **Citymapper-innsikten overføres som produkt, ikke som forretningsmodell.** Andreas: appen gjorde at de kom seg til helt ulike deler av London *fordi de stolte på den*. Presiseringen som gjør den brukbar: Citymapper viste dem ikke bedre steder — den gjorde at de stolte på at de **kom seg dit**. Atferdsendringen kom fra transportlaget, ikke POI-laget. **Citymapper selger rekkevidde; Placy selger i dag steder med avstand påklistret.** Forretningsmodell-lærdommen er negativ og det er poenget: Citymapper er lærebok-eksempelet på gapet mellom skapt og fanget verdi (~50 MUSD reist, måtte klatre ned i transaksjonslaget — Pass, egen buss, Ride — før Via kjøpte dem i 2023). **Byen som tjente mest, betalte minst.** Betalerkartet fra 2026-05-06 står dermed urørt: turisme gjenåpnes ikke. **Gratis høsting inn i eiendomssporet:** ram nivå 1 rundt *rekkevidde* i stedet for nærhet — Time Budget (5/10/15) finnes alt, men som filter; forfremmet til overskrift treffer det FINN-svakheten fra 08-04 («scorer beskriver et sted, rekkevidde beskriver livet ditt derfra») og ligger på Marketer-siden av kjøp-vs-bygg-streken.

2. **Side-gig-prinsippet — første formulering forkastet samme dag, og den nye er løsere.** Claudes utgangspunkt var *«side gigs betaler seg bare når leveransen er konfigurasjon av eksisterende produkt»*. Andreas avviste den: vi må ha maks fleksibilitet, side gigs kan godt være **faktiske egne applikasjoner** som gjenbruker tech og kompetanse fra miljøet, og leveransene skal kunne utvikle seg over tid. **Han har rett, og regelen var trukket fra feil økonomi** — «ingen custom» er en regel fra da byggekostnad var arbeidstimer. Med agent-kapasitet er marginalkostnaden for en egen app som gjenbruker `lib/` dramatisk lavere. SEO er det avgjørende moteksempelet: rapport-boardet er en **innebygd** flate som lever inne på andres sider og ikke skal rangere, mens en Midtbyen-katalog skal rangere på «klesbutikk Trondheim sentrum» — server-rendret side per virksomhet, egen sitemap. Det er ikke en toggle, det er en annen renderingsstrategi, og den gamle regelen ville forbudt riktig løsning.

   **Gjeldende formulering:** *gjenbruks-enheten er **stacken og dataene**, ikke produktformen.* Fabrikken (Next + Supabase v2 + kartmotorene + provisjonerings-pipelinen + Moat-1-kurering + editorial-genereringen + ops-skillene) kan lage flere produkter. Tre tester erstatter den binære:
   - **Substrat** — kjører den på eksisterende stack og gjenbruker `lib/`? *Egen app: ja. Egen stack: nei.*
   - **Avsetning** — legger den igjen noe i det delte laget som neste leveranse arver (Moat-1-data, `lib/`-modul, i18n på board-flaten, SEO-flate)? Ingenting igjen → ren konsulentinntekt: helt greit, men **pris den som det** og ikke forveksle den med å bygge selskap.
   - **Drift** — hvem eier den om 12 måneder, og er det betalt for? Uvedlikeholdte apper er gjeld, ikke referanser.

   **Det kapasitet IKKE senker:** vedlikeholdsflaten (ti apper × litt vedlikehold dreper solo-operasjoner), Andreas' oppmerksomhet (flaskehalsen er kundesamtaler og scoping, ikke tasting), og kontekst-skatten per ekstra kodebase.

   **Strukturell beslutning som følger:** **samme repo, egen route-namespace** (`app/midtbyen/…`) — ikke eget repo per gig, fordi delt `lib/` *er* poenget og repo-splitt ødelegger gjenbruken. Egen Vercel-deploy og eget domene kan komme når en kunde krever det, uten splitt. **Prisen:** når `lib/` får to konsumenter er den ikke lenger intern — den blir et grensesnitt som ikke kan endres fritt.

3. **`midtbyen.no/shopping` består testen — men to premisser måtte korrigeres.** Verifisert ved telling i DOM: **147 virksomheter i en alfabetisk tekstliste** (navn, adresse, Google Maps-lenke, nettside-lenke), **28** kategorifiltre, 140/147 tar Midtbykort, **null kart**, WordPress — og alle 147 ligger i rå-HTML fra et vanlig GET. *(Første anslag i denne økta sa «280+»; det var en tekstlesning, ikke en telling. De «250 ulike steder» MM oppgir er alle Midtbykort-brukersteder, et annet og større sett.)* Gapet er ekte. Men (a) **det er ikke nivå 1** — ingen home i datamodellen, 147 POI-er, verdien *er* katalogen; formen er **event-boardet** (Variant A, `feat/event-board-foundation`), som er designet for nøyaktig mange kategorier × mange punkter → konfigurasjon, ikke bygg. Og (b) **pitchen ligger ikke i shopping, men i Midtbykortet** — MMs eget kommersielle produkt. *«Hvor kan jeg bruke kortet mitt nå»* er salgsstøtte for noe de tjener på og måler; shopping-kart er nice-to-have, innløste Midtbykort er en budsjettlinje.

4. **QR-inversjonen oppløser innvendingen fra 2026-05-06 uten å motsi den.** Butikkene får spørsmål i kassa fra turister og lokale om hva man bør få med seg i nærheten. Rollene snur: **MM kjøper ett board, butikkene får QR-en gratis som medlemsgode** — 147 distribusjonspunkter, én faktura, butikken betaler ikke. 05-06 forkastet å selge til butikker **enkeltvis** («30+ separate salg»); ett board til MM som organisasjon står ved siden av den beslutningen. **Maskineriet finnes:** self-serve gjør alt adresse → nivå-1-board → delingsside med QR og `?src=` (`feat/megler-self-serve`, umerget) — hver butikks QR forankrer flaten i butikkens koordinater. **Økonomien holder på per-strøk-amortisering: Midtbyen er ett strøk**, kurert én gang for alle 147 ankerpunkter.

5. **Målet akkurat nå er levere + tjene + LÆRE — og referanseverdien slår direkteverdien.** Andreas: *«akkurat nå vil jeg bare ha noe å kunne levere og få tjent noe på, samt lære.»* Læring er dermed et eksplisitt leveransemål, ikke en bieffekt: et gig som lærer oss en ny leveranseform (SEO-katalog, flerspråklig flate, festival-/tidsvindu-produkt) har verdi selv ved lav margin. **Referansestigen har fått navn: Open House.** Verifisert 2026-08-06 — Open House Worldwide er **60 organisasjoner** administrert av Open City (UK-registrert charity), desentralisert med lokal autonomi per by; **Oslo og Bergen er begge medlemmer** (også Stockholm, København, Helsinki); 2023 samlet 1,2 mill. besøkende, **6 250 bygninger/aktiviteter**, 14 460 frivillige. Stigen Andreas beskriver: rimelig, testbar løsning til Oslo/Bergen → validering *«dette hjalp oss faktisk»* → oppover i bystørrelse mot London Open House. **Produktformen er allerede bygd og validert** — en festival med daterte, åpne bygninger som skal filtreres og kartfestes *er* event-boardet (Variant A, Kulturnatt). Direkteverdien er lav, referanseverdien høy: det kjøper posisjonen at **Placy ikke er rettet mot én spesifikk løsning, men er kurator og stedsforvalter på tvers av produkt 1/2/3** — Andreas' formulering: *«litt som Marketer»*. **Merk at Marketer-analogien nå har to lesninger som ikke må blandes:** 2026-06-02 brukte den som *konkurrent* (de eier transaksjonslaget, vi eier kontekstlaget), her brukes den som *forbilde for selskapsform* (flere produkter, én posisjon i stedsbransjen). Begge kan være sanne — men **foran en megler er Marketer konkurrent, ikke rollemodell.** Andreas flagger også at det ligger mye Moat-1- og Moat-2-verdi i disse gigene som kan komme Placy til gode strategisk og i videre salg (6 250 bygg over 60 byer er inventar ingen andre har) — notert som **retning, ikke bygg-nå**, konsistent med moat-build-input-rapportene.

**Tre gap, ett av dem ikke konfigurasjon:** (a) kategoriene er boligkjøper-taksonomi, besøkende spør om kaffe/mat/severdigheter — eget kategorisett må defineres; (b) **engelsk er halvveis bygd — verifisert i koden:** `lib/i18n/` finnes med `Locale = "no" | "en"` og Supabase-lagrede oversettelser, koblet inn i rapport/reels/paraform, men **null i18n-bruk i board-mappa** → engelsk på flaten er ekte arbeid, **skal ikke loves i møte**; (c) vedlikehold — 147 butikker roterer, utdatert kopi er verre enn ingen kart.

**Pris: ikke 10k engangs.** Enten sync mot WordPress + løpende (~15k oppsett + 2–3k/mnd) eller 10k med skriftlig «vi oppdaterer ikke». Manuelt vedlikehold uten løpende betaling er fella. **Måling skal ikke selges:** argumentet som gjør det til abonnement (147 skannepunkter = etterspørselsdata ingen i Trondheim har, jf. medlemsrapport-framingen fra 05-06) hviler på Moat-2-tracking som Andreas **fastslo 2026-08-06 ikke er ordentlig bygd** → fase 2 med egen prislapp, ikke en egenskap ved leveransen.

**Disiplin:** vinkelen vokste i samtalen fra «10k side gig» til «by-dekkende distribusjonsprodukt med engelsk og egen taksonomi» — nøyaktig driften som utsetter inntekten. **Selg shopping-kartet, ship det, la QR-asken komme fra dem.** Rekkefølge: **iPhone-verifiseringen av Wesselsløkka-boardet er fortsatt blokkerende** og billig → den først; Midtbyen-demoen er en datainnlesning fra en offentlig WP-side, ikke et prosjekt. 10k er ~1,5 % av Wesselsløkka-asken — referansen og kontantstrømmen er poenget, ikke pengene.

**Begrunnelse:** Midtbyen gir sammensatt verdi utover cash: **Moat 1-inventar** (147 kuraterte sentrumsvirksomheter, og Midtbyen overlapper EM1 Sentrum Søndregates strøk), **embed-bevis nr. 2** (WordPress etter Squarespace → to levende embeds å vise Einar, mot EM1-veggen som ikke slipper inn noe), og **et objekt for VT-referansen** (Kari skulle «anbefale, ikke distribuere» — en levende integrasjon gjør anbefalingen konkret).

**Detaljer:** `docs/strategy/2026-08-06-midtbyen-side-gig-og-citymapper-innsikten.md` — full sideanalyse, i18n-verifisering, prisformer, kjøper-analyse.

**Status:** Aktiv — side-gig-sporet åpnet, tre-testene gjelder, Midtbyen anbefalt som første leveranse (ikke besluttet, ingen kontakt tatt). Åpent: (a) **hvem eier `midtbyen.no`** — Sissel er arrangementskoordinator, ikke nettside-eier; samme jobb som avslørte Einar hos HEM, og blokkerende for pitch; (b) **Vigdis eller Kari?** — Andreas refererte til «Vigdis på Visit Trondheim», `aktor-map.md` har Kari Aarnes som markedssjef; uavklart om det er en ny person eller navneforveksling (presedens: «Cicero og Karesan» 05-06); (c) kategorisett for besøkende-board; (d) estimat på engelsk board-flate (blokkerer Open House-stigen like mye som Midtbyen); (e) prisform; (f) **Open House: hvilken by først, Oslo eller Bergen**, og går man via lokal festival eller via Open City sentralt; ingen kontakt kartlagt, ingen av dem i `aktor-map.md` ennå.

---

## 2026-08-05 — Kjøperen hos HEM har navn: Einar Ringen Jr. Fire designere, null utviklere — og «vi sparer dere arbeid» er dødt som argument

**Beslutning/innsikt:** Startet som en teknisk observasjon (Andreas: `wesselslokka.no` krasjer på Chrome/iPhone) og endte som en organisasjonsanalyse som flytter kjøper, pris-argument og demo-krav.

1. **Krasjet er verifisert med skjermopptak, og mekanismen er entydig.** iPhone 14/15/16 Pro-klasse (1180×2556), Chrome iOS, **inkognito, én fane** → tanketrykk utelukket. Frame-analyse: kl. 22,35 s blir hele viewporten grå — **også headeren, på én frame** — deretter hvitt, stille reload, og kl. 29,9 s «Can't open this page — Restart Chrome / Restart your device». Headeren som forsvinner samtidig med innholdet er beviset: **iOS avvikler WebKit-innholdsprosessen for minnebruk**, ikke en JS-feil (den ville latt DOM-en stå malt). Målt: 2,39 MB dokument, 1 876 elementer, **312 inline `<style>`-blokker/339 KB CSS**, 18 seksjoner alt på `/`, 31 bilder → **~103 MB dekodet RAM**, 5 WebGL-shader-effekter lastet uansett, Marketer-iframen opprettet ved sidelast i full høyde uten `lazy`. **Kritisk presisering:** kartet er *ikke* minnesluket (plukker `1500w` = 462 KB). Årsaken er **kumulativ** → si aldri «kartet deres krasjer siden» (falsifiserbart); det holdbare er *«én-sideren akkumulerer til den dør, og den dør konsekvent i nabolagsseksjonen.»*
2. **Siden er in-house, ikke byrå — og markedsavdelingen er fire designere uten én utvikler.** Kodeforensikk: ingen byråkreditt noe sted, **custom CSS er 397 bytes** (bare to `@font-face` for Adobe Fonts + fire font-overstyringer, null layout), Squarespace 7.1, blokk-ID-tidsstempler → bygd des. 2024, tyngst feb–mar 2025, **redigert jevnt frem til 3. juli 2026** (noen logger inn månedlig). Teamet: Sara Venturi + Terje Brandslet (art director), Ragnhild Hov + Bjørn Vegar Torseth (grafisk designer), **Einar Ringen Jr. (it- og markedssjef)**, Martin Holmøy Berg (it- og markedskonsulent). **«IT» er slått sammen med «marked» i begge de to siste titlene** — systemer og verktøy, ikke ingeniørarbeid.
3. **Einar Ringen Jr. er kjøperen, bekreftet av Vitec selv.** `vitecnext.no/aktuelt/velkommen-til-alle-vare-nye-kunder-i-q1-2023` (11.05.2023): **Heimdal gikk live på Next Megler Suite i Q1 2023** (med Aktiv, Rede, Attentus), og pressemeldingens sitat er Einars, som «It og markedssjef Heimdal». Samme tittel i 2023 og på hem.no i 2026 → stabil i rollen, og han **eide fagsystem-migreringen**. Tre følger: (a) han eier Vitec-relasjonen → **vinner vi HEM, er han den varme introen til Vitec**, kortere enn Nordvik-veien i 07-09; (b) **kanalkonflikten fra 08-04 er ikke to kjøpere, det er én person** — han kjøper både prosjekt-SKU-en og grunnpakken på ~1 700 bruktboliger, så **regn aldri per enhet foran ham** (492 kr/enhet var intern fornuftssjekk, ikke argument); (c) han har alt gjennomført en full fagsystem-migrering → kan vurdere en integrasjon og har tyngde til å dytte den.
4. **Marginalkostnad-inversjonen dreper et argument vi hadde.** Fire designere på lønn = **~0 kr marginalkostnad for ett områdekart til**. «Vi sparer dere for en designer-ettermiddag» er verdt ingenting hos HEM, og den vinkelen lå implisitt i flere loggførte pitch-former. Men de har tegnet sin egen kjøp-vs-bygg-grense og bevisene ligger på samme side: **kart/områdetekst/gangtider laget selv — boligvelgeren kjøpt fra Marketer.** Fire designere og null utviklere kan ikke lage noe som **oppdaterer seg**, som er **interaktivt**, eller som **måler**. Placy må ligge på Marketer-siden av streken; demoen kan ikke se ut som et penere kart.

**Beslutning (kontaktrekkefølge, erstatter «Løbakk er døra» som hele planen):** **Einar Ringen Jr. = kjøperen** (verktøy, budsjett, Vitec, ingen eierskap til det håndtegnede kartet) · **Thomas Løbakk = etterspørselen** (vil selge leiligheter, skaper trekket) · **Martin Holmøy Berg = implementeringen** (limer inn Code Block-en) · **de fire designerne = risikoen**, aldri inngangen. **Absolutt forbud: ingen antydning om at siden eller kartet er amatørmessig** — Venturi eller Brandslet har laget det.

**Begrunnelse:** Krasjet var i seg selv ingen pitch (vi er ikke ytelsesleverandør), men det tvang fram spørsmålet «hvem lager dette», og svaret flyttet kjøperen fra en prosjektleder til systemeieren — som også er grunnpakke-kjøperen og Vitec-døra. Samtidig falsifiserte teamsammensetningen arbeidsbesparelse som verdi-akse.

**Nytt blokkerende krav:** **verifiser vårt eget Wesselsløkka-board på samme telefon, inkognito, én fane, samme scroll — før noen kontaktes.** Boardet er `reportTier: 2` + `has_3d_addon: true` = det tyngste vi har. Dør det på samme enhet, er hele vinkelen giftig og det må vites først.

**Detaljer:** `2026-08-04-objektside-veggen-hem-og-nabolagsprofil-benchmark.md` **§5d** (full måletabell, defektliste, tiltaksrekkefølge, teamtabell, rollefordeling).

**Tillegg samme dag — live DOM-inspeksjon av en `hem.no`-bruktannonse (§5e):** Svaret på «kan vi iframe inn Placy på bruktbolig» er **ja, uten hindringer** — **ingen CSP i det hele tatt** (`x-frame-options: SAMEORIGIN` gjelder andre som rammer hem.no), `x-powered-by: Craft CMS, Blitz`, Tailwind. GUID-en i stien bekrefter Vitec→Craft-modellen. Men tre funn snur hvor vi skal peke:

1. **`hem.no` er IKKE amatørmessig — det er prosjektsiden som er unntaket.** Annonsesiden kjører **Microsoft Clarity (session recording, live)**, Sentry, Cookiebot, GTM, GA4, Facebook, Snapchat, DoubleClick. **Einar er ikke en naiv kjøper** — forvent spørsmål om cookies, samtykkekategori, GTM/Clarity-synlighet og ytelseskost. Ingen byråkreditt i footeren → Mustasj ubekreftet.
2. **Slotten er et kart de har bygd selv — og det viser dem, ikke nabolaget.** Leaflet 1.9.4 + OpenFreeMap-fliser, 668×401. Markører i DOM: **12 = 1 bolig + 11 HEM-kontorer. Null nabolags-POI-er** (barnehage/holdeplass man ser er bakt inn i flisene). Pitchen skriver seg selv, uten fornærmelse: **«kartet deres viser hvor HEM ligger, ikke hvor kjøperen skal gå.»**
3. **FINNs posisjon er svakere enn §5 antok.** Objektsiden er 10 kollapsede trekkspill, og **Nabolagsprofil er nr. 9 av 10**, kollapset, iframen laster **ikke** ved scroll — bare ved klikk (verifisert). «Servert av en betalende inkumbent» overdriver: FINN har en plass, ikke oppmerksomhet. Riktig slot = **kartet**, eller **«Beliggenhet og tomteforhold» (nr. 4)**. Ytelsesinnvendingen forsvinner samtidig: trekkspill-gated lazyload koster 0 før klikk.

**Åpningsspørsmål til Einar, besvarbart i Clarity på minutter:** *«hvor mange av dem som åpner en annonse, åpner Nabolagsprofil-fanen?»* Lavt svar = FINNs plass er verdiløs, grepet er å flytte stedsinnhold opp. Høyt svar = dokumentert etterspørsel. **Demo byggbar i dag:** annonsen er Hasselbakkvegen 5B, **Charlottenlund** = kuratert strøk med `boundary` → side-ved-side på en faktisk aktiv HEM-annonse uten ny kuratering. Men den er merket **«TRONDHEIM ØST»** — EM1-eksklusivitetskonflikten har nå en adresse. **Rettelse:** nybygg og brukt er ikke like enkle — Squarespace Embed Block limes inn av Martin selv, mens Craft-malen er en utviklerjobb med kø og budsjettlinje. Nybygg først står, men begrunnelsen er friksjon, ikke mulighet.

**Byrået bekreftet: Mustasj (Trondheim).** `mustasj.no/arbeid/hem` — de **bygde og drifter `hem.no`** (Craft CMS + Nuxt + ElasticSearch), **samarbeid siden 2015**, og **de bygde integrasjonen mot HEMs meglersystem**. Kontakt på casen: **Mads**. Fire følger: (1) portvokter for bruktbolig-asken (Twig-endring på driftsavtale **Einar eier** = kostnadslinje + kø, ikke blokker); (2) samtidig teknisk beste motpart — Vitec-dataene flyter alt i kode de eier; (3) **HEM er deres eneste eiendomskunde** av 14 prosjekter → ingen meglerkanal, ikke overvurder; (4) **men SpareBank 1 SMN er kunde ×2** (Pengesmart, samfunnsnytte) — SMN eier EM1 Midt-Norge og `ffe-*` Felles Front End, altså veggen i §1 → **andrehånds-vei inn i SMNs digitale organisasjon**, med tydelig forbehold: en læringsapp gir ikke commit-rett i FFE, som deles av 12 selskap. **Anbefaling: ikke gå til Mustasj før Einar** — byrå før kunde gjør oss til en leverandør som pitcher en underleverandør; nevn dem kunnskapsrikt i møtet for å avdramatisere asken.

**Status:** Aktiv. Åpent: (a) hvem tar Einar-kontakten — Andreas eller Aleksander (term sheet fortsatt usignert, og verdien nedstrøms er 0,85–1,4M/år + Vitec-døra); (b) iPhone-verifisering av vårt board (blokkerende); (c) radius-driften i `editorial.body` er nå en leveransemangel, ikke bare en visnings-innvending; (d) skal krasjfunnet i det hele tatt nevnes i første møte, eller bare brukes til å forstå hvorfor mobil er vanskelig.

---

## 2026-08-04 (forts. 4) — Wesselsløkka priset: 122 leiligheter, HEM eier siden, Marketer er alt embeddet, og premien er Brøset — ikke Wesselsløkka

**Beslutning/innsikt:** Andreas ba om et pristall for en nivå-1-/nivå-2-leveranse til Wesselsløkka, og om Aleks er rett person til å eie prisingen. Full sideinspeksjon av `wesselslokka.no` ga fire funn som flytter både pitchen og prisen:

1. **Prosjektfakta + korreksjon:** **122 leiligheter** (trinn 1 av Brøset; salgsstart våren 2025, «årets mestselgende nyboliglansering 2025», innflytting 1H 2027, senest 30.04.28). **StasjonsKvartalet er 235** → Wesselsløkka er *litt over halvparten* så stort i enheter, på en billigere adresse. Andreas' premiss «enormt mye større enn StasjonsKvartalet» er **invertert på enheter** og må ikke brukes mot Aleks (han har sett StasjonsKvartalets boligvelger). Det holdbare argumentet er **Brøset som bydel**, ikke prosjektstørrelse.
2. **HEM eier nettsiden — kjøperen er megleren, ikke utbyggeren.** Footer: «Heimdal Eiendomsmegling AS | © 2025». Seks navngitte meglere, alle `@hem.no`, med direktenummer — **Thomas Løbakk, prosjektleder og eiendomsmegler, tl@hem.no / 930 29 952** er døra. Dette **erstatter motvekt 3 i §5b** (Brøset Utvikling AS var feil kjøper): døra har navn, men **kanalkonflikten sitter i samme rom fra første møte**, siden HEM både betaler for prosjektet og er grunnpakke-prospektet.
3. **Marketer er allerede embeddet der.** Boligvelgeren er Marketers `property-explorer` (prosjekt `1ad192db-…`) som `<script>` i en **Squarespace Embed Block**. «Kan Placy embeddes her» er dermed besvart **ja, av en konkurrent, på samme side** — asken er «én blokk til». Samme leverandør som StasjonsKvartalet → head-to-head-en fra 06-02 er reell, og posisjonen holder: **Marketer eier boligvelgeren, nabolaget er en lenke ut til FINN.**
4. **FINN Nabolagsprofil er der i svakest mulige form** — `<a href="profil.nabolag.no/3732299" target="_blank">Åpne nabolagsprofil</a>`, en knapp som sender trafikk *ut* av prosjektsiden. (Kontrast: på `hem.no`s bruktannonser ligger samme leverandør som **ekte iframe**.) Skarpeste argument, og det handler ikke om dybde: *«dere sender folk til FINN for å lese om nabolaget. Vi lar dem lese det hos dere.»* **Og de har skrevet Placy nivå 1 for hånd:** manuell gangtid-prosa i en accordion (Brøset barnehage 8 min, Eberg skole 10, Blussuvoll 13, Strinda vgs 15, Brøset idrettsplass 3, Valentinlystsenteret 4–5 …) + FINNs scorer kopiert inn som brødtekst («svært trygt (89/100)», «lavt støynivå (90/100)»). Argumentet mot scorene trenger ikke føres — de har selv vist at de bare hadde dem å ta av.

**Prisanbefaling:** **nivå 1 er feil SKU** (for en prosjektselger er det ikke billigere, det er dårligere — boardet vårt er alt tier 2; tallet er 25–40k/12 mnd, men skal ikke være åpningen). **Listepris nivå 2 = 250k/24 mnd (Aleks' anker, urørt). Selg 60k/6 mnd** — pro rata, ikke rabatt (250k/24 ≈ 10,4k/mnd); 6 mnd og ikke 3 fordi nybygg selges over kvartaler. **Gulv 40k, aldri gratis.** Per-enhet-forsvaret er innebygd: 60k/122 = **492 kr/enhet**, midt i grunnpakke-båndet 500–800. **Opptrappingen er Brøset som helhet, flere byggetrinn** — der ligger 250k-formen, og ett kuratert Brøset-strøk betjener hvert framtidig trinn (per-strøk-amortisering). **Prisankeret i rommet er Marketer-linja på samme side (50–200k setup, 06-02-estimat), aldri nabolagsprofil-linja** som er bundlet og billig og setter taket ved FINN. 3D-modell ute av scope (ikke bygd).

**Begrunnelse:** Wesselsløkka er ikke den største dealen, det er den beste inngangen — teknisk åpen flate med konkurrent-presedens, navngitt kontakt, og et validert premiss. Premien er ikke trinn 1 (122 enheter, 15 mnd inn i salget, mestselgende → hastverket er ikke deres), men **Brøset over flere byggetrinn** og nedstrøms HEMs ~1 700 bruktboliger/år (0,85–1,4M @ 500–800).

**Aleks:** ja, riktig person — han skal eie pris-framingen. Brief: (1) 122 mot 235, (2) Marketer er på begge prosjektene han har sett, (3) kjøperen er **megler, ikke utbygger** → bryter med «utbygger-først»-spydspissen han anbefalte, (4) **forket bare han bør avgjøre: prises første deal som prosjektmarkedsføring (HEMs budsjett, lavere tall, åpner bruktsiden) eller som utbygger-leveranse (høyere tall, bevarer 250k-ankeret)?** Det setter ankeret for begge sporene. **Term sheet bør signeres før han tar en kontakt verdt 0,85–1,4M/år nedstrøms.**

**Detaljer:** `2026-08-04-objektside-veggen-hem-og-nabolagsprofil-benchmark.md` §5c (full inspeksjon + pristabell + Aleks-brief).

**Status:** Aktiv — pristall anbefalt, ikke besluttet. Åpent: (a) prosjektmarkedsføring vs. utbygger-SKU (Aleks' fork), (b) samlet salgsverdi uverifisert (prisliste bak Dropbox-JS; grovt anslag 450–600M), (c) board-oppryddingen på Wesselsløkka er fortsatt en visnings-blokker (radius-drift i `editorial.body`), (d) hvem tar kontakten med Løbakk.

---

## 2026-08-04 (forts. 3) — Wesselsløkka er den varme døra inn til HEM, og `wesselslokka.no` kan embedde Placy i dag uten utvikler

**Beslutning/innsikt:** Andreas pekte på `wesselslokka.no` — «sånne som Wesselsløkka, det er jo via Heimdal Eiendom; de jobber mye med å vise fram området, de har til og med en stor fysisk 3D-modell på visningssenteret.» Fire funn:

1. **Konsernrelasjonen gjør dette til et HEM-oppdrag, ikke en omvei til utbygger-sporet.** **Heimdal Bolig** er utbygger, **HEM selger** (`prosjekt.hem.no/wesselslokka` + annonser på `hem.no`), og **Heimdal Gruppen AS er blant HEMs største eiere** (med MelhusBanken + ansatte). Stigen: prosjekt → referanse inne i konsernet → HEMs bruktbolig-meglere → embed-asken på objektsidene. **Dette lukker åpen beslutning «hvem tar HEM / ingen varm kontakt».**

2. **`wesselslokka.no` kan embedde oss i dag, uten utvikler.** Squarespace, **ingen CSP**, og de har alt iframes på siden («Bestill avtale» med `allow="payment"`, Google Maps, Vimeo). Squarespace har innebygd Code/Embed-blokk → en markedsperson limer inn iframen i editoren på minutter. Siden har alt seksjonene «Området» og «Kart». **Første sted Placy faktisk kan leve på en ekte eiendomsside.** (`prosjekt.hem.no/wesselslokka` er HEMs Craft-hub som 301-er videre med UTM-tagger; for prosjekter uten egen side hoster den antakelig hele siden = uverifisert mini-wedge.)

3. **Boardet står klart, med kjente hull.** `placy.no/eiendom/broset-utvikling-as/wesselslokka/rapport-board` → **200**. `reportTier: 2`, `has_3d_addon: true`, `homepage_url` peker alt på deres side, senteret ligger **innenfor Eberg-polygonet** (ingen geofence-vegg). Hull verifisert: `opplevelser` mangler `editorial` helt og har tynn pool (5 POI-er, 4 bibliotek); `highlightPoiIds` tom på `barn-oppvekst` + `transport` (verifiserte kandidater notert i doccen). **Og en visnings-blokker: radius-drift i `editorial.body`** — `barn-oppvekst.body` sier «Domkirken, Singsaker og Prestegårdsjordet barnehage … innenfor noen hundre meter» mens `leadText` på samme tema korrekt sier «Eberg skole er nærmeste barneskole». Samme i `transport` og `natur-friluftsliv`. `leadText` er riktig, `editorial.body` har driftet (sannsynligvis 2 500 m discovery-radius). **Samme feilklasse vi kritiserer FINN for.** Andreas utsatte oppryddingen; ingenting er skrevet til prod (backup: `$CLAUDE_JOB_DIR/tmp/wl-product-backup.json`).

4. **3D-modell i Placy-kartet: mekanismen finnes, men er ikke bygd.** Google 3D Maps støtter georefererte glTF/GLB (`gmp-model-3d` / `Model3DElement`) i de fotorealistiske flisene — **null treff** på `gmp-model-3d`, `Model3DElement`, `.glb`, `gltf` i `lib/`, `components/`, `app/`. Et render (JPG) kan ikke bli en modell. **Riktig kilde er utbyggerens egen fil:** BIM/IFC fra arkitekt (IFC → glTF er standard), visualiseringsmodellen bak renderne, eller filen den fysiske modellen ble fresset fra — fire produkter fra samme kilde, så asken *«send oss IFC-en eller GLB-en»* er liten. **Billig 80/20 uten modell: massing** (fotavtrykk + gesimshøyder fra situasjonsplan, ekstruderte volumer — detaljerte fasader blir uhyggelige, massing sjelden, og det skalerer til alle prosjekter). Forbehold: en modell i et kart leser som mer faktisk enn et render → deres «illustrativ karakter»-disclaimer må følge med, og nøyaktigheten bør være deres ansvar via deres fil. **Addon-SKU, aldri i et grunnpakke-møte.**

**Begrunnelse:** Etter at embed-hypotesen for EM1 falt (entry over), manglet Placy et sted der embed faktisk er mulig *og* kontakten er varm. Wesselsløkka er begge: teknisk åpen flate, konsern-relasjon inn til HEMs bruktside, og et board som alt lever med 3D-flagget på. Og de har alt kjøpt premisset — «Norges grønneste nabolag», 10-minutters-byen, infosenter med fysisk 3D-modell + Vimeo-film av den. Ingen overbevisningsjobb på at nærområdet selger.

**Rekkefølge-konsekvens: Wesselsløkka bør gå FØR EM1-møtet.** Et møte der du kan si «her ligger det, live, på en ekte prosjektside» er et annet møte enn ett der embed er hypotetisk.

**Tre motvekter (i doccen):** (a) den fysiske 3D-modellen er både åpning og innvending — foregrip «vi har alt en 3D-modell» med at deres modell viser *utbyggingen*, Placy viser *nabolaget*, og deres står i et infosenter åpent tirsdager kl. 12; (b) **prisankeret** — nybygg er utbygger-penger, så to-SKU-skillet må sies høyt fra første møte, ellers har HEMs bruktside hørt «Placy koster X for et prosjekt» før grunnpakke-samtalen (kanalkonflikten fra 06-25 §3); (c) **kjøperen i vår DB er Brøset Utvikling AS**, ikke Heimdal Bolig og ikke HEM — sannsynligvis et JV, så introen til bruktsiden må bes om eksplisitt, ikke antas.

**Koordinering:** Wesselsløkka ligger midt på skjøten mellom Aleksanders utbygger-mandat (06-23, term sheet **ikke signert**) og Andreas' megler-spor. **Avklar eierskap til kontakten før noen tar den.**

**Detaljer:** `docs/strategy/2026-08-04-objektside-veggen-hem-og-nabolagsprofil-benchmark.md` §5b (komplett, inkl. verifiserte highlight-kandidater og 3D-vurderingen) + åpne beslutninger 6–7.

**Status:** Aktiv. Wesselsløkka løftet til første steg i HEM-sporet, foran EM1-møtet. Board-oppryddingen er utsatt av Andreas, men er en visnings-blokker.

---

## 2026-08-04 (forts. 2) — EMBED PÅ EM1s OBJEKTSIDE ER UMULIG: veggen kartlagt, HEM identifisert som eneste embed-kandidat, og FINN Nabolagsprofil benchmarket på egen adresse

**Beslutning/innsikt:** Andreas ba om å definere **produktet og flyten** megleren gjennomfører, og stilte det avgjørende spørsmålet: *«vil en iframe kunne legges inn noe plass, eller må det faktisk utvikling til? Det er en stor utfordring i så fall.»* Sju funn:

1. **VEGGEN: interaktivt Placy-innhold kan ikke legges på `eiendomsmegler1.no`s objektsider uten at plattform-eier bygger det.** DOM-nivå-verifisering på 153 annonsesider: **0 iframes, 0 `dangerouslySetInnerHTML`**; whitelisten fra meglerens tekstfelt er `<li>` `<ul>` `<br>` `<strong>` og ingenting mer; **0 `<a>`-elementer** i tekstblokkene mot **108 URL-er som ligger som død klartekst** der (regjeringen.no, klarefinans.no, nbbl.no). Ikke engang en lenke overlever. **Eierne er navngitt:** nettstedet bruker `ffe-*` = SpareBank 1s **Felles Front End**, delt av alle 12 regionselskapene (et kontor kan ikke shippe noe, EM1 Midt-Norge sannsynligvis ikke alene heller); objektet lever i **Webtop Solutions** (`em1.webtopsolutions.com/flow/api/Public/Cases/<guid>`, bud/visning på `/tide/`) — del av **Visma Real Estate** siden 2021. Minste tenkelige dev-ask: `videos[].url` er et fritt megler-felt (5 av 153 bruker det med tre ulike URL-former) → **én host i en whitelist**, ikke en ny komponent.

2. **Salgsoppgaven er en PDF, ikke en flate.** `content-type: application/pdf`, `filename=Salgsoppgave - Østmovegen 6 D.pdf.pdf`. Håpet om en dyp megler-kontrollert HTML-flate er avvist.

3. **QR feiler for FINN-på-mobil** (Andreas' innvending, korrekt): du kan ikke skanne din egen skjerm; utveiene (Android Circle to Search, iOS skjermbilde→Live Text) er ekspert-atferd. **QR hører til papir** — prospekt på visningen, plakat, skilt. **Karusellen vil ha nabolagskartet, ikke en peker til det:** slot'en godtar ikke-foto (plantegning er standard, EM1 rendrer alt et Google statisk kart), hvert bilde har et megler-skrevet `caption`-felt, og bildet virker **på FINN *og* på eiendomsmegler1.no uten én linje utvikling**. Nytt artefakt: **nabolagskart-bildegenerator**, 1–3 slides fra samme bestilling. Prisen sagt ærlig: **et bilde gir null måling** → målingen flyttes til visningsbekreftelsen fra Webtop Tide (trykkbar, megler-kontrollert, høyest intensjon i løpet).

4. **Produkt/flyt: ~80 % er bygd.** `feat/megler-self-serve` har adresse→board→delingsside (lenke `?src=finn` / iframe `?embed=1` / QR `?src=qr`) og inline `provisionReportBoard()` ≈ «et par minutter». **Det som mangler er auth** (`app/megler/`, `components/megler/`, `lib/megler/` har null treff på auth/session/login; `/megler/[slug]` er åpen URL) → anbefaling **magic link + e-postdomene-allowlist per kontor** (`broker_offices`, 081), **ikke Google SSO** (SpareBank 1-eid → Microsoft/Entra). Tre felt til, ikke mer: hvilken megler, valgfri annonse-URL, og e-post faller bort. Nytt leveranse-artefakt: «i salgsoppgaven»-blokk + karusellbildene.

5. **HEM (hem.no) er den eneste identifiserte kandidaten som kan bestemme seg for en embed alene.** Presedensen ligger på objektsiden deres og **den er en iframe**: `<iframe class="lazyload" data-src="https://profil.nabolag.no/<finnkode>?t=1">`, 700 × 700, under «Nabolagsprofil». **Ingen CSP, ingen X-Frame-Options.** Craft CMS (`generator: SEOmatic`), egen mal → asken er «legg inn én lazyload-iframe ved siden av den dere har» = tre linjer Twig. 561 aktive annonser; **fagsystem = Vitec Next** (`bud.vitecnext.no`, `meglervisning.no`), ikke Webtop. Selskap: 1996, **~2 574 salg i 2021 (882 prosjekt → ~1 700 brukt)**, 100+ ansatte, 9 kontor, eid av MelhusBanken/Heimdal Gruppen/ansatte — **ingen allianse over seg**. Grunnpakke @500–800 = **0,85–1,4M/år** mot Grilstadportens 100–160k. **Den nyttige oppdelingen: EM1 har innholdsproblemet men ingen slot (Placy selger arbeidet); HEM har sloten men har outsourcet innholdet (Placy selger flaten).** To pitcher, ingen forutsetter den andre.

6. **BENCHMARK mot FINN Nabolagsprofil på egen adresse — Østmovegen 6 D, Ranheim (finnkode 466816966).** Leverandør-korreksjon: `nabolag.no` redirigerer til `finn.no/nabolag/sporsmal` og kildesiden navngir **Finn.no som operatør** → det åpne spørsmålet i 07-09-doccen peker mot **FINN-operert**, ikke uavhengig Eiendomsprofil. Andreas' innvending (*«at 64 % er høflige er jo bare tull»*) er nå tallfestet: tre av fem scorer ligger **1–6 poeng fra bysnittet**, og **kollektiv 85 mot Trondheims 86 er merket «Meget godt kollektivtilbud» — under snittet.** Deres egen kildeside: vurderingene er *«aggregerte svar … om nabolagets kvaliteter og **inntrykk**»*, vist ved *«**mer enn 10 besvarelser**»*. **Tre demonstrerbare feil på vår adresse:** (a) «Kort gangavstand til offentlig transport» med knutepunkt på **20 min**; (b) «Gangavstand til skole» der Charlottenlund barneskole står med **5 min** som i deres payload er `distanceType: "drive"` — nærskolen Ranheim skole står med 11 min gange, så **en barnefamilie konkluderer med feil skole**; (c) adressen (7056 Ranheim) føres under nabolaget «Grillstad/Nerviksvegen», og de 82 lokalkjente har vurdert *det* området. **Og det avgjørende: produktet inneholder ikke ett sted et menneske ville valgt å gå til.** Kildene deres er våre (Entur + Google for reisetid, Geodata for sol/demografi/matrikkel) → fortrinnet er distribusjon, ikke data. **«Slåbar på dybde» (07-09) er for optimistisk formulert** — de har gangtidene og et eget lokalkunnskap-lag; det de mangler er stedene og målingen tilbake til megleren. **Egen svakhet i samme datasett:** vi har den samme gjenbruksfeilen vi anklager EM1 for (tre badeplasser ordrett identisk, to lekeplasser, to grøntområder, **to barnehager ord-for-ord identisk**, Hansbakken skole uten tekst, «Kort vei fra Overvik» på en Østmovegen-adresse). Andreas: demo-data, ingen ansvarssak — enig, men det er boardet Frank Robert klikker i. ~30 min opprydding, utsatt til møtet er bekreftet. **Produktkravet som følger: vinneren er spesifikk OG uangripelig** — det er derfor det kjedelige ble standarden (institusjonell dekning uten ansvarsflate).

7. **EKSKLUSIVITET KOSTER NÅ NOE KONKRET.** Kontor-pilot-doccens §6.1 sa markedseksklusivitet i Trondheim Øst «koster ingenting i dag». Sant til HEM ble identifisert. **Ny anbefaling: ikke tilby eksklusivitet i det hele tatt** (EM1 har ikke spurt), eller tegn den smalt — **bruktbolig / Trondheim Øst / kun pilotperioden**. Korreksjon underveis: HEM *har* Trondheim Øst-objekter (Brøsetvegen 2B m.fl.), så geografisk separasjon er mindre enn først antydet — men deres Trondheim Øst-portefølje er nesten utelukkende nybyggprosjekter.

**Begrunnelse:** Andreas' instinkt etter veggen var at veien går via leverandøren (Visma/Webtop) som selger inn i sitt eget system, og at det er Aleksanders BD-jobb. **Korrigert: objektsiden er ikke Webtops, den er SpareBank 1s FFE** → et Visma-partnerskap plasserer Placy i meglerens arbeidsflyt og i det som syndikeres, men SpareBank 1 må fortsatt rendre flaten. Visma er **distribusjonspartner, ikke embed-nøkkel**. Og sekvensen er hard: enhver systemleverandør spør «hvor mange av våre kunder ber om dette?» → **Visma-sporet krever at EM1 eller HEM lever først.** Aleksanders mandat var utbygger-først = relasjonssalg; enterprise-BD mot et programvarekonsern er en annen øvelse → **avklar profilen hans før sporet tildeles.**

**Anbefalt sekvens:** (1) kjør EM1-møtet med ærlig ramme — bilde i karusellen, lenke og QR i oppfølgingen, måling fra dag én, ikke embed; døra til Kristian kjøper **data, referanse og introduksjonen til EM1 Midt-Norge**, altså noe annet enn antatt men fortsatt det høyest verdsatte tilgjengelige. (2) Ingen eksklusivitet, eller smalt tegnet. (3) **HEM parallelt som embed-sporet.** (4) Visma parkert til én av dem lever med tall.

**Detaljer:** `docs/strategy/2026-08-04-objektside-veggen-hem-og-nabolagsprofil-benchmark.md` (komplett: §1 veggen, §2 PDF-en, §3 QR/karusell + megler-flate-rangering, §4 produkt/flyt mot faktisk kode, §5 HEM, §6 benchmarken, §7 konsekvenser). Kontor-pilot-doccen har fått **§3b** (veggen + tre endringer i piloten), korrigert **§6.1** (eksklusivitet), **byggliste 7** (karusell-bildegenerator) og **åpne beslutninger 7–8**.

**Metode-forbehold:** EM1-analysen er kjørt på det eksisterende 153-siders cachede datasettet (robots.txt forbyr systematisk innhenting) + én range-forespørsel mot Webtop-filendepunktet. `hem.no` tillater objektsider i robots.txt men Cloudflare blokkerer curl/WebFetch → inspisert i separat Chrome-instans med egen profil. `profil.nabolag.no` er offentlige iframe-URLer. **Datainnsamlingen skal ikke være en del av historien i noe møte.**

**Status:** Aktiv. **Embed-hypotesen for EM1 er FALSIFISERT** — piloten omdefinert til bevis + dør. HEM er nytt parallelt spor (embed), Visma parkert bak referanse. Fire nye åpne beslutninger: eksklusivitet ja/nei, HEM parallelt eller etter, hvem tar HEM (ingen varm kontakt), og Aleksanders BD-profil for Visma-sporet.

---

## 2026-08-04 (forts.) — Nærområde-premisset empirisk testet på 150 EM1-annonser: boilerplate-påstanden FALSIFISERT, eierskaps-vinkelen bekreftet — og megler-utvalg erstatter workshop som Moat-1-motor

**Beslutning/innsikt:** Andreas utfordret det bærende premisset i pitchen («samme tekst står i annonsene») og ba om faktisk validering. `locationDescription` (feltet som rendres i «Nærområdet»-accordionen) trukket ut fra RSC-payloaden på **150 annonser hos fire EM1-kontor i Trondheim** — Grilstadporten (36), Lade (36), Sentrum Søndregate (53), Valentinlyst (25) — alle samme juridiske enhet (EiendomsMegler 1 Midt-Norge). Gruppert på EM1s **eget** `address.area`-felt. Seks funn:

1. **BOILERPLATE-PÅSTANDEN FALSIFISERT.** Tomhet er ikke et kjede-problem: bruktbolig (n=139, 11 nybygg-prosjekter holdt utenfor) → **Grilstadporten 0 % tomme (36/36 har tekst), Lade 3 %, Sentrum Søndregate 7 %, Valentinlyst 84 %.** Uten Valentinlyst: 4 av 114. Tre av fire kontor er i praksis konsekvente. **Grilstadporten er det eneste kontoret på 0 %** — ekte, etterprøvbar ros, og møtets inngang. (Valentinlyst forfaller: 13/13 aktive tomme mot 8/12 solgte.) Verifisert med to uavhengige metoder. **Hadde påstanden blitt brukt i møtet, ville den blitt punktert av hvem som helst med en telefon.**

2. **Gjenbruk finnes overalt, og er verst hos Lade — ikke hos Grilstadporten.** 41 av 114 tekster (36 %) er del av en kopi-klynge: Lade 47 %, Søndregate 36 %, Grilstadporten 31 %. Største klynger: **Lilleby** 11 annonser → 5 tekster; **Ila** 9 → 4 (samme 515 tegn på fire enheter i Hans Nissens gate 3); **Solsiden** 5 → 3; **Brundalen** 7 → 3 (819-tegns-blokk ordrett på fem objekter, kopiert **mellom** Frank Robert og Eirik Ardal Øksnes).

3. **De «unike» tekstene er satt sammen fra en felles blokkbank, ikke fritt skrevet.** Av 29 unike Grilstadporten-tekster gjentas **23 setnings-skjeletter i ≥3** tekster; 145 ordrette 45-tegns-fraser deles av ≥3. Banken er **kontorets, ikke personlig**: likhet samme megler 27,1 % vs. ulike meglere 22,9 %. → Grilstadporten har allerede bygget en **manuell versjon av Moat 1**, lagret i verdens dårligste format.

4. **DET EGENTLIGE FUNNET: 114 tekster, ikke én delt mellom to kontor.** Lade og Søndregate selger begge i Solsiden, Midtbyen, Lade, Øvre Nyhavna — deler ikke én setning. Fire kontor, fire private blokkbanker, fire kvalitetsnivåer, null overføring. Kvaliteten varierer per **kontor**, ikke per megler: Lade nevner gangtid i 62 % / 0 % uten tall; Grilstadporten 25 % / **31 % uten ett tall**. **Ny pitch-setning:** *«Dere gjør jobben fire ganger, hver for seg, og ingenting av den overlever boligen»* — et eierskapsproblem, ikke et tekstproblem. Grilstadporten er mest *konsekvent*, Lade mest *konkret* → **ikke si «dere er best» til Frank Robert**.

5. **Dekningsgapet kvantifisert (146 boliger ray-castet mot de 7 polygonene): 37 % innenfor.** Grilstadporten 19 av 35 innenfor → **16 avvist, hvorav 7 er hele Brundalen-klyngen** = ditt sterkeste pitch-eksempel er det strøket Placy nekter å kartlegge. Ranheim-polygonet dekker allerede 15 av deres boliger. **Korrigert kurateringsrekkefølge: Brundalen (7) → Angelltrøa/Granåslia (2) → Væretrøa/Væresstranda (2) → Strindalia/Sverresborg/Bakkaunet/Munkvoll Gård (1 hver).** Det tidligere gjettede forslaget (Strindheim/Vikåsen-Jakobsli/Leangen) traff ingen av kontorets boliger. **Bonus-flate: 0 av 11 nybygg-prosjektannonser har nærområdeinnhold i det hele tatt** (Vangslia Panorama, Strandveiparken, Ladebyhagen) — utbygger-penger, hører til Aleksander-sporet, hold utenfor kontor-piloten.

6. **MEGLER-UTVALG ERSTATTER WORKSHOP SOM MOAT-1-MOTOR (Andreas' modell).** Han avviste både workshop-bistand som salgbar ask *og* byline-modellen. Ny modell: ved **oppsett av megler i Placy** velges hvilke steder som fremheves per kategori; mangler et sted, legges det inn og dukker opp på lik linje. **Placy eier stedet** — sender Frank Robert inn «Chamonix» (uteområde i Overvik, finnes ikke i noe geodatasett), kan en Heimdal-megler bruke det senere. **Ingen navn på punkter, i noe kart.** Begrunnelse: et lag merket med en EM1-meglers navn er **usalgbart til neste kjede** og gir dem en moralsk eiendomsrett ved exit. Visningssiden er allerede bygd (`board-data.ts:315–334`, `highlightPoiIds` vinner over `pickGeneratedHighlights()`); det som mangler er **forfatterskap og innfanging**. Kritisk designvalg: **utvalg per strøk per megler, ikke per bolig** — ellers gjenskapes kopier-lim-problemet i nytt medium. Aggregatet på tvers av meglere blir et **usynlig Placy-signal** (konsensus-prior fra folk som faktisk vet) som kan forbedre nivå-1-defaulten overalt, også der ingen megler har kurert. Fire byggkrav: to-felts «legg til sted» (fem felt = aldri brukt), additivt aldri subtraktivt (megler kurerer markedsføring, ikke fakta), må fungere tomt (Valentinlyst-advarselen), moderasjonskø. Gjennomgangen må **vise stedene på kartet** — tomme områder er synlige, 57 navn i en liste er ikke; det gir holdepunktet som «hva mangler?» ikke gir.

**Begrunnelse:** Pitchen hvilte på en påstand ingen hadde kontrollert. Kontrollen falsifiserte den — og ga samtidig en sterkere og fullt etterprøvbar vinkel (null kunnskapsoverføring mellom kontor) pluss en Moat-1-mekanisme megleren *vil* ha i stedet for en dugnad han må selges. Andreas' avvisning av bylinen beskytter grunnpakke-modellen: samme base må kunne selges til fire kjeder, og et konkurrent-signert lag kan den ikke.

**Detaljer:** `docs/strategy/2026-08-04-em1-grilstadporten-kontor-pilot.md` §2a (fire-kontor-tabellen + metode), §2b (gjenbruk, blokkbank, konkretiseringsgrad), §2c (ny pitch-rekkefølge + trygg variant av Kristian-spørsmålet + tallhygiene i rommet), §3 (dekningstabellen + kurateringsrekkefølgen), §6b (megler-utvalg som Moat-1-motor, komplett). Rådata: `scratchpad/recs4.json` (per annonse: kontor, megler, strøk, status, tegn, sha, tekst).

**Metode-forbehold:** `eiendomsmegler1.no`s robots.txt/vilkår forbyr systematisk innhenting. 150 sider hentet med 3 sek pause, kun profil-lenkede annonser. **Datainnsamlingen skal ikke være en del av historien i møtet** — si «jeg gikk gjennom annonsene til fire av kontorene deres». Ikke tallfest «84 % av Valentinlyst» som om kjeden er revidert; n=25 er ett kontors øyeblikksbilde.

**Status:** Aktiv — validering levert, premiss korrigert, byline forkastet. **Ny blokker på kritisk sti: auth for megler-brukere.** §6b er skriveoperasjoner, og admin er avslått i prod siden 07-07 (`security_admin_prod_disabled`) → uten auth kan mekanismen bare *fortelles*, ikke vises. Rekkefølge: auth → kurér strøkene → oppsett-gjennomgang med kart-holdepunkt → moderasjonskø. To nye åpne beslutninger hos Andreas: (5) er megler-utvalg med i piloten eller fase 2 (anbefaling: fortell mekanismen, kjør 90-min-workshop manuelt, bygg auth i pilotperioden — ellers utsettes møtet); (6) bygges auth før eller etter møtet. De fire opprinnelige beslutningene står fortsatt åpne.

---

## 2026-08-04 — EM1 Grilstadporten: salgsenheten er KONTORET (ikke boligen, ikke kjeden) + dekningsgeofencen stopper demoen

**Beslutning/innsikt:** Sparring om hvordan Andreas går fram mot Kristian Sundland (megler på hans to siste boliger) og Frank Robert Bae, med mål om pilotavtale der nivå 1 embeddes på `eiendomsmegler1.no`s objektsider. Seks funn:

1. **Premiss korrigert: «Christian» i aktor-map = Kristian Sundland, og han er AVDELINGSLEDER på EM1 Grilstadporten** — samme kontor som Frank Robert Bae. Verifisert fra meglerprofilene: Kristian 50 solgt / 3 aktive; Frank Robert 101 solgt / 16 aktive (+ Marius Aune Olsen, volum ukjent) → kontoret realistisk **200+ salg/år, konsentrert i Trondheim Øst**. Den varme kontakten er altså den med budsjettmyndighet.

2. **Salgsenheten er kontoret.** Stigen: megler → **kontor (Kristian)** → EM1 Midt-Norge → kjede/system. Én bolig er for lite (anekdote, ingen data); «kjedeavtale» finnes ikke som ett møte (EM1 = allianse av 12 selvstendige regionale selskap, ingen nasjonal beslutningstaker — 07-09-wedge-doccen). Kontoret er den eneste enheten som er innenfor én persons myndighet OG stor nok til å produsere data. Revenue-stige @ 500–800/listing: kontoret ~200 = **100–160k/år**; EM1 Midt-Norge (~60 % av Trondheim, ~4 500) = **2,25–3,6M/år**. **Moat-2-synergi:** kontorets salg ligger nesten utelukkende i de kuraterte strøkene → 200 boards i 5–6 strøk = 5–6 *validerte* strøk-profiler. Kontor-piloten ER datavaliderings-strategien (06-28 konsentrert-volum).

3. **HARDT FUNN — dekningsgeofencen stopper demoen (verifisert mot prod).** Self-serve-flaten hard-gater på kuraterte strøk-polygoner (`findAreaForPoint`). Bare **7 områder har `boundary`** i `v2.areas` (Ranheim, Charlottenlund, Lade, Eberg, Tyholt, Sentrum, Malvik); de 37 andre strøk-radene er navn uten geometri. **Frank Roberts eksempel-listing (Leistadgrenda 21, geokodet 10.477573/63.41999) faller utenfor samtlige polygoner → `outside_coverage`.** Halve pin-skyen deres treffer veggen hvis megleren taster inn egne adresser i møtet. Fiks: kurér 4–5 strøk (~~Strindheim/Brundalen/Vikåsen-Jakobsli/Leangen~~) med `/curate-area`. Resten brukes som pitch, ikke mangel (`v2.coverage_demand` logger alt de spør om). → **KVANTIFISERT samme dag: 16 av Grilstadportens 35 boliger avvises, 7 av dem er Brundalen. Kurateringsrekkefølgen er korrigert — se entryen over.**

4. **Pitchen er deres egen side:** EM1 kjører nasjonal kampanje på «Vi kjenner ditt nærområde» (logget 06-03) og leverer ett generisk avsnitt i «Nærområdet»-accordionen («Brundalen et populært boligområde…», ~~samme tekst på hver bolig i strøket~~). *Kjeden markedsfører seg på lokalkunnskap og leverer en kopiert paragraf.* → **DELVIS FALSIFISERT samme dag — se entryen «Nærområde-premisset empirisk testet» over. Boilerplate-påstanden holder ikke som generell påstand og må ikke brukes i møtet.** Sekundærverdi mot avdelingsleder: fullmektigene slipper å skrive teksten. Vis IKKE 3D/VO/reels (ankrer i bespoke medieproduksjon → dreper grunnpakke-prisen).

5. **Pilot-struktur anbefalt:** kontoravgift **15–25k for 3 mnd, ALLE boliger inkludert**, datofestet ja/nei. Kritisk prisgrep: **navngi aldri per-bolig-pris under piloten** (bevarer 500–800-ankeret til kjedesamtalen); en-sideren sier «etter pilot: indikativt 500–800 per bolig, eller kontor-/kjedeavtale». Det de gir utenom penger: embed på objektsiden, 90 min per megler til Moat-1-workshop, referanse-rett, og **forpliktet neste steg — Kristian åpner døra til EM1 Midt-Norge ved ja** (verdt mer enn honoraret).

6. **Moat-2-grepet: la dem spesifisere rapporten.** Innsikt er uferdig som konsept → ikke pitch den, legg fram **seks knagger og be dem rangere** («de tre øverste bygger jeg først»): (1) retur-besøk som interesse-temperatur før visning, (2) hva de lurte på rangert, (3) hvor de ville reise fra boligen (⭐⭐, krever synlig commute-UX), (4) spørsmål uten svar via nudge (⭐⭐), (5) delta mot strøk-snittet (krever volum → argumentet for hele kontoret), (6) kanal-effekt `?src=` (allerede bygd). **To kjøpere i samme person:** megleren vil selge objektet (1–4); avdelingslederen vil **vinne oppdraget** → sterkeste linje i møtet: «i verdivurderingsmøtet kan du si: vi vet hva kjøpere i ditt nabolag ser etter, fordi vi måler det på 200 boliger i året.» Si ærlighetsgrensene selv først (anonymt/aggregert, volumterskel, board nr. 1 = anekdote) — EM1 er SpareBank 1-eid, compliance kommer uansett. **Ikke lov effekt på salgspris.**

7. **Moat-1-rettigheter (bekrefter 06-25 §4):** lokalkunnskapen eies av Placy, ikke-eksklusivt — gir du EM1 innholds-eksklusivitet, ødelegger du kjedeavtalen og hver framtidig kunde. Det de kan få i stedet: **tidsavgrenset markedseksklusivitet** (ikke innhold) i Trondheim Øst under pilot + 6–12 mnd, ~~**byline** på strøket de kurerte~~, ~~**megler-eid lag** oppå det delte («Frank Roberts tre favoritter»)~~, og **prioritet** på hvilke strøk som kureres først. Workshop = 90 min per megler foran et kart, Andreas driver skjermen — **ikke lov dem en bidrags-portal** (finnes ikke; admin avslått i prod). → **BYLINE OG MEGLER-EID LAG FORKASTET av Andreas samme dag — erstattet av navnløst megler-utvalg, se entryen over.**

**Begrunnelse:** Loggen har siden 06-25 pekt på «Christian eller Frank Robert» som første betalte pilot uten å se at de sitter på samme kontor og at den ene er avdelingsleder. Det oppløser spørsmålet (svaret er *begge, som kontor*) og gir en pilot-enhet som samtidig er myndighetsriktig, geografisk konsentrert (= Moat-2-validering) og stor nok til ARR-logikk. Den tekniske verifiseringen avdekket at demo-flyten i dag ville feilet på meglerens egne adresser — funnet FØR møtet, ikke i det.

**Detaljer:** `docs/strategy/2026-08-04-em1-grilstadporten-kontor-pilot.md` (full analyse: stige + revenue-tall, pitch-mekanikk, geofence-funnet + 5-punkts pre-møte-byggliste, pilot-struktur, seks statistikk-knagger, rettighets-arkitektur, møte-mekanikk, 5 risikoer). `aktor-map.md` oppdatert: Kristian Sundland-korreksjonen, EM1 Grilstadporten som enhet, Frank Robert-volum oppdatert.

**Status:** Aktiv — analyse + anbefaling levert, **ingen beslutning tatt**. Fire åpne beslutninger hos Andreas: (1) kontoravgift 15–25k/3 mnd/alle boliger vs. per-bolig-pris; (2) kurér 4–5 strøk før møtet vs. kjør på dagens dekning; (3) markedseksklusivitet Trondheim Øst — ja/nei og hvor lenge (semi-irreversibel ved lang varighet); (4) Kristian alene vs. Kristian + Frank Robert. Leveranse-avhengighet: to uflettede brancher (`feat/megler-self-serve` — bærer eneste fiks for Moat-2 event-drop i prod; `feat/mobil-nabolagsflate` — nivå-1-boards har ingen mobil innholdsflate uten den) + `REVALIDATE_SECRET` mangler i Vercel.

---

## 2026-07-09 (forts.) — Distribusjons-wedgen kartlagt: megler-systemet (Vitec Next), ikke portalen — og nærområde-plassen er allerede bundlet av FINN

**Beslutning/innsikt:** Oppfølging av Local Logic-benchmarken (åpent spørsmål #1: hvem er den norske «MoxiWorks/Delta Media» Placy skal ri på?). Tre parallelle web-researchere kartla megler-system-laget. Fem funn som flytter GTM:

1. **Skarpeste distribusjons-wedge = systemleverandøren, ikke kjeden.** Markedet er et **duopol**: **Vitec Next** (størst) + **Broker/Core by Visma** (kjøpte Webmegler 2018 + Meglerfront/Codegarden/Fenistra 2020). Én integrasjon mot **Vitec Next HUB-API** (50+ partnere, åpen OpenAPI, formell onboarding) treffer samtidig DNB Eiendom, Krogsveen, Nordvik, Aktiv, Notar, Rede, Sørmegleren, Heimdal — bekreftet via Vitecs egen kundeliste. = «vinn én kjede» × 8 i én avtale. Nytt strategisk alternativ over 06-27-«vinn én kjede».

2. **Nærområde-plassen er IKKE hvitt lerret — FINN har den allerede, bundlet.** FINN Nabolagsprofil (bygget på Eiendomsprofil AS, Bergen) er inkludert i FINNs «Large»/«Medium»-annonsepakker *og* integrert i begge megler-systemene. Generisk avstand-til-POI, ikke-redaksjonell, ingen lokalkunnskap/3D/Innsikt. → Placy må selge det *dype* laget over en gratis commodity-profil (samme moat-under-scoren-argument som Local Logic). Prisdisiplinen (06-27) forsterkes: ikke pris som «nabolagsprofil» (nå et gratis commodity-ord).

3. **Premiss korrigert: `partners.no` = &Partners / White Label Estate (WLE), IKKE EiendomsMegler 1.** Norkart-Solkart-bundlingen vi observerte ligger i WLE-økosystemet (Bolignytt PARTNERS). Justerer 06-27-notatet + aktor-map.

4. **BD-inngang for forretningsutviklerne (Aleksander/Markus):** ① Vitec Next HUB-partner (bredest — fortrengning/premium-oppsalg mot FINN-profilen, ikke greenfield); ② sentralstyrt kjede direkte, **Nordvik først** (partner-eid, «like mye teknologiselskap», én beslutningstaker → raskest pilot); ③ FINN deprioriteres (enveis annonse-API, ingen tredjeparts-modul-åpning, eier egen roadmap + egen profil). Aleksander→nybygg via Kvass/Boligvelger (bygger alt mot Next HUB); Markus→system-wedgen ER volum-spillet.

5. **Lavthengende frukt nå:** NEFs proptech-kart (svein@nef.no) → synlighet + NEF-konferanser som varm inngang mot Vitec/Visma partner-program (Placepoint-presedens: kart → Visma-partnerskap).

**Begrunnelse:** Local Logics amerikanske suksess hviler på å ri CRM-/system-laget, ikke selge megler-for-megler. Den norske analogen er konkret og navngitt (Vitec Next HUB) — og gir forretningsutviklerne en distribusjons-hypotese som er × mange ganger bredere enn kjede-for-kjede. Samtidig avslører kartleggingen at commodity-laget (Lag A) allerede er tatt av FINN → bekrefter at Placys eneste holdbare posisjon er Lag B (Lokalkunnskap + Innsikt + immersjon), moat-fra-linje-1.

**Detaljer:** `docs/strategy/2026-07-09-megler-system-distribusjons-wedge.md` (full kartlegging: duopol, kjede↔system-tabell, FINN Nabolagsprofil-inkumbent, bransjetall, 3 BD-inngangsveier, åpne hull). `aktor-map.md` oppdatert (nytt distribusjons-lag-avsnitt + partners.no-korreksjon).

**Status:** Aktiv — kartlegging levert, retning anbefalt (Vitec Next HUB som primær distribusjons-hypotese, Nordvik-pilot som proof foran). Åpne hull: (1) Eiendomsprofil AS uavhengig eller FINN-intern? (2) hvilket system bruker EM1? (3) topp-3-kjede-konsentrasjon (Eiendom Norge-rapport, dels betalt); (4) navngitte IT-/produktdirektører per kjede (LinkedIn-jobb).

---

## 2026-07-09 — Local Logic (Realtor.com) = nærmeste levende analog til bolig-sporet: score-primitivet FORKASTET, kommersiell struktur = viktigste læring, commute-input bekreftet

**Beslutning:** Andreas delte Realtor.com-listingens «Neighborhood & schools»-seksjon — **Local Logic** (scores) + **Yelp** (POI-lokasjoner/rating) + **GreatSchools** (skole-rating) + **Precisely** (skolekretser), embedded som **fast inventar på hver listing**. Dette er den nærmeste levende analogien til Placys nærområde-/grunnpakke-spor, allerede i produksjon på portal-skala. Tre avklaringer landet:

1. **Score-primitivet (0–10 per kategori/linse) FORKASTET som produktretning — låst beslutning.** Andreas: subjektiv svada maskert som objektivitet. «Vi har spist på restaurant med 4.5 stjerner og det var helt elendig for våre krav»; «walk-score 9 spørs hvor langt individet er vant til å gå». En score kollapser individuelle preferanser til ett tall og selger det som fakta → null kredibilitet. **Placy skal ALDRI tagge nabolag med scores.** Snus til pitch-argument *mot* Local Logic: «vi gir deg ikke et tall du ikke kan stole på — vi viser hva som faktisk ER der, du bestemmer.» (Aligner med [[feedback_editorial_no_years_history]]-linjen «hva som ER der», og med nivå-modellens minimum-garanti = stedsspesifikk kategoritekst + drill-in, ikke tall.)

2. **Kommersiell struktur = det viktigste vi tar med oss (Andreas' ord).** Deep-dive bestilt (egen datert doc `2026-07-09-locallogic-benchmark-eiendom.md`): hva de tar betalt, hvordan Realtor.com-avtalen er strukturert, hva scoren beregnes av, andre portal-/kjede-deals, GTM-playbook. Grunn: Local Logic er «vinn ÉN portal → fast inventar på hver listing» *utført i praksis* = levende referanse for grunnpakke/kjede-GTM-en (direkte parallell til Norkart/partners.no, jf. 2026-06-27). Bekrefter at distribusjonstesen (fast inventar på portal-skala) fungerer i markedet.

3. **«Legg inn adresse → se reisetid dit» (Local Logics `Add a commute`) bekreftet retning.** Andreas: «det har vi tenkt på tidligere». Dobbel verdi: (a) validert UX-mønster, (b) det er ⭐⭐-signalet i Innsikt-doccen — rute-forespørsler «fra boligen til X» = rikeste enkelt-signal (jobb/skole/treningssenter/mormor). Reisetids-motoren finnes alt i pipelinen. Å gjøre commute-input synlig/fristende = build-imperativet «UX er datainnsamlings-apparatet» (2026-06-28).

**Begrunnelse:** Local Logic validerer distribusjonsmodellen og gir en konkret kommersiell benchmark. Men de har **ingen Moat 2** — det er en *statisk scores-widget solgt til portalen*, uten engasjements-løkke/ARR-mekanisme, og scoren selv er commodity (Lag A: hvem som helst med Yelp-tetthet + transit-data regner den ut). Det skjerper Placys differensiering: **moaten ligger UNDER scoren** — kuratert Lokalkunnskap (punkter Yelp/Google ikke har) + Innsikt-løkka. At Andreas forkaster score-primitivet er derfor både produkt-korrekt og strategisk konsistent (score = «Solkart-aktig widget»-fellen fra 2026-06-27).

**Detaljer:** `docs/strategy/2026-07-09-locallogic-benchmark-eiendom.md` (deep-dive levert — kommersiell struktur, GTM-barbell, score-metodikk + angreps-flate). `aktor-map.md` oppdatert (Local Logic som benchmark/konkurrent ved siden av Norkart + Walk Score).

**Status:** Aktiv. Score-primitiv-forkastelsen er en **låst produktbeslutning** (skal ikke re-surface). Hovedlæring fra deep-dive: (a) volum-wedgen er megler-system-/plattform-laget (norsk analog: Vitec/Webmegler/partners.no), ikke portalen direkte; (b) durabel distribusjon kan kjøpes med *alignment-kapital* (NAR/SCV eier aksjer i Local Logic → Realtor.com-holdbarhet); (c) Europa/Norden ukontestert. Åpent: (1) kartlegg norske megler-system-leverandører som mulig wedge; (2) kan kjede/portal ta strategisk posisjon i Placy à la NAR/SCV (mot Aleksanders eierandel-struktur); (3) prioriter `Add a commute` inn i board-malen (fanger ⭐⭐ Innsikt-signalet).

---

## 2026-07-06 — Sommer-rebuilden LEVERT: cutover fullført, moatene lever i prod, fallback-klausulen pensjonert

**Beslutning/milepæl:** Rebuilden fra 2026-06-27-planen er **ferdig og er nå det eneste som kjører** — gamle demo-plattformen (public-skjemaet + demo-JSON-æraen) er slettet i sin helhet samme dag. Demo-paritet ble godkjent av Andreas (alle tre referanse-boards) og cutoveren gjennomført i 7 etapper på én dag. **Fallback-klausulen («tilbake til gamle demo hvis ikke demo-paritet ~tidlig august») er pensjonert — måneden før fristen.**

**Strategisk betydning (hvorfor dette hører hjemme i business-loggen):**
1. **Begge moatene er nå bygget inn «fra linje 1» — som besluttet 06-27, nå validert i prod.** Moat 1 (Lokalkunnskap): hele POI-poolen (5 386 steder, 2 618 med redaksjonelt innhold) lever som **Placy-eid, strøk-indeksert delt DB** — beslutningen «delt pois-DB, ikke per-prosjekt-JSON» er bokstavelig talt fullbyrdet i dag (per-prosjekt-JSON-ene ble slettet). 0 lokalkunnskap tapt i migreringen (avstemt rad for rad). Moat 2 (Innsikt): én sentral event-strøm med kontekst-konvolutt logger live per board.
2. **Grunnpakke-modellens produksjonsmaskineri eksisterer nå.** Pipeline adresse→ferdig board i én kjøring = marginalkost per listing nær null — den tekniske forutsetningen for 300–800/listing kjede-SaaS-økonomien (06-27-modellen). «Ruller og går» er nå teknisk sant, ikke aspirasjon.
3. **Salgs-konsekvens å være obs på:** de ~52 gamle demo-boardene er mørke — **gamle demo-lenker delt med prospekter er døde**. Live nå: 6 boards (Wesselsløkka, StasjonsKvartalet, Ranheim/byggetrinn-4, 2 KLP, pilot). Nye prospekt-demoer lages on-demand via pipelinen (minutter, ikke dager) — men sjekk hvilke lenker som er i omløp hos Aleksander/Markus/hotell-kontakter.

**Begrunnelse:** Sporvalgene (utbygger-først, grunnpakke/kjede, premium-single) har hele tiden hvilt på en plattform-hypotese: at boards kan produseres autonomt med moat-data innebygd. Den hypotesen er nå validert i produksjon — flaskehalsen er bekreftet å være distribusjon, ikke produkt eller produksjonskost.

**Detaljer:** Teknisk kjøringslogg i `PROJECT-LOG.md` (2026-07-06, 7 etapper) + `docs/rebuild/public-drop-plan.md` §7. Moat-design: `2026-06-27-data-moatene-lokalkunnskap-innsikt.md`.

**Status:** Validert — rebuild-beslutningen (06-27) og moat-build-imperativene er levert. Åpent (uendret): hvilken kjede er første grunnpakke-target; distribusjonspartner-løpene (Aleksander/Markus) er nå demo-klare på forespørsel.

---

## 2026-06-28 — Moat 2 (Innsikt) skjerpet: kontekst-konvolutt, viewport-heat maps, konsentrert-volum-validering, UX-som-instrument

**Beslutning (fortsetter 06-27-moat-tråden):** Fire grep som hever Innsikt fra «tellinger» til forsvarbar, segmentert etterspørsel. (1) **Viewport-heat maps i en privat megler-analyse-visning** (intern, ikke offentlig): kart som samler hvor folk ser/panorerer/zoomer + klikk. Vekt etter intensjon — zoom-inn + dwell > rå panorering; rute-forespørsler høyest; delta-mot-strøk > absolutte klikk. To visninger på samme strøm: per-board-dashboard (klebrighet) vs. aggregert strøk-heat map (sellbar markedsintel). (2) **Kontekst-konvolutt på HVERT event = confounding-fiksen (viktigste grep):** rått klikk lyver (skole langs Ladestien → skole-klikk i naturkontekst = turstien, ikke skolen). Hvert event bærer modus+aktive kategorier, travel_mode, time_budget, viewport, hjem-anker. **Løftet: kontekst gjør engasjement om til segmentering** (klynge kjøpere per strøk → persona-attribuert, forsvarbar anekdote). + negativ-rom og sekvens som signal; **fang maksimalt granulert, rapportér kun over volum-terskel** (aggregér opp, aldri disaggregér ned). (3) **Konsentrert volum validerer raskere enn spredt:** 100 boards i 5 strøk = 5 validerte profiler; spredt = 100 anekdoter. **«Vinn én kjede» + «volum validerer moaten» = samme trekk** (EM1 ~60 % Trondheim → konsentrert samme-strøk-volum). Ranheim-først = datavaliderings-strategi, ikke bare pilot. (4) **UX er datainnsamlings-apparatet:** signal finnes bare hvis UX fremkaller det → travel-mode-toggle må gjøres synlig/fristende; kategori-rekkefølge er både nudge og topp-prioritets-signal (logg alltid *presentert* rekkefølge i konteksten, ellers er åpne-rekkefølge-signalet confounded).

**Begrunnelse:** Granularitet er ikke bare presisjon — det er narrativ spesifisitet som overlever gransking, og det som gjør Innsikt om fra «hva er populært» til «hvem er kjøperne». Confounding (tvetydig signal) er verre enn manglende signal fordi det ser ut som innsikt.

**Detaljer:** `docs/strategy/2026-06-27-data-moatene-lokalkunnskap-innsikt.md` — seksjon «Innsikt-skjerping (2026-06-28)» + utvidet event-skjema (kontekst-konvolutt + viewport-felt).

**Status:** Aktiv — build-input til rebuild (event-skjema m/ kontekst-konvolutt + viewport-events fra board v1; UX-grep for travel-mode + kategori-rekkefølge). Åpent: hvordan adaptiv kategori-rekkefølge konkret styres uten å forurense signalet.

---

## 2026-06-27 (forts. 2) — Data-moatene navngitt + designet: Lokalkunnskap + Innsikt

**Beslutning:** De to data-moatene (identifisert som «tosidig moat» 2026-06-25) navngitt og operasjonalisert: **Moat 1 = Lokalkunnskap** (tilbud — hva som ER der), **Moat 2 = Innsikt** (etterspørsel — hva kjøpere VIL ha). Begge må bygges inn i sommer-rebuilden **fra linje 1**.

**Kjerne-design:** (1) **To lag for begge** — commodity-ingest (Lag A: kommune/Geonorge/OSM — table stakes, ikke moat) er stillas som gjør proprietær kuratering (Lag B: verifisering/innsikt/bilder/aggregert engasjement — moaten) billig. (2) **IP-realitet:** OSM (ODbL) + kommune-data (NLOD) kan ikke gjerdes inn → det ownbare er *kuratering-laget*, ikke rådataen. (3) **Lokalkunnskap:** delt strøk-indeksert `pois`-DB (ikke per-prosjekt-JSON) + kart-admin + megler-UGC-flywheel — **på desktop, ikke mobil** (korreksjon; sluttbruker-board forblir mobil); provenance/confidence/freshness som førsteklasses felt. (4) **Innsikt = mekanismen som gjør grunnpakka klebrig** (engangs → ARR): per-board engasjements-rapport. Tracking-katalog landet; rikeste signaler = **rute-forespørsler** + **«hva leter du etter»-nudge**. Personvern: anonym + aggregert (feature, ikke begrensning). (5) **Per-board analytics = ÉN sentral event-strøm sliced per `board_id`, IKKE siloer** (siloer dreper aggregat-moaten); rå-capture sanntid + batch-rapport hver X timer; strøk/skolekrets = aggregerings-aksen. (6) **Kryss-løkke:** Innsikt prioriterer hvilke Lokalkunnskap-punkter som kurateres; akkumulerings-løkka (rikere strøk → bedre board → flere meglere → mer berikelse) er den egentlige moaten. Fokus ett strøk (Ranheim) først.

**Detaljer:** `docs/strategy/2026-06-27-data-moatene-lokalkunnskap-innsikt.md` — full plan: IP-realitet, kilde-pipeline, OSM, admin, megler-UGC, provenance; Innsikt tracking-katalog (A–F m/ gull-signaler), verdi-stige, per-board-arkitektur, volum-gating, build-imperativer.

**Status:** Aktiv — navn låst, design landet, build-input til rebuild. Åpent: konkrete norske åpne-data-endepunkter (Geonorge/kommune/OSM Overpass-queries) + datamodell/admin-spec ved rebuild-start.

---

## 2026-06-27 (forts.) — Solkart/Norkart-benchmark + grunnpakke-inntektsmodell (nivå 1) + «vinn én kjede»-GTM

**Beslutning:** Samme sesjon utvidet fra premium-single til hele tier-stigen. (1) **Solkartet** på Ranheim-listingen = **Norkarts «3D Solforhold»**, *plattform-bundlet* på partners.no (ikke kjøpt per bolig): forbruker ~100 kr, per listing til megler ~0, kjede-lisens = B2B SaaS. Det er **et andre null-anker** for «interaktivt kart i annonsen» (etter boligfilm ~6–12k) og avslører to forretningsmodeller: *autonomt + plattform-bundlet + ~gratis* (= Placy nivå 1, Norkart er markedsbeviset) vs *bespoke kreativ per-listing* (= premium-single). (2) **Andreas' kjernevisjon ratifisert: Placy som fast inventar i grunnpakka på alle boliger** — volum/plattform-modell, nivå 1, «ruller og går». (3) **Norkart logget som benchmark/konkurrent + mulig plattform-partner.**

**Begrunnelse + tall:** Eiendom Norge: **108 657 bruktboliger solgt 2025** (rekord, +9,4 %, snitt 4,42M) = grunnpakke-poolen. Grunnpakke-pris anker-prises lavt (Solkart-lærdom) → **300–800/listing kjede-SaaS**, ikke 1 500 (da à la carte). Revenue = pris × distribusjon: 1 megler ~100 listings = 50–100k/år (proof); EM1 nasjonalt ~25 000 = 12,5–25M @ 500–1 000; full grunnpakke 108 657 = 54–109M. Bekrefter Markus' 100–200M-tak med hardt tall + viser trappa. **Bindende begrensning = distribusjon, ikke TAM/pris/produkt.**

**Claude-syntese (sparring):** (1) **Vinn ÉN kjede som plattform-standard** (EM1/DNB/Partners), slik Norkart vant partners.no — hele forretningen i ett møte, ikke salg til tusenvis. Wedge: «bli den neste Solkart, for hele nærområdet». Kjeden betaler allerede Norkart for Solkart → budsjettlinje + presedens finnes. (2) **To-lags modell:** nivå 1 grunnpakke (volum/ARR, ruller) + premium-single (margin, à la carte) sameksisterer. Tyngdepunkt mot Markus' volum/kjede-tese. (3) **Advarsel:** oppfattes Placy som Solkart-aktig widget → pris kollapser mot ~0; premium-single MÅ posisjoneres som bespoke redaksjonelt. (4) **De to data-moatene** (Markus 2026-06-25) må bygges inn i sommer-rebuilden **fra linje 1**: (a) lokalkunnskap som Placy-eid IP = førsteklasses delt strøk-DB (ikke per-prosjekt-JSON), (b) engasjements-instrumentering fra dag 1 (data du ikke logget finnes ikke). Commodity-geodata = widget-skjebne (Norkart); moatene = ueksproprierbar. Kobling til `[[project_summer_rebuild]]`.

**Detaljer:** `docs/strategy/2026-06-27-premium-single-bruktmarked-spor.md` seksjon 7–9 (Solkart/Norkart, grunnpakke-inntektsmodell m/ full distribusjons-trapp-tabell, to-lags syntese + GTM + de to moatene). `aktor-map.md` oppdatert med Norkart.

**Status:** Aktiv — grunnpakke/nivå-1 = volum-modellens kjerne, GTM = vinn én kjede; premium-single = margin-laget oppå. Distribusjon er flaskehalsen → forsterker verdien av kommersiell partner m/ kjede-tilgang (Aleksander/Markus) eller plattform-integrasjon. Åpent: hvilken kjede er første target for grunnpakke-avtalen.

---

## 2026-06-27 — Premium-single på bruktmarkedet = tredje rung (pris hänger på posisjonering, ikke film-anker)

**Beslutning:** Tier→segment-modellen avklart til en **3-rungs stige**: volum-megler (~1–2k) / **premium-single (topp-eiendom brukt, kuratert nærområde-board)** / utbygger (250k). Andreas reiste tesen ut fra en premium-listing (Ranheimslivegen 31 B, Ranheim, 14,99M, med dronevideo + boligfilm + megler på kamera med VO): rom for et **nivå-2 Placy for topp-eiendommer i bruktmarkedet** som gjenbruker eksisterende film + megler-VO. Fyller den orphaned cella mellom nivå 1 og utbygger, og matcher Aleksanders «25k single premium (Collins vei)»-anker. **Pris: list/anker ~19–25k (posisjonert som nærområde-intelligens), forvent validert transaksjon 12–18k.**

**Begrunnelse + viktig korreksjon (samme sesjon):** Andreas delte den faktiske videografen (Huy Rebel Production, huyrebel.com): dronefilm/dronefoto **fra 5 000,– ink. mva**, boligfilm «ta kontakt», «kombiner og få rabatt» → hele medieproduksjonen kostet realistisk **~6–12k, ikke 15–40k**. Det **falsifiserer** den første «25k ligger midt i kino-film-båndet 15–40k»-begrunnelsen, og dommen «10–15k = underprising». Korrigert bilde: to ankre drar i hver sin retning — *prod.kost-pol* (megler ser «enda et medie-tillegg» à ~5–10k/linje → tak ~10–15k) vs *verdi-pol* (200–300k totalspend, provisjon 150–225k → 15–25k mulig). Den bindende begrensningen nær sikt er **meglerens mentale anker, ikke eiendommens verdi** (Markus: megler behandler medie-tillegg som billige linjer). Å flytte megleren til kategori-anker = posisjonerings-jobb. Megler tar uansett *ingen* separat «talent-post» for video → kloning av megler-stemme har null talent-kost (friksjon = samtykke/jus).

**Claude-syntese (sparring):** (1) Premium-single = Markus' lavfrikssjons-megler-kanal × Aleksanders premium-prising. (2) **Krever ingen ny bygging** — gjenbruker eksisterende kuratert board → trekker ikke tid fra engasjement-/stats-modul + lokalkunnskap-DB. Marginen er enorm uansett (marginalkost ~null); lav input-kost presser pris*taket* via anker, ikke marginen. (3) **Gjenbruks-regel:** eksisterende video + ekte megler-VO inn direkte; kloning kun for *ny* nærområde-narrasjon. (4) **Ranheim-listing = ideelt pilot-eksemplar.** (5) **Videograf (Huy Rebel) som kanal/footage-kilde** — sitter allerede i rommet med megler/selger; kan gjenbruke film direkte eller upselge board oppå. (6) **Risikoer:** tynt segment (margin/proof), leverings-readiness (norsk-TTS, establishing-shot parkert), 3 prispunkter forsterker channel-konflikt. (7) **Disiplin:** ikke et nytt spor — samme megler, samme motor, tredje pris; SKU å validere i august.

**Detaljer:** `docs/strategy/2026-06-27-premium-single-bruktmarked-spor.md` — korrigert kostnadsstack (Huy Rebel-priser), to-pol-pris-analyse, Ranheim-pilot, videograf-kanal, risikoer, 5 neste steg, kilder. `aktor-map.md` oppdatert med premium-single-rung + Ranheimslivegen-listing + Huy Rebel.

**Status:** Aktiv — tredje rung ratifisert, pris-tallet åpent (anker 19–25k, forvent 12–18k), avgjøres av august-pilot. Komplementær til 2026-06-25 + 2026-06-23. Åpent: hvilken megler/listing blir første betalte premium-single, og det skarpe «hvorfor 25k her vs 1k der»-channel-svaret.

---

## 2026-06-25 — Markus: bruktmegler-først som motvekt til utbygger-først + mulig partner nr. 2 (Bergen)

**Beslutning:** Markus (forretningsutvikler, Bergen-basert, brainstormet Placy Reels 2026-05-24) så samme demo som Aleksander og leverte **motsatt segment-anbefaling**: led med *vanlige bruktmeglere* (annenhåndsmarkedet), ikke utbyggere. Begrunnelse: utbygger = engangskunde + org-salg + seigt; megler har full myndighet (lavthengende frukt), 85–90 % av volumet er bruktbolig (motsyklisk), og megleren har et *større, mer konkret* behov (konkurrerer mot 50 annonser/uke, må spille på nærområdet). Prismekanisme: per boenhet (~790–1 500/2 000). Ingen beslutning hard-ratifisert — treffer den åpne segment-underbeslutningen fra 2026-06-23.

**Begrunnelse:** Dette er nettopp motforestillingen Claude flagget mot Aleksander (utbygger-først er konjunkturavhengig; bør være sekvens, ikke enten/eller) — nå fra en uavhengig kilde. To-av-to forretningsutviklere lener seg inn i Placy. Markus åpnet døra mykt for samarbeid med Bergen som naturlig by nr. 2 (han bor der, siterte samme bruktbolig-tall som Trondheim).

**Claude-syntese (sparring):** (1) **Tier → segment:** nivå 1 (autonomt) → bruktmegler; nivå 2 (kuratert, 50t) → utbygger. Begge rådgivere sa nivåene server to behov og kan sameksistere — uenigheten er om *rekkefølgen*. (2) **Anbefalt: led med megler (Markus), kjør utbygger parallelt (Aleksander, august)** — treffer den bindende usikkerheten (kald → første validerte betaling), bruker en varm kontakt (Christian), og megler-data *mater* utbygger-pitchen. (3) **Ny moat-akse: lokalkunnskap som Placy-eid IP** (volleyballbane/taxi-holdeplass «ikke på Google») → tosidig moat sammen med engasjements-data; må eies av Placy, ikke megleren (term sheet-sak). (4) **Engasjements-/innsikts-modul nå trippel-bekreftet** (Markus + Claude + Andreas selv) = eneste build på kritisk sti. (5) **To-av-to validerer tesen, ikke betalingsviljen** — grunn til å kjøre testen, ikke bevis på å bestå. (6) **Channel-konflikt uløst:** per-enhet vs per-prosjekt på overlappende meglerteam. (7) **To partnere hever kravet til struktur** (pris/framing-eierskap, cap table, revenue-def).

**Detaljer:** `docs/strategy/2026-06-25-markus-bruktmegler-vs-utbygger.md` — full segment-sammenligning (Markus vs Aleksander), moat, data-USP, Bergen-aksen, tier→segment-syntese, prising, UX-funn, konsekvens for Aleksander-term sheet, 5 neste steg + 3 åpne spørsmål. `aktor-map.md` oppdatert med Markus + Christian (EM1 secondhand) / Frank Robert som pilot-targets.

**Status:** Aktiv — segment-rekkefølge anbefalt (megler først), ikke hard-ratifisert (venter til august). Komplementær til, ikke supersedering av, 2026-06-23. Åpne spørsmål: (a) inviteres Markus inn som partner nr. 2 (Bergen) eller holdes som rådgiver? (b) første betalte pilot-megler — Christian eller Frank Robert? (c) skal Claude skrive 1-siders nivå-1-megler-spec til august?

---

## 2026-06-23 — Aleksander tilbyr kommersialiseringspartnerskap + utbygger som spydspiss (eiendomssporet)

**Beslutning:** Aleksander (forretningsutvikler, jobbet med Andreas i mange år) tilbød å gjøre kommersialiseringsjobben på eiendomssporet — kjøre utbygger-møter sammen med Andreas, strukturert som **no cure, no pay → opsjon til å kjøpe eierandel ved en revenue-milestone (foreslått ~500k)**. Andreas positiv. Innen eiendom anbefalte Aleksander **utbyggere som spydspiss** (høy margin, korte beslutningsveier, «bevisst behovet», prosjektet bærer seg raskt) fremfor megler-/per-genererings-massen (lav margin, salgsintensivt, høy kommersiell tilretteleggingskost). Andreas heller mot denne retningen.

**Begrunnelse:** Andreas har eksplisitt behov for en spisset, resultatsulten kommersiell medspiller (Kona/Claude dekker ikke det). Utbygger-først skjerper kjede-først-retningen og tvinger fokus mot Andreas' egen navngitte risiko («jeg jager hele tiden uten å treffe ett område 100%»). Priser nevnt (25k single premium, 250k/24 mnd utbygger + 50t klargjøring) bekrefter prisgrunnlaget fra 2026-02-01.

**Claude-innspill (sparring):** (1) Partnerskaps-strukturen er det eneste semi-irreversible — få andel %, kjøps-pris/verdsettelse og «revenue»-definisjon ned som term sheet før møtene. (2) Utbygger-først bør være en *sekvens*, ikke enten/eller — nybygg er konjunkturavhengig (Aleksander sa selv «nybygg sliter»), masse/bruktbolig er motsyklisk → utbygger for margin/proof, kjede/masse for volum senere. (3) Dropp «beskjedent supplement»-språket i salgsrommet (prisanker-dreper + forsterker underprising) — bruk Champions League / kontekstlag-vs-Marketer-posisjonering. (4) Pris av verdi/alternativkost, ikke av egen ~null marginalkost (margin-historie ≠ pris-historie). (5) Dra aggregert engasjements-statistikk per prosjekt FREM som differensiator (moat + løser engangssalg-vs-ARR). Turisme-aksen holdes parkert (hotell-først står, jf. 2026-05-06).

**Detaljer:** `docs/strategy/2026-06-23-aleksander-kommersialisering-utbygger-spor.md` — full segmentering (partner, segment, posisjonering, pris, GTM, data-USP, turisme, tech, founder-kontekst), 5 neste steg, 2 åpne spørsmål. `aktor-map.md` oppdatert med Aleksander + utbygger-prospekter (Koteng, Brøseth/Trym, Sunnland) og EM1-/Megler1-kontakter.

**Tillegg (samme sesjon — verifisert mot diarisert transkript `~/Desktop/placy-synk-aleks-ny.json`):** (1) **Alt er kaldt** — Andreas: «bare prat, ingen validering fra kunder enda» → bindende usikkerhet = betalingsvilje, ikke segment/pris/tilbud/tilgang. (2) **Ekspert- ≠ markedsvalidering:** hele den kommersielle ryggraden (segment, begge prisene, ARR-taket, posisjonering, partnerskapsstruktur) kom fra Aleks uoppfordret etter én demo → de-risker *tesen*, ikke *etterspørselen*; ikke coast på hans konviksjon. (3) **Realisme 2026 (Claude-judgment):** fullt 250k-salg signert ~25–35 %, to salg ~10–15 %, første betalte «ja» (uansett størrelse) ~60–70 % → reframet 2026-mål = *fra kald til første validerte betaling* + pipeline, ikke 250k-close; de-risk via betalt pilot m/ forhåndsavtalt opptrapping (anker høyt, forplikt smått); 2×250k = 500k = Aleks' opsjons-trigger. (4) **Partnerskap = kommersiell hjerne, ikke selger** → opsjonen kjøper GTM-IP + key-person-risiko + Andreas må eie tesen selv; primærverdi = fokus, ikke nettverk. (5) **Pris-frame per person:** «supplement» (Andreas) vs «Champions League/stå i prisen» (Aleks) → avtal at Aleks eier pris/framing i rommet. (6) **Diagnose: 500 t produkt / ~0 t kommersialisering** → atferdsrisiko = retrett til produktbygging; eneste build på kritisk sti = stats-/engasjementsmodul.

**Status:** Aktiv — intensjon om partnerskap landet, struktur ikke konkretisert. Åpne underbeslutninger: (1) partnerskaps-term sheet (andel/pris/revenue-def), (2) første utbygger-target (Koteng / Brøseth-Trym / Sunnland), (3) utbygger-spec («hva får du for 250k»). Hard-ratifisering av utbygger-først venter på disse. Tilbud fra Claude (ikke startet): håndtrykk-notat (samarbeids-ramme) + discovery/pilot-tilbud-skisse.

---

## 2026-06-03 — Innsikt: «nærområde» er bransjens vinnerterm for lokasjon (copy/posisjonering)

**Innsikt:** EiendomsMegler 1 (landets største meglerkjede) bruker «nærområde» som sentralt begrep i sin nasjonale selger-kampanje: *«Selge bolig? Vi kjenner ditt nærområde, vår erfaring er din fordel.»* Av synonymene **beliggenhet / nabolag / nærområde / område** ser **«nærområde»** ut til å treffe best i bransje-copy — det signaliserer lokalkunnskap og nærhet uten å være så klinisk som «beliggenhet» eller så avgrenset som «nabolag».

**Konsekvens for Placy:** Report er nettopp et nærområde-produkt (kontekstlaget rundt boligen — det Marketer/HomeKey er tynne på, jf. entry 2026-06-02). Vi bør lene oss på **«nærområde»** i copy/pitch mot meglere og i selve rapport-boardet (overskrifter, splash-tekst, seksjons-labels) fremfor «beliggenhet»/«nabolag». Aligner Placys språk med det markedslederen allerede har normalisert hos kjøper/selger.

**Detaljer:** Observert i EiendomsMegler 1-display-annonse (selger-funnel). Ingen egen sesjons-doc — copy-signal, ikke beslutning. Relatert: konkurranse-/kontekstlag-posisjoneringen i 2026-06-02 Marketer/HomeKey-entry.

**Status:** Innsikt — informerer copy/posisjonering på eiendomssporet. Ikke validert i egen test.

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
