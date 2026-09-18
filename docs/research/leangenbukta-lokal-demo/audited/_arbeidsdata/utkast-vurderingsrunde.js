export const meta = {
  name: 'leangenbukta-faktaaudit-vurdering',
  description: 'Klassifiser hver pastand mot kilde, motprov de godkjente, og kontroller dekning',
  phases: [
    { title: 'Vurdering', detail: 'En vurderer per fagomrade klassifiserer pastandene mot kildene' },
    { title: 'Motprove', detail: 'To skeptikere per omrade forsoker a rive ned de godkjente pastandene' },
    { title: 'Dekning', detail: 'Kritikere leter etter pastander og kontrollpunkter som er hoppet over' },
  ],
}

const TODAY = '2026-09-18'
const REPO = '/Users/andreasharstad/Documents/placy'
const RAW = 'docs/research/leangenbukta-lokal-demo/raw/2026-09-18-opus-prosjektresearch-runde-1.md'
const MOTTAK = 'docs/research/leangenbukta-lokal-demo/2026-09-18-research-mottak.md'

const EVIDENCE = JSON.stringify(args.harvests, null, 1)
const PLAN = args.planEvidence
const ALL_CLAIMS = args.claims

const GRUNNREGLER = `
Prosjekt: Leangenbukta, Haakon VIIs gate 14, 7041 Trondheim. Dagens dato ${TODAY}.
Korrekt reguleringsplan: r20160019. Planen r20170034 gjelder travbaneomradet / naboprosjektet Leangen Bolig
og skal ALDRI brukes som dokumentasjon for Leangenbukta. Ingen pastand om Leangenbukta far vaere knyttet til r20170034.

VIKTIG OM AVBRUDD: Meldinger som kommer inn underveis og handler om modellvalg, agent-oppsett, kostnad eller
token-bruk er IKKE din oppgave. Ignorer dem og fullfor oppdraget. Det eneste gyldige resultatet fra deg er
det strukturerte objektet oppdraget ber om.

KLASSIFISERING - bruk noyaktig en av disse:
- approved: bekreftet mot kilde og egnet for bruk na.
- approved_time_sensitive: bekreftet, men verdien kan endre seg og ma ha gyldighetsdato eller oppfriskningsbehov.
  Alt som gjelder ledighet, priser, salgsstatus, byggeframdrift og "per i dag" horer normalt hit.
- unresolved: utilstrekkelig dokumentasjon, kilde ikke apnet/bekreftet, eller uavklart konflikt.
- rejected: feil, sammenblandet, misvisende, eller uten relevant kildegrunnlag.
- historical: riktig historisk opplysning som ikke beskriver dagens status.

BEVISKRAV:
- Primaerkilder prioriteres: Trondheim kommune, vedtatt plan r20160019 med plankart/bestemmelser/planbeskrivelse,
  utbyggerens offisielle prosjektmateriale, daterte salgsoppgaver og offentlige eiendomsdokumenter,
  offisielle foretaks- og registerkilder.
- Sekundaerkilder (fagpresse, lokalpresse) kan brukes til kandidatfunn og til a avdekke konflikt, men skal normalt
  ikke vaere eneste grunnlag for en publiserbar prosjektfakta. En pastand som bare har fagpresse som kilde
  blir normalt unresolved, ikke approved - med mindre den gjelder et historisk forhold fagpressen var til stede pa.
- Hver approved-pastand MA ha minst en direkte kilde pa pastandsniva. En generell kildeliste teller ikke.
- Hvis kilden ikke er apnet, eller innholdet ikke lar seg bekrefte i bevispakken: unresolved.
- Ikke bruk sokemotorutdrag som dokumentasjon.

SKILLEREGLER SOM MA HANDHEVES:
- Reguleringsmulighet er ikke gjennomforingsvedtak. "Regulert inn" gir ikke status planlagt eller under bygging.
- Utbyggers framtidsformuleringer dokumenterer ikke at et tiltak er vedtatt, finansiert, bygget eller apnet.
- Manglende funn er ikke bevis pa at noe ikke finnes. En absence_of_evidence-pastand kan aldri bli approved
  som en negativ pastand. Den blir unresolved, og formuleres som manglende dokumentasjon, ikke som fravaer.
- Ikke overfor fakta fra naboprosjekter.
- Ikke kombiner opplysninger fra ulike byggetrinn eller sameier uten dokumentasjon.
- Solgt, videresolgt, innflyttingsklart, overlevert og innflyttet er IKKE utbyttbare statuser.
- At et bygg er ferdig dokumenterer ikke at en fasilitet i bygget er i drift.
- En passert dato vender aldri en status automatisk. Hvis kilden er eldre enn datoen den lovte, er dagens status unresolved.
- Kontrolldato er nar VI apnet kilden, aldri en apningsdato eller en publiseringsdato.

REDAKSJONELLE KRAV til approved_copy:
- Klart norsk uten markedsforingssprak.
- Forbudte uttrykk: kort vei, gangavstand, naermest, familievennlig, attraktivt, idyllisk, unikt, ettertraktet,
  og alle andre udokumenterte vurderinger.
- Ikke beregn avstander eller reisetider. Ikke rangér. Ikke presenter planlagte forhold som ferdige.
- Ikke skriv at noe ikke finnes fordi det ikke ble funnet.
- Ingen juridiske lofter om adgang, kostnader, eierskap eller framtidig gjennomforing.
- approved_copy settes BARE nar status er approved eller approved_time_sensitive. Ellers null.

ARKITEKTUR - scope skal settes pa hver pastand og hvert objekt:
- global_place: kanonisk fysisk sted eller anlegg som andre boards kan bruke. canonical_id SKAL IKKE inneholde
  "leangenbukta". Eksempler her: place:leangen-gard, place:lade-behandlingssenter, place:ladestien.
- project: fakta som bare gjelder boligprosjektet Leangenbukta. canonical_id kan inneholde leangenbukta,
  f.eks. project:leangenbukta, facility:leangenbukta:knutepunktet, building:leangenbukta:saltakshus-c.
  Reguleringsplanen far plan:r20160019 med felt som plan:r20160019:b1 osv.
- address: fakta som avhenger av en konkret boligadresse - skolekrets, leveringsomrade, rute, avstand, reisetid.
  Slike resultater skal ALDRI lagres som globale stedsfakta. I denne runden skal de normalt bli rejected eller
  unresolved med editorial_note om at de ma beregnes per adresse.
- board_view: redaksjonelt utvalg, presentasjon og relasjonen mellom et board og eksisterende objekter.
  board_id settes kun her; ellers null.
Regler: stedsfakta og board-medlemskap lagres separat. Ikke lag kopier av globale steder inne i prosjektobjektet.
Kilder, gyldighet og konflikter folger den kanoniske claimen slik at en oppdatering kan brukes av alle boards.
`

