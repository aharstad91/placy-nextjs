import {
  HENTET_DATO_ISO,
  NYHAVNA_KULTUR,
  NYHAVNA_LEVE,
  NYHAVNA_PARK,
  NYHAVNA_SERVERING,
  NYHAVNA_SOURCE_IDS,
} from "@/lib/demo/nyhavna-leve/sources";

export type KnowledgeTheme =
  | "cafe-and-restaurants"
  | "art-and-culture"
  | "parks"
  | "promenade";

export type KnowledgeVerification = "confirmed" | "unresolved";
export type KnowledgeEntityStatus =
  | "existing"
  | "planned"
  | "existing-with-planned-changes"
  | "unresolved";

export interface KnowledgeSource {
  id: string;
  label: string;
  page: string;
  url: string;
  publisher: string;
  checkedAt: string;
}

export interface KnowledgeFact {
  id: string;
  text: string;
  sourceId: string;
  checkedAt: string;
  verification: KnowledgeVerification;
}

export interface KnowledgeRelation {
  type:
    | "part_of"
    | "contains"
    | "near"
    | "connects_to"
    | "named_with"
    | "planned_next_to";
  targetEntityId: string;
  sourceId: string;
  checkedAt: string;
  verification: KnowledgeVerification;
}

export interface KnowledgeEntity {
  id: string;
  name: string;
  aliases: string[];
  themes: KnowledgeTheme[];
  status: KnowledgeEntityStatus;
  mapPoiId: string | null;
  summary: string;
  facts: KnowledgeFact[];
  relations: KnowledgeRelation[];
}

export interface KnowledgeArea
  extends Omit<KnowledgeEntity, "id" | "mapPoiId"> {
  id: "nyhavna";
  mapPoiId: null;
}

const checkedAt = HENTET_DATO_ISO;

const source = (
  id: string,
  value: { label: string; page?: string; url: string },
): KnowledgeSource => ({
  id,
  label: value.label,
  page: value.page ?? value.label,
  url: value.url,
  publisher: "Nyhavna Utvikling",
  checkedAt,
});

const fact = (
  id: string,
  text: string,
  sourceId: string,
  verification: KnowledgeVerification = "confirmed",
): KnowledgeFact => ({ id, text, sourceId, checkedAt, verification });

const relation = (
  type: KnowledgeRelation["type"],
  targetEntityId: string,
  sourceId: string,
  verification: KnowledgeVerification = "confirmed",
): KnowledgeRelation => ({
  type,
  targetEntityId,
  sourceId,
  checkedAt,
  verification,
});

const S = NYHAVNA_SOURCE_IDS;

