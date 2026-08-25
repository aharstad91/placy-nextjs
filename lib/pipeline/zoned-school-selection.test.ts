import { describe, it, expect } from "vitest";
import {
  normalizeSchoolKey,
  matchKretsToSchool,
  isOneEditApart,
  planSchoolDeduplication,
  planStaleSchoolUnlink,
  normalizeFullSchoolName,
  nearestOfType,
  resolveSchoolTypeFromNsr,
  selectSchools,
  isSameSchool,
  type SchoolCandidate,
} from "@/lib/pipeline/zoned-school-selection";

describe("resolveSchoolTypeFromNsr", () => {
  it("gir grunnskole for nace 85.201 — Trondheim koder ALLE grunnskoler slik", () => {
    // Kommunen har ikke én 85.21x-enhet. Uten grunnskole-verdien kunne typen
    // «ungdomsskole» aldri oppstå, og ungdomskretsen ville alltid bommet.
    expect(resolveSchoolTypeFromNsr("85.201", "Markaplassen skole")).toBe("grunnskole");
    expect(resolveSchoolTypeFromNsr("85.201", "Ranheim skole")).toBe("grunnskole");
  });

  it("leser skoleslaget ut av navnet når koden ikke bærer det", () => {
    expect(resolveSchoolTypeFromNsr("85.201", "Charlottenlund ungdomsskole")).toBe("ungdomsskole");
    expect(resolveSchoolTypeFromNsr("85.201", "Charlottenlund barneskole")).toBe("barneskole");
  });

  it("gir videregående både på kode og navn", () => {
    expect(resolveSchoolTypeFromNsr("85.320", "Charlottenlund videregående skole")).toBe("videregaende");
    expect(resolveSchoolTypeFromNsr("85.201", "Thora Storm videregående skole")).toBe("videregaende");
  });

  it("beholder 85.21x som ungdomsskole der kommunen faktisk bruker koden", () => {
    // Inderøy koder Inderøy ungdomsskole slik — oppførselen må ikke regge.
    expect(resolveSchoolTypeFromNsr("85.212", "Inderøy ungdomsskole")).toBe("ungdomsskole");
  });

  it("luker ut kjøre-, musikk- og kompetanseskoler", () => {
    // «Møller bilskolen» sto som ungdomsskolen på Wesselsløkka-boardet.
    expect(resolveSchoolTypeFromNsr("85.212", "Møller bilskolen AS avd Trøndelag")).toBeNull();
    expect(resolveSchoolTypeFromNsr("85.201", "Trondheim kommunale musikkskole")).toBeNull();
    expect(resolveSchoolTypeFromNsr("85.201", "Norges Fagakademi Kompetanse AS")).toBeNull();
  });

  it("returnerer null for irrelevante nace-koder", () => {
    expect(resolveSchoolTypeFromNsr("85.510", "Danseverkstedet")).toBeNull();
  });
});

function school(
  name: string,
  type: SchoolCandidate["type"],
  distanceMeters: number,
  id = name,
): SchoolCandidate {
  return { id, name, type, distanceMeters };
}

describe("normalizeSchoolKey", () => {
  it("stripper skoleslags-ord så kretsnavn matcher NSR-navn", () => {
    expect(normalizeSchoolKey("Ranheim skole")).toBe("ranheim");
    expect(normalizeSchoolKey("RANHEIM")).toBe("ranheim");
    expect(normalizeSchoolKey("Charlottenlund ungdomsskole")).toBe("charlottenlund");
    expect(normalizeSchoolKey("Charlottenlund videregående skole")).toBe("charlottenlund");
  });

  it("translittererer norske bokstaver", () => {
    expect(normalizeSchoolKey("VIKÅSEN")).toBe("vikasen");
    expect(normalizeSchoolKey("Vikåsen skole")).toBe("vikasen");
    expect(normalizeSchoolKey("ÅSHEIM")).toBe("asheim");
  });

  it("takler blandet skrivemåte i kretsdataene", () => {
    // «Hansbakken» står med stor forbokstav mens resten er versaler.
    expect(normalizeSchoolKey("Hansbakken")).toBe(normalizeSchoolKey("Hansbakken skole"));
  });

  it("fjerner selskapsform og «Stiftelsen»", () => {
    expect(normalizeSchoolKey("Stiftelsen steinerskolen på Rotvoll")).toContain("rotvoll");
    expect(normalizeSchoolKey("Lukas videregående skole AS")).toBe("lukas");
  });
});