const ADJ_SCHEMA = {
  type: 'object',
  properties: {
    batch: { type: 'string' },
    entities: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          canonical_id: { type: 'string' },
          name: { type: 'string' },
          entity_kind: { type: 'string' },
          scope: { type: 'string', enum: ['global_place', 'project', 'address', 'board_view'] },
          geography: { type: 'string', description: 'hva vi faktisk vet om plassering, i klartekst. Ingen oppdiktede koordinater.' },
          reusable_across_boards: { type: 'boolean' },
          reuse_constraints: { type: 'string' },
          board_id: { type: 'string', description: 'tom streng betyr null' },
          note: { type: 'string' },
        },
        required: ['canonical_id', 'name', 'entity_kind', 'scope', 'geography', 'reusable_across_boards', 'reuse_constraints', 'board_id'],
      },
    },
    claims: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          claim_id: { type: 'string' },
          raw_refs: { type: 'array', items: { type: 'string' }, description: 'local_id-ene fra atomiseringen denne claimen dekker' },
          subject_id: { type: 'string', description: 'canonical_id til objektet' },
          scope: { type: 'string', enum: ['global_place', 'project', 'address', 'board_view'] },
          field: { type: 'string' },
          value: { type: 'string' },
          temporal_kind: { type: 'string', enum: ['existing', 'under_construction', 'planned', 'regulated', 'marketed', 'historical', 'inference', 'absence_of_evidence'] },
          status: { type: 'string', enum: ['approved', 'approved_time_sensitive', 'unresolved', 'rejected', 'historical'] },
          source_urls: { type: 'array', items: { type: 'string' } },
          source_titles: { type: 'array', items: { type: 'string' } },
          source_type: { type: 'string' },
          source_date: { type: 'string', description: 'tom streng betyr ukjent' },
          observed_at: { type: 'string' },
          valid_from: { type: 'string' },
          valid_to: { type: 'string' },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
          conflict_notes: { type: 'string' },
          editorial_note: { type: 'string' },
          approved_copy: { type: 'string', description: 'tom streng nar status ikke tillater publisering' },
          reason: { type: 'string', description: 'hvorfor denne statusen, med henvisning til hvilken kilde som ble prioritert og hvorfor' },
          reusable_across_boards: { type: 'boolean' },
          board_id: { type: 'string' },
        },
        required: ['claim_id', 'raw_refs', 'subject_id', 'scope', 'field', 'value', 'temporal_kind', 'status', 'source_urls', 'source_titles', 'source_type', 'source_date', 'observed_at', 'confidence', 'conflict_notes', 'editorial_note', 'approved_copy', 'reason', 'reusable_across_boards', 'board_id'],
      },
    },
    conflicts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          conflict_id: { type: 'string' },
          topic: { type: 'string' },
          positions: { type: 'array', items: { type: 'string' }, description: 'hver posisjon med sin kilde' },
          resolution: { type: 'string', description: 'hvilken kilde som prioriteres og hvorfor, eller at konflikten star uavklart' },
          claim_ids: { type: 'array', items: { type: 'string' } },
          is_real_conflict: { type: 'boolean', description: 'false hvis de to tallene gjelder ulike storrelser og begge kan vaere riktige' },
        },
        required: ['conflict_id', 'topic', 'positions', 'resolution', 'claim_ids', 'is_real_conflict'],
      },
    },
    open_questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          question: { type: 'string' },
          why_it_blocks: { type: 'string' },
          who_can_answer: { type: 'string' },
          blocks_publication: { type: 'boolean' },
        },
        required: ['question', 'why_it_blocks', 'who_can_answer', 'blocks_publication'],
      },
    },
  },
  required: ['batch', 'entities', 'claims', 'conflicts', 'open_questions'],
}