export const nyhavnaKnowledge = {
  schemaVersion: 1,
  checkedAt,
  sources: [
    source(S.leve, NYHAVNA_LEVE),
    source(S.servering, NYHAVNA_SERVERING),
    source(S.park, NYHAVNA_PARK),
    source(S.kultur, NYHAVNA_KULTUR),
  ],
  entities: [
    {
      id: "dora-kaffebar",
      name: "Dora Kaffebar",
      aliases: ["Dora kaffe", "Dora café", "Dora kafé"],
      themes: ["cafe-and-restaurants"],
      status: "existing",
      mapPoiId: "leve-dora-kaffebar",
      summary: "Nabolagskafé i Kobbes gate 2 med bakst og håndverkskaffe.",
      facts: [
        fact("dora-kaffebar-kind", "Dora Kaffebar er en nabolagskafé.", S.servering),
        fact("dora-kaffebar-address", "Kafeen holder til i Kobbes gate 2.", S.servering),
        fact("dora-kaffebar-offer", "Nyhavna opplyser at kafeen baker brød og søtbakst og brygger håndverkskaffe.", S.servering),
        fact("dora-kaffebar-hours", "Nyhavna omtaler besøk på ukedager på dagtid, men publiserer ikke konkrete åpningstider på siden.", S.servering, "unresolved"),
      ],
      relations: [relation("part_of", "nyhavna", S.servering)],
    },
    {
      id: "monkey-brew",
      name: "Monkey Brew",
      aliases: ["MonkeyBrew", "Monkey Brew mikrobryggeri"],
      themes: ["cafe-and-restaurants"],
      status: "existing",
      mapPoiId: "leve-monkey-brew",
      summary: "Mikrobryggeri i Kobbes gate 10.",
      facts: [
        fact("monkey-brew-kind", "Monkey Brew er et mikrobryggeri.", S.servering),
        fact("monkey-brew-address", "Bryggeriets lokaler er i Kobbes gate 10.", S.servering),
        fact("monkey-brew-offer", "Nyhavna beskriver fruktig og surt håndverksøl levert til utesteder og Vinmonopolet.", S.servering),
        fact("monkey-brew-hours", "Nyhavna-siden oppgir ukentlig utsalg torsdag og fredag, men opplysningen er ikke bekreftet i en egen oppdatert åpningstidskilde.", S.servering, "unresolved"),
      ],
      relations: [relation("part_of", "nyhavna", S.servering)],
    },
    {
      id: "elvepromenaden",
      name: "Elvepromenaden",
      aliases: ["elvepromenaden langs Nidelva", "promenaden langs Nidelva"],
      themes: ["parks", "promenade"],
      status: "existing-with-planned-changes",
      mapPoiId: "leve-elvepromenaden",
      summary: "Eksisterende ferdselsåre langs Nidelva med planlagt parkutvikling.",
      facts: [
        fact("elvepromenaden-location", "Elvepromenaden går langs Nidelva.", S.park),
        fact("elvepromenaden-current-use", "Nyhavna opplyser at man allerede kan gå og sykle langs promenaden.", S.park),
        fact("elvepromenaden-plan", "Promenaden er planlagt utviklet som park med blant annet benker, lekeapparater og kunst.", S.park),
        fact("elvepromenaden-nature-plan", "Nyhavna planlegger lune soner ved elva for planter, fugler og fisk.", S.park),
      ],
      relations: [
        relation("part_of", "nyhavna", S.park),
      ],
    },
    {
      id: "kulturaksen-skippergata",
      name: "Kulturaksen i Skippergata",
      aliases: ["Kulturaksen", "Skippergata kulturakse"],
      themes: ["art-and-culture"],
      status: "existing-with-planned-changes",
      mapPoiId: "leve-kulturaksen",
      summary: "Ett av tre prioriterte områder for kunst og kultur på Nyhavna.",
      facts: [
        fact("kulturaksen-priority", "Kulturaksen i Skippergata er ett av tre områder Nyhavna peker ut som kulturelle tyngdepunkter.", S.kultur),
        fact("kulturaksen-places", "Nyhavna nevner Fyringsbunkeren, Dora 2, Doratorget og Bunkerparken i kulturaksen.", S.kultur),
        fact("kulturaksen-outdoor-plan", "Utearealer ved Doratorget og Bunkerparken er omtalt for mulig kulturaktivitet og kunst i offentlig rom.", S.kultur),
      ],
      relations: [
        relation("part_of", "nyhavna", S.kultur),
        relation("contains", "fyringsbunkeren", S.kultur),
        relation("contains", "dora-2", S.kultur),
        relation("contains", "doratorget", S.kultur),
        relation("contains", "bunkerparken", S.kultur),
      ],
    },
    {
      id: "fyringsbunkeren",
      name: "Fyringsbunkeren",
      aliases: ["fyringsbunker"],
      themes: ["art-and-culture"],
      status: "existing-with-planned-changes",
      mapPoiId: "leve-fyringsbunkeren",
      summary: "Eksisterende sted i kulturaksen med planlagt kulturaktivitet foran bygget.",
      facts: [
        fact("fyringsbunkeren-axis", "Fyringsbunkeren nevnes som et sted i Kulturaksen i Skippergata.", S.kultur),
        fact("fyringsbunkeren-front-plan", "Nyhavna omtaler planlagt kulturaktivitet og kunst i Bunkerparken foran Fyringsbunkeren.", S.kultur),
      ],
      relations: [
        relation("part_of", "kulturaksen-skippergata", S.kultur),
        relation("near", "bunkerparken", S.kultur),
      ],
    },
    {
      id: "dora-2",
      name: "Dora 2",
      aliases: ["Dora2"],
      themes: ["art-and-culture"],
      status: "existing-with-planned-changes",
      mapPoiId: "leve-dora2",
      summary: "Sted i Kulturaksen i Skippergata som Nyhavna omtaler som egnet for kulturaktivitet.",
      facts: [
        fact("dora-2-axis", "Dora 2 nevnes som et sted i Kulturaksen i Skippergata.", S.kultur),
        fact("dora-2-use", "Nyhavna omtaler stedene i kulturaksen som egnet for kulturaktiviteter.", S.kultur),
      ],
      relations: [relation("part_of", "kulturaksen-skippergata", S.kultur)],
    },
    {
      id: "bunkerparken",
      name: "Bunkerparken",
      aliases: ["Bunkerparken foran Fyringsbunkeren"],
      themes: ["art-and-culture", "parks"],
      status: "unresolved",
      mapPoiId: "leve-bunkerparken",
      summary: "Omtalt foran Fyringsbunkeren; kilden er uklar om dagens opparbeidelse.",
      facts: [
        fact("bunkerparken-axis", "Bunkerparken nevnes i Kulturaksen i Skippergata.", S.kultur),
        fact("bunkerparken-relative-location", "Nyhavna plasserer Bunkerparken foran Fyringsbunkeren.", S.kultur),
        fact("bunkerparken-use-plan", "Nyhavna omtaler tilrettelegging for kulturaktivitet og kunst i offentlig rom.", S.kultur),
        fact("bunkerparken-current-status", "Siden bruker både nåtids- og framtidsform om Bunkerparken; dagens opparbeidelsesstatus er derfor uavklart.", S.kultur, "unresolved"),
      ],
      relations: [
        relation("part_of", "kulturaksen-skippergata", S.kultur),
        relation("near", "fyringsbunkeren", S.kultur),
      ],
    },
    {
      id: "kullkranparken",
      name: "Kullkranparken",
      aliases: ["Kullkran park"],
      themes: ["parks", "art-and-culture"],
      status: "planned",
      mapPoiId: null,
      summary: "Planlagt park omtalt som nabo til et mulig bygg for akustisk musikk.",
      facts: [
        fact("kullkranparken-network", "Kullkranparken inngår i Nyhavnas planlagte grønne nettverk.", S.park),
        fact("kullkranparken-activity", "Nyhavna omtaler tilrettelegging for utendørs musikk, teater, lek og aktivitet.", S.kultur),
        fact("kullkranparken-location", "Primærkildene oppgir ikke en kartplassering som er presis nok for en markør.", S.kultur, "unresolved"),
      ],
      relations: [relation("planned_next_to", "kullkranpiren", S.kultur)],
    },
    {
      id: "jernbaneparken",
      name: "Jernbaneparken",
      aliases: ["Jernbaneparken på Nyhavna"],
      themes: ["parks"],
      status: "planned",
      mapPoiId: null,
      summary: "Planlagt grøntområde for aktivitet og avkobling.",
      facts: [
        fact("jernbaneparken-plan", "Jernbaneparken omtales som en framtidig grønn lunge for aktivitet og avkobling.", S.park),
        fact("jernbaneparken-location", "Nyhavna-siden oppgir ikke en kartplassering som er presis nok for en markør.", S.park, "unresolved"),
      ],
      relations: [relation("part_of", "nyhavna", S.park)],
    },
    {
      id: "transittparken",
      name: "Transittparken",
      aliases: ["Transittparken på Nyhavna"],
      themes: ["parks"],
      status: "planned",
      mapPoiId: null,
      summary: "Planlagt grøntområde for aktivitet og avkobling.",
      facts: [
        fact("transittparken-plan", "Transittparken omtales som en framtidig grønn lunge for aktivitet og avkobling.", S.park),
        fact("transittparken-location", "Nyhavna-siden oppgir ikke en kartplassering som er presis nok for en markør.", S.park, "unresolved"),
      ],
      relations: [relation("part_of", "nyhavna", S.park)],
    },
    {
      id: "elveparken-transittkaia",
      name: "Elveparken langs Transittkaia",
      aliases: ["Elveparken", "Elveparken på Transittkaia"],
      themes: ["parks", "promenade"],
      status: "planned",
      mapPoiId: null,
      summary: "Planlagt grøntområde langs Transittkaia.",
      facts: [
        fact("elveparken-plan", "Elveparken langs Transittkaia omtales som en framtidig grønn lunge for aktivitet og avkobling.", S.park),
        fact("elveparken-location", "Den publiserte omtalen avgrenser ikke parken presist nok for en kartmarkør.", S.park, "unresolved"),
      ],
      relations: [relation("part_of", "nyhavna", S.park)],
    },
    {
      id: "ladehammerkaia-allmenninger",
      name: "Allmenningene ved Ladehammerkaia",
      aliases: ["allmenninger ved Ladehammerkaia", "Ladehammerkaia-allmenningene"],
      themes: ["parks", "promenade"],
      status: "planned",
      mapPoiId: null,
      summary: "Planlagte åpne allmenninger ved Ladehammerkaia.",
      facts: [
        fact("ladehammerkaia-allmenninger-plan", "Nyhavna omtaler åpne allmenninger ved Ladehammerkaia som del av et framtidig grønt nettverk.", S.park),
        fact("ladehammerkaia-allmenninger-location", "Kilden avgrenser ikke allmenningene presist nok for kartmarkører.", S.park, "unresolved"),
      ],
      relations: [relation("part_of", "nyhavna", S.park)],
    },
    {
      id: "doratorget",
      name: "Doratorget",
      aliases: ["Dora-torget", "Dora torget"],
      themes: ["art-and-culture"],
      status: "unresolved",
      mapPoiId: null,
      summary: "Navngitt i kulturaksen, men dagens status og presise plassering er ikke avklart på siden.",
      facts: [
        fact("doratorget-axis", "Doratorget nevnes i Kulturaksen i Skippergata.", S.kultur),
        fact("doratorget-use-plan", "Nyhavna omtaler uteareal ved Doratorget for mulig kulturaktivitet og kunst i offentlig rom.", S.kultur),
        fact("doratorget-status-location", "Kilden bruker både nåtids- og framtidsform og oppgir ingen presis kartplassering; status og plassering er uavklart.", S.kultur, "unresolved"),
      ],
      relations: [relation("part_of", "kulturaksen-skippergata", S.kultur)],
    },
    {
      id: "kullkranpiren",
      name: "Kullkranpiren",
      aliases: ["Kullkran-piren"],
      themes: ["art-and-culture"],
      status: "planned",
      mapPoiId: null,
      summary: "Prioritert kulturområde med mål om et nybygg for akustisk musikk.",
      facts: [
        fact("kullkranpiren-priority", "Kullkranpiren er ett av tre prioriterte områder for kunst og kultur.", S.kultur),
        fact("kullkranpiren-music-plan", "Nyhavna beskriver et mål om å reise et nybygg for akustisk musikk her.", S.kultur),
        fact("kullkranpiren-location", "Kilden oppgir ikke en kartplassering som er presis nok for en markør.", S.kultur, "unresolved"),
      ],
      relations: [relation("planned_next_to", "kullkranparken", S.kultur)],
    },
    {
      id: "strandveikaia-cultural-area",
      name: "Strandveikaia",
      aliases: ["Strandveikaka", "Strandvei-kaia"],
      themes: ["art-and-culture"],
      status: "unresolved",
      mapPoiId: null,
      summary: "Prioritert kulturområde; kildeoverskriften bruker navneformen «Strandveikaka».",
      facts: [
        fact("strandveikaia-priority", "Området under overskriften «Strandveikaka» er ett av tre prioriterte områder for kunst og kultur.", S.kultur),
        fact("strandveikaia-buildings", "Nyhavna opplyser at mange vernede bygg ligger i området og omtaler mulig kulturbruk og publikumsrettet aktivitet i første etasje.", S.kultur),
        fact("strandveikaia-name-location", "Kildens overskrift er «Strandveikaka»; kanonisk navn og presis avgrensning er ikke avklart på siden.", S.kultur, "unresolved"),
      ],
      relations: [relation("part_of", "nyhavna", S.kultur)],
    },
  ] satisfies KnowledgeEntity[],
  area: {
    id: "nyhavna",
    name: "Nyhavna",
    aliases: ["Nyhavna i Trondheim", "bydelen Nyhavna"],
    themes: ["cafe-and-restaurants", "art-and-culture", "parks", "promenade"],
    status: "existing-with-planned-changes",
    mapPoiId: null,
    summary: "Byområde i Trondheim mellom Nidelva, Lademoen, Ladehammeren og Nedre Elvehavn.",
    facts: [
      fact("nyhavna-boundaries", "Nyhavna beskrives mellom Nidelva i vest, Lademoen i øst, Ladehammeren i nord og Nedre Elvehavn i sør.", S.leve),
      fact("nyhavna-access", "Nyhavna omtales som gangnært fra Brattøra, Solsiden og Trondheim sentrum.", S.leve),
      fact("nyhavna-current-change", "Nyhavna opplyser at området er i rask endring og allerede har aktiviteter og tilbud.", S.leve),
      fact("nyhavna-food", "Nyhavna opplyser at det allerede finnes kafeer, restauranter og bryggeri, og at flere er planlagt.", S.servering),
      fact("nyhavna-green-plan", "Nyhavna beskriver et planlagt nettverk av parker, byrom og allmenninger nær vannet.", S.park),
      fact("nyhavna-culture", "Nyhavna beskriver langvarig kunst- og kulturaktivitet og videre planer for atelierer, verksteder, musikkstudioer, gallerier, scener og møteplasser.", S.kultur),
      fact("nyhavna-protected-buildings", "Nyhavna oppgir 12 vernede bygg reist av okkupasjonsmakten under andre verdenskrig; 11 inngår i selskapets planer, mens Dora 1 er privat eid.", S.kultur),
    ],
    relations: [
      relation("contains", "dora-kaffebar", S.servering),
      relation("contains", "monkey-brew", S.servering),
      relation("contains", "elvepromenaden", S.park),
      relation("contains", "kulturaksen-skippergata", S.kultur),
    ],
  } satisfies KnowledgeArea,
} as const;

export type NyhavnaKnowledge = typeof nyhavnaKnowledge;