describe("matchKretsToSchool", () => {
  const kandidater = [
    school("Ranheim skole", "barneskole", 1170),
    school("Stiftelsen steinerskolen på Rotvoll", "barneskole", 1150),
    school("Charlottenlund ungdomsskole", "ungdomsskole", 1585),
    school("Markaplassen skole", "ungdomsskole", 2943),
  ];

  it("finner kretsskolen selv når en annen ligger nærmere", () => {
    const treff = matchKretsToSchool("RANHEIM", kandidater, "barneskole");
    expect(treff?.name).toBe("Ranheim skole");
  });

  it("finner kretsskolen langt utenfor radius", () => {
    const treff = matchKretsToSchool("MARKAPLASSEN", kandidater, "ungdomsskole");
    expect(treff?.name).toBe("Markaplassen skole");
    expect(treff?.distanceMeters).toBe(2943);
  });

  it("respekterer skoletype — samme navn, ulik type", () => {
    const begge = [
      school("Charlottenlund skole", "barneskole", 1684),
      school("Charlottenlund ungdomsskole", "ungdomsskole", 1585),
    ];
    expect(matchKretsToSchool("CHARLOTTENLUND", begge, "barneskole")?.name).toBe("Charlottenlund skole");
    expect(matchKretsToSchool("CHARLOTTENLUND", begge, "ungdomsskole")?.name).toBe("Charlottenlund ungdomsskole");
  });

  it("returnerer null uten krets (utenfor Trondheim)", () => {
    expect(matchKretsToSchool(null, kandidater, "barneskole")).toBeNull();
  });

  it("returnerer null når ingen skole bærer kretsens navn", () => {
    expect(matchKretsToSchool("SPONGDAL", kandidater, "barneskole")).toBeNull();
  });

  it("tar én tegns stavefeil når treffet er entydig", () => {
    const blussuvoll = [school("Blussuvoll skole", "grunnskole", 1200)];
    expect(matchKretsToSchool("BLUSSUVOLD", blussuvoll, "ungdomsskole")?.name).toBe("Blussuvoll skole");
  });

  it("avstår fra nær-match når to skoler ligger like nær navnet", () => {
    const tvetydig = [
      school("Blussuvoll skole", "grunnskole", 1200),
      school("Blussuvolt skole", "grunnskole", 1400),
    ];
    expect(matchKretsToSchool("BLUSSUVOLD", tvetydig, "ungdomsskole")).toBeNull();
  });

  it("godtar 1–10-skole for begge kretstyper — Markaplassen-caset", () => {
    // «Markaplassen skole» er en 1–10-skole og ER ungdomsskolen for kretsen.
    const ettTilTi = [school("Markaplassen skole", "grunnskole", 2943)];
    expect(matchKretsToSchool("MARKAPLASSEN", ettTilTi, "ungdomsskole")?.name).toBe("Markaplassen skole");
    expect(matchKretsToSchool("MARKAPLASSEN", ettTilTi, "barneskole")?.name).toBe("Markaplassen skole");
  });

  it("lar eksplisitt type slå 1–10-skole ved samme navn, uansett avstand", () => {
    // Begge normaliserer til «charlottenlund». Sorteres det på avstand til
    // slutt, kaprer barneskolen ungdomskretsen.
    const begge = [
      school("Charlottenlund barneskole", "barneskole", 900),
      school("Charlottenlund ungdomsskole", "ungdomsskole", 1585),
    ];
    expect(matchKretsToSchool("CHARLOTTENLUND", begge, "ungdomsskole")?.name).toBe(
      "Charlottenlund ungdomsskole",
    );
  });
});