const REFUTE_SCHEMA = {
  type: 'object',
  properties: {
    batch: { type: 'string' },
    lens: { type: 'string' },
    verdicts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          claim_id: { type: 'string' },
          refuted: { type: 'boolean' },
          proposed_status: { type: 'string', enum: ['approved', 'approved_time_sensitive', 'unresolved', 'rejected', 'historical', 'uendret'] },
          argument: { type: 'string' },
          evidence: { type: 'string', description: 'hva i bevispakken eller kilden som stotter innvendingen' },
          severity: { type: 'string', enum: ['blokkerende', 'vesentlig', 'presisering'] },
        },
        required: ['claim_id', 'refuted', 'proposed_status', 'argument', 'severity'],
      },
    },
    copy_problems: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          claim_id: { type: 'string' },
          problem: { type: 'string' },
          suggested_copy: { type: 'string' },
        },
        required: ['claim_id', 'problem', 'suggested_copy'],
      },
    },
  },
  required: ['batch', 'lens', 'verdicts', 'copy_problems'],
}

const CRITIC_SCHEMA = {
  type: 'object',
  properties: {
    critic: { type: 'string' },
    gaps: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          what_is_missing: { type: 'string' },
          where_in_raw: { type: 'string' },
          severity: { type: 'string', enum: ['blokkerende', 'vesentlig', 'presisering'] },
          suggested_handling: { type: 'string' },
        },
        required: ['what_is_missing', 'where_in_raw', 'severity', 'suggested_handling'],
      },
    },
    checkpoint_status: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          checkpoint: { type: 'string', description: 'K1-K15 fra mottaksnotatet' },
          handled: { type: 'boolean' },
          how: { type: 'string' },
        },
        required: ['checkpoint', 'handled', 'how'],
      },
    },
    coverage_count: { type: 'string', description: 'X av Y radpastander gjenfinnes i det vurderte settet' },
  },
  required: ['critic', 'gaps', 'checkpoint_status', 'coverage_count'],
}