describe("isOneEditApart", () => {
  it("godtar én tegns bytte — BLUSSUVOLD mot Blussuvoll", () => {
    expect(isOneEditApart("blussuvold", "blussuvoll")).toBe(true);
  });

  it("godtar én innsetting og én sletting", () => {
    expect(isOneEditApart("charlottenlund", "charlottenlnd")).toBe(true);
    expect(isOneEditApart("markaplassen", "markaplasssen")).toBe(true);
  });

  it("avviser to eller flere redigeringer", () => {
    expect(isOneEditApart("blussuvold", "blussuvant")).toBe(false);
    expect(isOneEditApart("ranheim", "rosenborg")).toBe(false);
  });

  it("krever eksakt likhet under 6 tegn", () => {
    // «Ila» mot «Ola» er én redigering, men det er to ulike steder.
    expect(isOneEditApart("ila", "ola")).toBe(false);
    expect(isOneEditApart("ila", "ila")).toBe(true);
  });

  it("avviser lengdeforskjell over 1", () => {
    expect(isOneEditApart("markaplassen", "marka")).toBe(false);
  });
});

describe("nearestOfType", () => {
  it("velger nærmeste innenfor radius", () => {
    const valgt = nearestOfType(
      [school("Fjern", "barneskole", 2400), school("Nær", "barneskole", 800)],
      "barneskole",
      2500,
    );
    expect(valgt?.name).toBe("Nær");
  });

  it("ignorerer kandidater utenfor radius", () => {
    expect(nearestOfType([school("Fjern", "barneskole", 4000)], "barneskole", 2500)).toBeNull();
  });

  it("er deterministisk ved lik avstand — alfabetisk", () => {
    const a = nearestOfType(
      [school("B skole", "barneskole", 1000), school("A skole", "barneskole", 1000)],
      "barneskole",
      2500,
    );
    expect(a?.name).toBe("A skole");
  });
});

describe("selectSchools", () => {
  const grilstad = [
    school("Stiftelsen steinerskolen på Rotvoll", "barneskole", 1150),
    school("Ranheim skole", "barneskole", 1170),
    school("Charlottenlund ungdomsskole", "ungdomsskole", 1585),
    school("Markaplassen skole", "ungdomsskole", 2943),
    school("Lukas videregående skole AS", "videregaende", 1256),
  ];

  it("velger kretsskolen framfor nærmeste — Grilstad-caset", () => {
    const { picks } = selectSchools(
      { barneskole: "RANHEIM", ungdomsskole: "CHARLOTTENLUND" },
      grilstad,
      2500,
    );
    const krets = picks.filter((p) => p.reason === "krets").map((p) => p.candidate.name);
    expect(krets).toEqual(["Ranheim skole", "Charlottenlund ungdomsskole"]);
  });

  it("tar med alle skoler innenfor radius — kretsskolen først, resten som nabolagsfakta", () => {
    // ENDRET 2026-08-24: kretsvalget stod alene, og rev «Stiftelsen
    // steinerskolen på Rotvoll» av boardet selv om den ligger 1 150 m unna og
    // finnes i poolen fra to kilder. En privatskole i strøket er et
    // nabolagsfaktum uansett hvem som sogner dit.
    const { picks } = selectSchools(
      { barneskole: "RANHEIM", ungdomsskole: "CHARLOTTENLUND" },
      grilstad,
      2500,
    );
    const byName = new Map(picks.map((p) => [p.candidate.name, p.reason]));
    expect(byName.get("Ranheim skole")).toBe("krets");
    expect(byName.get("Charlottenlund ungdomsskole")).toBe("krets");
    expect(byName.get("Stiftelsen steinerskolen på Rotvoll")).toBe("i-omraadet");
    // Markaplassen ligger 2 943 m unna og er ikke krets her — den skal UT.
    expect(byName.has("Markaplassen skole")).toBe(false);
  });

  it("luker ut fengselsundervisning og voksenopplæring", () => {
    // NSR koder dem som ordinære videregående enheter. Før 2026-08-24 var de
    // usynlige fordi bare nærmeste vgs ble valgt; nå må de filtreres eksplisitt.
    const { picks } = selectSchools(
      { barneskole: null, ungdomsskole: null },
      [
        school("Charlottenlund videregående skole avd Trondheim Fengsel", "videregaende", 800),
        school("Trondheim voksenopplæringssenter", "videregaende", 900),
        school("Lukas videregående skole AS", "videregaende", 1256),
      ],
      2500,
    );
    expect(picks.map((p) => p.candidate.name)).toEqual(["Lukas videregående skole AS"]);
  });

  it("henter kretsskolen selv om den ligger utenfor radius — Vikåsen-caset", () => {
    const { picks } = selectSchools(
      { barneskole: "RANHEIM", ungdomsskole: "MARKAPLASSEN" },
      grilstad,
      2500,
    );
    const markaplassen = picks.find((p) => p.candidate.name === "Markaplassen skole");
    expect(markaplassen).toBeDefined();
    expect(markaplassen?.reason).toBe("krets");
    expect(markaplassen?.candidate.distanceMeters).toBeGreaterThan(2500);
  });

  it("faller tilbake til nærmeste utenfor kretsdekning (Straumen/Oppdal)", () => {
    const { picks, warnings } = selectSchools(
      { barneskole: null, ungdomsskole: null },
      [school("Sakshaug skole", "barneskole", 900), school("Inderøy ungdomsskole", "ungdomsskole", 1200)],
      2500,
    );
    expect(picks.map((p) => p.reason)).toEqual(["naermeste", "naermeste"]);
    expect(warnings).toEqual([]);
  });

  it("advarer når kretsen finnes men ingen skole bærer navnet", () => {
    const { picks, warnings } = selectSchools(
      { barneskole: "UKJENTVIK", ungdomsskole: null },
      [school("En annen skole", "barneskole", 700)],
      2500,
    );
    expect(warnings[0]).toContain("UKJENTVIK");
    expect(picks[0].reason).toBe("naermeste");
  });

  it("velger videregående på avstand — det finnes ingen kretser for vgs", () => {
    const { picks } = selectSchools({ barneskole: null, ungdomsskole: null }, grilstad, 2500);
    const vgs = picks.find((p) => p.type === "videregaende");
    expect(vgs?.candidate.name).toBe("Lukas videregående skole AS");
    // Ligger innenfor radiusen, så den kommer inn som nabolagsfakta. Reason
    // «naermeste» er reservert for fallbacken når ingen lå innenfor.
    expect(vgs?.reason).toBe("i-omraadet");
  });

  it("tar ikke inn videregående utenfor radius — den hører i skolefaktaene, ikke som pin", () => {
    const { picks } = selectSchools(
      { barneskole: null, ungdomsskole: null },
      [school("Lukas videregående skole AS", "videregaende", 4000)],
      2500,
    );
    // Videregående har ingen krets, så det finnes ingen grunn til å bryte
    // radiusen for den. `fetchSchoolFacts` lister byens vgs med reisetid i
    // FAQ-en uansett — der hører et tilbud 4 km unna hjemme.
    expect(picks).toEqual([]);
  });

  it("dupliserer ikke når kretsskolen ogsa er nærmeste", () => {
    const { picks } = selectSchools(
      { barneskole: "RANHEIM", ungdomsskole: null },
      [school("Ranheim skole", "barneskole", 400)],
      2500,
    );
    expect(picks).toHaveLength(1);
    expect(picks[0].reason).toBe("krets");
  });

  it("gir tom liste uten kandidater i det hele tatt", () => {
    const { picks } = selectSchools({ barneskole: "RANHEIM", ungdomsskole: null }, [], 2500);
    expect(picks).toEqual([]);
  });
});