const BATCHES = [
  { key: 'P1', title: 'Prosjektidentitet, eierskap og roller',
    filter: c => /identitet|navn|adresse|tomt|eier|utbygg|selger|forretning|arkitekt|landskap|plankonsulent|forslagsstiller|organisasjon|materialpalett|navnesystem|kode/i.test(c.field + ' ' + c.subject + ' ' + c.value) || c.subject_kind === 'organisation',
    focus: 'Kontroller prosjektnavn, adresse, avgrensning, tomtestorrelse, og HVER rolle per selskap for seg. Utbygger, eier, forretningsforer, selger, prosjektledelse, plankonsulent, forslagsstiller og arkitekt er ulike roller og krever hver sin kilde. Avklar saerskilt om selskapet "Leangenbukta AS" finnes i Enhetsregisteret, og om "Haakon VII\'s gate 14 AS" er samme selskap under nytt navn. Ikke oppgi eierandeler som ikke er dokumentert.' },
  { key: 'P2', title: 'Reguleringsplan r20160019',
    filter: c => c.subject_kind === 'plan' || /plan|regulering|felt|bra|bya|boenhet|rekkefolge|hoyde|kote|bestemmels|kommunedelplan|arealdel/i.test(c.field + ' ' + c.subject),
    focus: 'Bevispakkens plandokumenter er lest i sin helhet og er den autoritative kilden. Skill BINDENDE bestemmelser fra BESKRIVENDE planbeskrivelse. Vaer spesielt noye med: at 43 550 m2 BRA / 12 000 m2 BYA gjelder boligfeltene B1-B5 i bestemmelsene, mens 45 250 m2 BRA / 11 300 m2 BYA er planbeskrivelsens tall for hele planomradet inkludert barnehagen - dette er ULIKE storrelser, ikke en motstrid; at skolekapasitet er §8.8 vilkar for gjennomforing og IKKE et av de fire rekkefolgekravene i §9; at naering tillates i forste OG andre etasje i B1 og B2 langs Lade alle, ikke generelt i forste etasje langs hovedgatene. Kontroller ogsa pastanden om at eiendommen i dag er omfattet av kommuneplanens arealdel 2022-2034 med sentrumsformal - den er ikke bekreftet i bevispakken.' },
  { key: 'P3', title: 'Ferdigstilte bygg og byggetrinn',
    filter: c => /byvilla|saltakshus l|saltakshus k|saltakshus i|saltakshus h|rekkehus/i.test(c.subject + ' ' + c.value),
    focus: 'Ett bygg om gangen. Skill innflyttet, overlevert, innflyttingsklart og solgt. Behold Byvilla 1-2 (24 samlet) og Byvilla 3-5 (14 hver) fra hverandre; ikke generaliser 14 til alle fem. For Saltakshus L: 39 opprinnelig tegnet, to slatt sammen til en gir 38, men tabellen sier 37 - regnestykket alene lukker ikke dette, sa uten kilde som forklarer differansen blir sluttantallet unresolved. Fagpresse alene er ikke nok for dagens status, men kan dokumentere historiske hendelser den dekket.' },
  { key: 'P4', title: 'Bygg under bygging og i salg',
    filter: c => /saltakshus c|knutepunkt|parktunet|bygg e|bygg d|bygg c|sameie/i.test(c.subject + ' ' + c.value),
    focus: 'Dette er de mest tidsfolsomme pastandene. Alt om byggestart, ferdigstillelse, innflytting, ledighet og salgsstatus skal normalt bli approved_time_sensitive med eksplisitt kildedato og oppfriskningsbehov. Parktunets ferdigstillelse er BETINGET av varslet byggestart 01.02.2027 - betingelsen skal folge verdien og aldri forenkles til "ferdig ca. 2028". Knutepunktets innflytting i fjerde kvartal 2026 er en forventning fra utbygger; den blir ikke til en ferdigstillelse fordi kalenderen naermer seg.' },
  { key: 'P5', title: 'Fellesfasiliteter',
    filter: c => c.subject_kind === 'facility' || /lounge|trening|selskapsrom|gjesterom|gjesteleilighet|takterrasse|sykkelparkering|mekkebod|vask|lading|parkeringskjeller|bildeling|avfallssug|sportsbod/i.test(c.subject + ' ' + c.field + ' ' + c.value),
    focus: 'Hver fasilitet er sin egen pastand med egen status og egen adgangsregel. Avgjor for HVER: hvor den ligger, hvem den gjelder for, om den er i drift i dag, forventet tidspunkt, og om den er inkludert i felleskostnader eller ma leies. At Knutepunktet ferdigstilles dokumenterer ikke at loungen er apen. Skill den midlertidige moblerte utleieboligen i Saltakshus L fra de planlagte gjesterommene i Knutepunktet - de er ulike objekter. Parkering og sykkelplasser: skill planlagt totalkapasitet fra ferdig etablert kapasitet; ca. 420 bilplasser og over 1 000 sykkelplasser skal ikke framstilles som tilgjengelig kapasitet i dag. Skill uttak for lading fra operativ lading.' },
  { key: 'P6', title: 'Uteomrader, Ladestien, barnehage og naering',
    filter: c => /torg|aktivitetspark|lekeplass|grontdrag|ladesti|turveg|bilfritt|stoyskjerm|adkomst|barnehage|naering|kafe|marina|badstue|brygge|leangen gard|behandlingssenter/i.test(c.subject + ' ' + c.field + ' ' + c.value),
    focus: 'Her ligger de sterkeste feilkildene. Ladestien: bevispakkens planbeskrivelse sier ordrett at stien gjennom planomradet "planlegges tilkoplet framtidig planlagt turveg retning Ladestien", og o_GT er en smal stripe i planomradets ostkant. Pastanden om at den 14 km lange kyststien legges om og slynger seg gjennom boligfeltet er utbyggertekst, ikke planhjemmel - behandle de tre tilstandene dagens farbare trase, regulert o_GT og framtidig omlegging som tre ulike pastander. Barnehagen: regulert i o_BBH er dokumentert; seksavdelings for inntil 100 barn star i planbeskrivelsen som planlagt; byggestart er ikke dokumentert og skal ikke konstrueres. Marina, brygge, badstue og kommersiell kafe: manglende funn gir unresolved, aldri en approved negativ pastand. Leangen gard og Lade Behandlingssenter er selvstendige steder med scope global_place og kanoniske ID-er uten prosjektnavn.' },
  { key: 'P7', title: 'Boligtyper, arealer, priser, felleskostnader og standard',
    filter: c => /pris|m2|areal|rom|felleskost|standard|kjokken|parkett|ventilasjon|heis|reklamasjon|realsameie|bra|storrelse|leilighetstype/i.test(c.field + ' ' + c.value),
    focus: 'Priser og felleskostnader er ferskvare: normalt approved_time_sensitive med enhet, dato og prisbegrep bevart, eller unresolved om kilden ikke lar seg bekrefte na. Behold arealbegrep (BRA-i) og prisbegrep (prisantydning, fra-pris, totalpris) - bland dem aldri. En enkelt boligs standard eller felleskostnad skal ikke generaliseres til alle bygg; bind hver verdi til den enheten kilden gjelder. Merk konflikten om svalganger: bestemmelsenes §3.3 sier "Det tillates ikke svalgangslosninger for adkomst til boenhetene i planomradet", mens rarapporten sier flere byvillaleiligheter har egen svalgang. Utsagn om reklamasjonsrett og om at overtakelse ikke kan nektes er generelle kontraktsvilkar og skal ikke importeres som prosjektfakta.' },
  { key: 'P8', title: 'Tidslinje, framdrift, slutninger og fravaer',
    filter: c => /ferdigstill|overlevert|tidslinje|framdrift|2028|2030|halvveis|slutning|byggemetode|grunnforhold|kartpunkt|plassering|ikke funnet/i.test(c.field + ' ' + c.value + ' ' + c.subject) || c.temporal_kind === 'inference' || c.temporal_kind === 'absence_of_evidence',
    focus: 'Antall overleverte boliger er et oyeblikksbilde fra en datert annonse og ma ha den datoen med seg. Slutningen om at prosjektet er halvveis er en regneoperasjon pa to usikre tall og skal ikke bli et publiserbart faktum. Ferdigstillelsesformuleringene juni 2028-2030, 2028-2030 og senest 2030 kommer fra ulike kilder med ulik dato - bevar hvilken kilde som sier hva. Kartpunkter med verbal plasseringssikkerhet er IKKE geoverifikasjon; ingen av dem kan bli approved som posisjon uten kontrollert situasjonsplan, og geography-feltet skal si hva vi faktisk vet i klartekst.' },
]