describe("planSchoolDeduplication", () => {
  const valgt = [{ id: "nsr-1", name: "Charlottenlund ungdomsskole", lat: 63.4300, lng: 10.5200 }];

  it("finner samme skole fra en annen kilde i poolen", () => {
    const unlink = planSchoolDeduplication(
      valgt,
      [{ id: "osm-way-93079466", name: "Charlottenlund ungdomsskole", lat: 63.4301, lng: 10.5201 }],
      new Set(),
    );
    expect(unlink.map((u) => u.id)).toEqual(["osm-way-93079466"]);
  });

  it("freder rader strøk-kurateringen peker på", () => {
    const unlink = planSchoolDeduplication(
      valgt,
      [{ id: "kuratert-rad", name: "Charlottenlund ungdomsskole", lat: 63.4301, lng: 10.5201 }],
      new Set(["kuratert-rad"]),
    );
    expect(unlink).toEqual([]);
  });

  it("rører ikke den valgte raden selv", () => {
    expect(planSchoolDeduplication(valgt, valgt, new Set())).toEqual([]);
  });

  it("rører ikke en annen skole med samme navn langt unna", () => {
    // To skoler kan hete det samme i ulike bydeler — avstanden avgjør.
    const unlink = planSchoolDeduplication(
      valgt,
      [{ id: "annen-bydel", name: "Charlottenlund ungdomsskole", lat: 63.4800, lng: 10.6000 }],
      new Set(),
    );
    expect(unlink).toEqual([]);
  });

  it("rører ikke skoler med annet navn", () => {
    const unlink = planSchoolDeduplication(
      valgt,
      [{ id: "hansbakken", name: "Hansbakken skole", lat: 63.4301, lng: 10.5201 }],
      new Set(),
    );
    expect(unlink).toEqual([]);
  });
});

describe("normalizeFullSchoolName", () => {
  it("skiller barneskole fra ungdomsskole på samme tomt", () => {
    // Med kretsnøkkelen ble «Charlottenlund barneskole» feilaktig fjernet som
    // dublett av «Charlottenlund ungdomsskole».
    expect(normalizeFullSchoolName("Charlottenlund barneskole")).not.toBe(
      normalizeFullSchoolName("Charlottenlund ungdomsskole"),
    );
  });

  it("regner selskapsform og «Stiftelsen» som støy", () => {
    expect(normalizeFullSchoolName("Lukas videregående skole AS")).toBe(
      normalizeFullSchoolName("Lukas videregående skole"),
    );
    expect(normalizeFullSchoolName("Stiftelsen steinerskolen på Rotvoll")).toBe(
      normalizeFullSchoolName("Steinerskolen på Rotvoll"),
    );
  });
});

describe("planSchoolDeduplication — skoleslag skiller", () => {
  it("fjerner ikke barneskolen når ungdomsskolen er valgt", () => {
    const unlink = planSchoolDeduplication(
      [{ id: "nsr-ung", name: "Charlottenlund ungdomsskole", lat: 63.43, lng: 10.52 }],
      [{ id: "osm-barne", name: "Charlottenlund barneskole", lat: 63.4301, lng: 10.5201 }],
      new Set(),
    );
    expect(unlink).toEqual([]);
  });

  it("fjerner fortsatt samme skole fra en annen kilde", () => {
    const unlink = planSchoolDeduplication(
      [{ id: "nsr-lukas", name: "Lukas videregående skole AS", lat: 63.43, lng: 10.52 }],
      [{ id: "osm-lukas", name: "Lukas videregående skole", lat: 63.4301, lng: 10.5201 }],
      new Set(),
    );
    expect(unlink.map((u) => u.id)).toEqual(["osm-lukas"]);
  });
});

describe("nearestOfType — avstand dominerer", () => {
  it("velger nærmeste 1–10-skole framfor fjernere eksplisitt ungdomsskole", () => {
    // Type-prioritet her ga Wesselsløkka Charlottenlund-skolene 2,4 km unna
    // framfor Eberg skole 665 m unna.
    const valgt = nearestOfType(
      [
        school("Alfaskolen", "grunnskole", 300),
        school("Gamma ungdomsskole", "ungdomsskole", 900),
      ],
      "ungdomsskole",
      2500,
    );
    expect(valgt?.name).toBe("Alfaskolen");
  });

  it("hopper over rader som alt er valgt, så én skole ikke fyller to plasser", () => {
    const valgt = nearestOfType(
      [
        school("Alfaskolen", "grunnskole", 300),
        school("Gamma ungdomsskole", "ungdomsskole", 900),
      ],
      "ungdomsskole",
      2500,
      new Set(["Alfaskolen"]),
    );
    expect(valgt?.name).toBe("Gamma ungdomsskole");
  });
});