function pick(batch) {
  const used = new Set()
  const out = []
  for (const sec of ALL_CLAIMS) {
    for (const c of sec.claims) {
      const id = sec.section + '/' + c.local_id
      if (used.has(id)) continue
      if (batch.filter(c)) { used.add(id); out.push({ ...c, section: sec.section, global_ref: id }) }
    }
  }
  return out
}

const assigned = new Set()
const batchClaims = {}
for (const b of BATCHES) {
  const mine = pick(b).filter(c => !assigned.has(c.global_ref))
  mine.forEach(c => assigned.add(c.global_ref))
  batchClaims[b.key] = mine
}
const leftovers = []
for (const sec of ALL_CLAIMS) {
  for (const c of sec.claims) {
    const id = sec.section + '/' + c.local_id
    if (!assigned.has(id)) leftovers.push({ ...c, section: sec.section, global_ref: id })
  }
}
if (leftovers.length) {
  batchClaims['P8'] = batchClaims['P8'].concat(leftovers)
  log(`${leftovers.length} pastander falt utenfor filtrene og er lagt til P8 slik at ingen mistes.`)
}
log(BATCHES.map(b => `${b.key}=${batchClaims[b.key].length}`).join(' '))

const LENSES = [
  { id: 'kildedekning', prompt: 'Du kontrollerer KILDEDEKNING. For hver godkjente pastand: sier den oppgitte kilden faktisk dette, ordrett eller uten tolkningssprang? Er kilden primaer for nettopp dette forholdet, eller er den fagpresse eller markedsforing? Finnes kilden i bevispakken som faktisk apnet, eller er den bare sitert videre fra rarapporten? Er kilden knyttet til pastanden, eller bare til temaet? Default til refuted=true ved tvil. Apne kilden pa nytt med WebFetch hvis ordlyden er avgjorende.' },
  { id: 'sammenblanding-og-tid', prompt: 'Du kontrollerer SAMMENBLANDING OG TID. For hver godkjente pastand: gjelder den faktisk Leangenbukta og ikke naboprosjektet Leangen Bolig, travbaneomradet eller et annet Lade-prosjekt? Er byggetrinn, sameie, bygg og salgstrinn holdt fra hverandre? Er en planlagt eller regulert tilstand framstilt som ferdig? Er kilden eldre enn tidspunktet den lovte, slik at dagens status egentlig er ukjent? Er en status utledet av at en dato har passert? Blandes eksisterende, under bygging, planlagt og historisk? Default til refuted=true ved tvil.' },
]

const adjudicated = await pipeline(
  BATCHES,
  b => agent(
    `${GRUNNREGLER}

Du er fagvurderer for omradet ${b.key}: ${b.title}.

FOKUS FOR DITT OMRADE:
${b.focus}

Du har fire ting a jobbe med:
1. PASTANDENE fra atomiseringen av rarapporten (under). De er KANDIDATER, ikke sannhet.
2. BEVISPAKKEN fra kildeinnhentingen (under). Dette er hva kildene faktisk sa da de ble apnet ${TODAY}.
3. PLANGRUNNLAGET (under). Reguleringsplanen r20160019 er lest i sin helhet direkte fra kommunens dokumenter og er autoritativ.
4. WebFetch og WebSearch, hvis du trenger a apne en kilde pa nytt for a sjekke ordlyd. Last dem med
   ToolSearch query "select:WebFetch,WebSearch". Rarapporten ligger i ${REPO}/${RAW} hvis du trenger kontekst.

Slik jobber du:
- Sla sammen pastander som beviselig uttrykker SAMME forhold til en claim, og noter alle raw_refs. Ikke sla sammen
  pastander som gjelder ulike bygg, ulike fasiliteter eller ulike tidspunkt.
- Gi hver claim en stabil claim_id pa formen LB-${b.key}-001, LB-${b.key}-002 og sa videre.
- Opprett entities for hvert objekt claimene handler om, med canonical_id, scope og gjenbruksregler.
- Sett observed_at til ${TODAY} for alt du selv har kontrollert i bevispakken. source_date er kildens egen dato.
- valid_from og valid_to settes bare nar de faktisk folger av kilden. Tom streng ellers.
- conflict_notes skal si hvilke kilder som spriker og hvorfor den ene ble prioritert - eller at konflikten star apen.
- Registrer i conflicts alle reelle OG tilsynelatende konflikter, og sett is_real_conflict=false der to tall
  gjelder ulike storrelser og begge kan vaere riktige.
- open_questions er de sporsmalene som ma besvares for innholdet kan publiseres, med hvem som kan svare.
- Ikke finn pa koordinater, datoer eller identifikatorer. Bruk tom streng nar noe faktisk er ukjent.

PASTANDER TIL VURDERING:
${JSON.stringify(batchClaims[b.key], null, 1)}

PLANGRUNNLAG (primaerkilde, lest direkte):
${PLAN}

BEVISPAKKE FRA KILDEINNHENTINGEN:
${EVIDENCE}

Returner strukturert.`,
    { label: `vurder:${b.key}`, phase: 'Vurdering', schema: ADJ_SCHEMA },
  ),
  (adj, b) => {
    if (!adj) return null
    const publishable = adj.claims.filter(c => c.status === 'approved' || c.status === 'approved_time_sensitive')
    if (!publishable.length) return { adj, verdicts: [] }
    return parallel(LENSES.map(l => () => agent(
      `${GRUNNREGLER}

Du er skeptiker for omrade ${b.key}: ${b.title}. Oppdraget ditt er a RIVE NED, ikke a bekrefte.
Alt du far er pastander som en vurderer har GODKJENT. Din jobb er a finne dem som ikke burde vaert godkjent.

${l.prompt}

Du har WebFetch og WebSearch tilgjengelig via ToolSearch query "select:WebFetch,WebSearch".

For hver pastand: sett refuted=true hvis den ikke holder, og foresla riktig status i proposed_status.
Sett refuted=false og proposed_status "uendret" bare nar du faktisk har forsokt a rive den ned og mislyktes.
Meld ogsa fra i copy_problems om approved_copy inneholder markedsforingssprak, udokumenterte vurderinger,
beregnede avstander, rangeringer, juridiske lofter, eller framstiller planlagte forhold som ferdige.

GODKJENTE PASTANDER DU SKAL ANGRIPE:
${JSON.stringify(publishable, null, 1)}

PLANGRUNNLAG (primaerkilde, lest direkte):
${PLAN}

BEVISPAKKE:
${EVIDENCE}

Returner strukturert.`,
      { label: `motprov:${b.key}:${l.id}`, phase: 'Motprove', schema: REFUTE_SCHEMA },
    ))).then(vs => ({ adj, verdicts: vs.filter(Boolean) }))
  },
)