describe("planStaleSchoolUnlink", () => {
  const pooled = [
    { id: "nsr-bil", name: "Møller bilskolen AS", lat: 63.42, lng: 10.45, source: "nsr" },
    { id: "osm-1", name: "Hansbakken skole", lat: 63.42, lng: 10.45, source: "osm" },
    { id: "nsr-eberg", name: "Eberg skole", lat: 63.42, lng: 10.45, source: "nsr" },
  ];

  it("rydder NSR-rader pipelinen ikke lenger velger", () => {
    const stale = planStaleSchoolUnlink(new Set(["nsr-eberg"]), pooled, new Set());
    expect(stale.map((s) => s.id)).toEqual(["nsr-bil"]);
  });

  it("rører ikke OSM-rader — de eies av sveipet, ikke av pipelinen", () => {
    const stale = planStaleSchoolUnlink(new Set(), pooled, new Set());
    expect(stale.map((s) => s.id)).not.toContain("osm-1");
  });

  it("freder rader kuratering peker på", () => {
    const stale = planStaleSchoolUnlink(new Set(), pooled, new Set(["nsr-bil"]));
    expect(stale.map((s) => s.id)).toEqual(["nsr-eberg"]);
  });
});

describe("isSameSchool — NSR-dubletter", () => {
  it("morenhet og avdeling på samme koordinat er samme skole", () => {
    expect(
      isSameSchool(
        school("Stiftelsen steinerskolen på Rotvoll", "grunnskole", 1066),
        school("Stiftelsen steinerskolen Rotvoll", "grunnskole", 1066),
      ),
    ).toBe(true);
  });

  it("barneskolen og ungdomsskolen på samme tomt er IKKE samme skole", () => {
    expect(
      isSameSchool(
        school("Charlottenlund barneskole", "barneskole", 1343),
        school("Charlottenlund ungdomsskole", "ungdomsskole", 1343),
      ),
    ).toBe(false);
  });

  it("samme navn på to ulike tomter er to skoler", () => {
    expect(
      isSameSchool(
        school("Lukas videregående skole", "videregaende", 1167),
        school("Lukas videregående skole AS", "videregaende", 4000),
      ),
    ).toBe(false);
  });
});

describe("selectSchools — kretsskolen er merket, ikke alene", () => {
  it("tar bare med én av to NSR-rader for samme skole", () => {
    const { picks } = selectSchools(
      { barneskole: null, ungdomsskole: null },
      [
        school("Stiftelsen steinerskolen på Rotvoll", "grunnskole", 1066),
        school("Stiftelsen steinerskolen Rotvoll", "grunnskole", 1066),
      ],
      2500,
    );
    expect(picks).toHaveLength(1);
  });

  it("kretsskolene får reason «krets», de øvrige i radius «i-omraadet»", () => {
    const { picks } = selectSchools(
      { barneskole: "EBERG", ungdomsskole: "BLUSSUVOLD" },
      [
        school("Eberg skole", "grunnskole", 665),
        school("Blussuvoll skole", "grunnskole", 1030),
        school("Charlottenlund barneskole", "barneskole", 2400),
        school("Charlottenlund ungdomsskole", "ungdomsskole", 2400),
      ],
      2500,
    );
    expect(picks.map((p) => [p.candidate.name, p.reason])).toEqual([
      ["Eberg skole", "krets"],
      ["Blussuvoll skole", "krets"],
      ["Charlottenlund barneskole", "i-omraadet"],
      ["Charlottenlund ungdomsskole", "i-omraadet"],
    ]);
  });

  it("sorterer nabolags-skolene nærmest først", () => {
    const { picks } = selectSchools(
      { barneskole: null, ungdomsskole: null },
      [
        school("Fjern skole", "grunnskole", 2100),
        school("Nær skole", "grunnskole", 400),
        school("Midt skole", "grunnskole", 1200),
      ],
      2500,
    );
    // Første pick er nærmeste-fallbacken for barnetrinnet (ingen krets), så
    // resten følger på avstand.
    expect(picks.map((p) => p.candidate.name)).toEqual([
      "Nær skole",
      "Midt skole",
      "Fjern skole",
    ]);
  });
});