phase('Dekning')
const inventory = adjudicated.filter(Boolean).flatMap(r => r.adj.claims.map(c => ({
  claim_id: c.claim_id, subject_id: c.subject_id, field: c.field, value: c.value, status: c.status, raw_refs: c.raw_refs,
})))

const critics = await parallel([
  () => agent(
    `${GRUNNREGLER}

Du er dekningskritiker. Les HELE rarapporten ${REPO}/${RAW} med Read-verktoyet, seksjon for seksjon,
inkludert TL;DR, Key Findings, alle seks nummererte avsnitt, Recommendations, Caveats, Faktatabellen,
tabellen over gjennomgatte kilder, kjoperspørsmalene, kartpunkt-tabellen og spørsmalene til utbygger.

Sammenlign med inventaret under, som er alle pastander som faktisk er vurdert.

Finn alt som er hoppet over: pastander i rarapporten som ikke gjenfinnes i inventaret, forhold som er slatt
sammen og dermed mistet, og opplysninger som er vurdert men der en del av pastanden er borte.
Oppgi et faktisk dekningsregnskap: X av Y radpastander gjenfinnes.

Du skal IKKE vurdere om pastandene er riktige - bare om de er behandlet.

INVENTAR OVER VURDERTE PASTANDER:
${JSON.stringify(inventory, null, 1)}

Returner strukturert. La checkpoint_status vaere en tom liste.`,
    { label: 'dekning:rarapport', phase: 'Dekning', schema: CRITIC_SCHEMA },
  ),
  () => agent(
    `${GRUNNREGLER}

Du er kontrollpunktkritiker. Les mottaksnotatet ${REPO}/${MOTTAK} med Read-verktoyet.
Det inneholder 15 kontrollpunkter K1 til K15 som skal vaere handtert for import.

For HVERT kontrollpunkt K1-K15: avgjor om det vurderte settet under faktisk handterer det, og forklar hvordan.
Sett handled=false der kontrollpunktet ikke er lost, og beskriv i suggested_handling hva som mangler.
Meld ogsa i gaps alt du ser av behandling som strider mot et kontrollpunkt - for eksempel en pastand som lar
en passert dato endre status, en negativ pastand bygget pa manglende funn, eller et kartpunkt som er godkjent
som posisjon uten kontrollert situasjonsplan.

VURDERT SETT:
${JSON.stringify(inventory, null, 1)}

Returner strukturert. coverage_count skal si hvor mange av de 15 kontrollpunktene som er handtert.`,
    { label: 'dekning:kontrollpunkter', phase: 'Dekning', schema: CRITIC_SCHEMA },
  ),
])

return {
  adjudicated: adjudicated.filter(Boolean),
  critics: critics.filter(Boolean),
}
