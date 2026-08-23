import { describe, expect, it } from "vitest";
import {
  cleanSchoolName,
  generateCategoryFaq,
  generateGlobalFaq,
  type FaqGeneratorInput,
} from "./faq-generator";
import type { Coordinates, POI, ReportBoardFacts } from "@/lib/types";

/**
 * Fakta og koordinater er fra Strindfjordvegen 10 på Ranheim (2026-08-22) —
 * de samme svarene demo-boardet skal gi.
 */
const CENTER: Coordinates = { lat: 63.435107, lng: 10.505335 };

function poi(over: Partial<POI> & { id: string; name: string; categoryId: string }): POI {
  const { categoryId, ...rest } = over;
  return {
    coordinates: { lat: 63.435, lng: 10.505 },
    category: { id: categoryId, name: categoryId, icon: "MapPin", color: "#000" },
    ...rest,
  } as POI;
}

const RANHEIM_SKOLE = poi({
  id: "nsr-975278980",
  name: "Ranheim skole",
  categoryId: "skole",
});
const CHARLOTTENLUND_U = poi({
  id: "nsr-975290158",
  name: "Charlottenlund ungdomsskole",
  categoryId: "skole",
});
const STRINDFJORDVEGEN = poi({
  id: "entur-nsr-stopplace-60260",
  name: "Strindfjordvegen bussholdeplass",
  categoryId: "bus",
  enturStopplaceId: "NSR:StopPlace:60260",
});
const GRILSTADKLEIVA = poi({
  id: "entur-nsr-stopplace-42157",
  name: "Grilstadkleiva bussholdeplass",
  categoryId: "bus",
  enturStopplaceId: "NSR:StopPlace:42157",
});

const FACTS: ReportBoardFacts = {
  factsVersion: 1,
  fetchedAt: "2026-08-22T20:00:00.000Z",
  departureAt: "2026-08-24T08:00:00+02:00",
  stops: [
    {
      stopPlaceId: "NSR:StopPlace:60260",
      name: "Strindfjordvegen",
      distanceM: 28,
      modes: ["bus"],
      directions: [
        { quayId: "NSR:Quay:102724", destinations: ["Grillstad"], lines: ["20"] },
        { quayId: "NSR:Quay:102725", destinations: ["Romolslia"], lines: ["20"] },
      ],
    },
    {
      stopPlaceId: "NSR:StopPlace:42157",
      name: "Grilstadkleiva",
      distanceM: 294,
      modes: ["bus"],
      directions: [
        { quayId: "NSR:Quay:72172", destinations: ["Kattem via sentrum"], lines: ["1"] },
      ],
    },
  ],
  cityCentre: {
    name: "Trondheim S",
    patterns: [
      { minutes: 21, lines: ["1", "70"], transfers: 1, walkMeters: 294 },
      { minutes: 29, lines: ["1"], transfers: 0, walkMeters: 728 },
    ],
  },
  schools: {
    barneskole: {
      krets: "RANHEIM",
      navn: "Ranheim skole",
      orgnr: "975278980",
      trinnFra: 1,
      trinnTil: 7,
      elevtall: 486,
      offentlig: true,
    },
    ungdomsskole: {
      krets: "CHARLOTTENLUND",
      navn: "Charlottenlund ungdomsskole",
      orgnr: "975290158",
      trinnFra: 8,
      trinnTil: 10,
      elevtall: 449,
      offentlig: true,
    },
    videregaaende: [
      {
        navn: "Lukas videregående skole AS",
        orgnr: "973638416",
        offentlig: false,
        distanceM: 1167,
        patterns: [{ minutes: 11, lines: ["20"], transfers: 0, walkMeters: 573 }],
      },
      {
        navn: "Cissi Klein videregående skole",
        orgnr: "926694022",
        offentlig: true,
        distanceM: 2230,
        patterns: [{ minutes: 12, lines: ["20"], transfers: 0, walkMeters: 309 }],
      },
    ],
  },
};

function input(over: Partial<FaqGeneratorInput> = {}): FaqGeneratorInput {
  const pois = over.pois ?? [];
  return {
    themeId: "barn-oppvekst",
    categoryIds: ["skole", "barnehage", "lekeplass", "idrett"],
    pois,
    allPois: over.allPois ?? pois,
    center: CENTER,
    boardFacts: FACTS,
    ...over,
  };
}

function answerFor(entries: ReturnType<typeof generateCategoryFaq>, id: string): string {
  const hit = entries.find((e) => e.id === id);
  if (!hit) throw new Error(`Fant ikke svar for «${id}» — hadde: ${entries.map((e) => e.id).join(", ")}`);
  return hit.answer;
}

// ── Skolekrets: lakmustesten fra braindumpen ────────────────────────────────

describe("skolekrets", () => {
  it("navngir kretsskolene med trinn og elevtall, og lenker dem til kartet", () => {
    const entries = generateCategoryFaq(
      input({ pois: [RANHEIM_SKOLE, CHARLOTTENLUND_U] }),
    );
    const svar = answerFor(entries, "krets");
    expect(svar).toContain("[Ranheim skole](poi:nsr-975278980)");
    expect(svar).toContain("1.–7. trinn");
    expect(svar).toContain("486 elever");
    expect(svar).toContain("[Charlottenlund ungdomsskole](poi:nsr-975290158)");
    expect(svar).toContain("8.–10. trinn");
  });

  it("finner skolen på NAVN når poolen har en eldre rad enn nsr-<orgnr>", () => {
    // Ranheim-funnet 2026-08-22: boardets Ranheim skole er en legacy-UUID fra
    // en annen kilde som vant dedupen. Id-oppslaget alene ga null lenke på
    // nettopp kretssvaret — det viktigste svaret i hele FAQ-en.
    const legacy = poi({
      id: "7a3f2a06-4fa0-401a-aef5-f686ddf62988",
      name: "Ranheim skole",
      categoryId: "skole",
    });
    const svar = answerFor(generateCategoryFaq(input({ pois: [legacy] })), "krets");
    expect(svar).toContain("[Ranheim skole](poi:7a3f2a06-4fa0-401a-aef5-f686ddf62988)");
  });

  it("smelter ALDRI sammen barne- og ungdomsskolen på samme tomt", () => {
    // «Charlottenlund barneskole» og «Charlottenlund ungdomsskole» ligger på
    // samme adresse. Navnenøkkelen beholder skoleslags-ordet nettopp derfor.
    const barne = poi({ id: "c-barne", name: "Charlottenlund barneskole", categoryId: "skole" });
    const ungdom = poi({ id: "c-ungdom", name: "Charlottenlund ungdomsskole", categoryId: "skole" });
    const svar = answerFor(generateCategoryFaq(input({ pois: [barne, ungdom] })), "krets");
    expect(svar).toContain("(poi:c-ungdom)");
    expect(svar).not.toContain("(poi:c-barne)");
  });

  it("skriver navnet uten lenke når skolen ikke er på boardet", () => {
    // «Degrader, aldri sensurer»: kretsskolen er et faktum om adressen selv om
    // POI-et ikke overlevde board-filtrene.
    const svar = answerFor(generateCategoryFaq(input({ pois: [] })), "krets");
    expect(svar).toContain("Ranheim skole");
    expect(svar).not.toContain("poi:");
  });

  it("faller tilbake på kretsnavnet fra polygonene når registerfakta mangler", () => {
    // Gjelder boards provisjonert før board-fakta-steget: kretsen er hentet
    // fra kommunens polygoner og er sann uansett om NSR-oppslaget lyktes.
    const svar = answerFor(
      generateCategoryFaq(
        input({
          boardFacts: undefined,
          schoolZone: { barneskole: "RANHEIM", ungdomsskole: "CHARLOTTENLUND" },
        }),
      ),
      "krets",
    );
    expect(svar).toBe(
      "Boligen sogner til Ranheim-kretsen. Ungdomstrinnet hører til Charlottenlund-kretsen.",
    );
  });

  it("utelater spørsmålet stille når adressen ligger utenfor kretsdekningen", () => {
    // Straumen-prinsippet: «ingen data her» har definert oppførsel. Ingen
    // krets → ingen rad, ikke en rad som sier at vi ikke vet.
    const entries = generateCategoryFaq(
      input({ boardFacts: undefined, schoolZone: { barneskole: null, ungdomsskole: null } }),
    );
    expect(entries.find((e) => e.id === "krets")).toBeUndefined();
  });

  it("svarer på barnetrinnet alene når ungdomskretsen mangler", () => {
    const facts: ReportBoardFacts = {
      ...FACTS,
      schools: { ...FACTS.schools!, ungdomsskole: undefined },
    };
    const svar = answerFor(generateCategoryFaq(input({ boardFacts: facts })), "krets");
    expect(svar).toContain("Boligen sogner til");
    expect(svar).not.toContain("Ungdomstrinnet");
  });
});

// ── Videregående: nærhet, aldri sogning ─────────────────────────────────────

describe("videregående", () => {
  it("rangerer på bussetid og navngir nærmeste offentlige når den raskeste er privat", () => {
    const svar = answerFor(generateCategoryFaq(input()), "vgs-naerhet");
    expect(svar).toContain("Lukas videregående er raskest å komme til: 11 minutter med linje 20.");
    expect(svar).toContain("Cissi Klein videregående er nærmeste offentlige, 12 minutter.");
  });

  it("sier ALDRI at boligen sogner til en videregående", () => {
    // Inntaket er fylkeskommunalt og karakterbasert. `schoolZone` dekker bare
    // barne- og ungdomstrinn, så en sognings-formulering ville vært et løfte.
    const svar = answerFor(generateCategoryFaq(input()), "vgs-naerhet");
    expect(svar.toLowerCase()).not.toMatch(/sogner|krets/);
  });

  it("kaller ikke nummer to «nærmeste» når den raskeste allerede er offentlig", () => {
    // Nardo-funnet 2026-08-22: den raskeste var offentlig, og «Bybroen
    // videregående er nærmeste, 18 minutter» påsto at en skole lenger unna var
    // den nærmeste. Nummer to er et alternativ, ikke en nærhets-påstand.
    const facts: ReportBoardFacts = {
      ...FACTS,
      schools: {
        ...FACTS.schools!,
        videregaaende: [
          { ...FACTS.schools!.videregaaende[1] },
          { ...FACTS.schools!.videregaaende[0], offentlig: true, patterns: [{ minutes: 18, lines: ["1"], transfers: 0, walkMeters: 100 }] },
        ],
      },
    };
    const svar = answerFor(generateCategoryFaq(input({ boardFacts: facts })), "vgs-naerhet");
    expect(svar).toContain("Cissi Klein videregående er raskest å komme til: 12 minutter");
    expect(svar).toContain("Lukas videregående tar 18 minutter.");
    expect(svar).not.toContain("nærmeste");
  });

  it("utelates når ingen videregående har en funnet bussreise", () => {
    const facts: ReportBoardFacts = {
      ...FACTS,
      schools: { ...FACTS.schools!, videregaaende: [{ ...FACTS.schools!.videregaaende[0], patterns: [] }] },
    };
    const entries = generateCategoryFaq(input({ boardFacts: facts }));
    expect(entries.find((e) => e.id === "vgs-naerhet")).toBeUndefined();
  });

  it("lenker skolen når den er på boardet", () => {
    const lukas = poi({ id: "nsr-973638416", name: "Lukas videregående skole", categoryId: "skole" });
    const svar = answerFor(generateCategoryFaq(input({ pois: [lukas] })), "vgs-naerhet");
    expect(svar).toContain("[Lukas videregående](poi:nsr-973638416)");
  });
});

describe("cleanSchoolName", () => {
  it("fjerner selskapsform og skoleslags-halen som ingen sier høyt", () => {
    expect(cleanSchoolName("Lukas videregående skole AS")).toBe("Lukas videregående");
    expect(cleanSchoolName("Ranheim skole")).toBe("Ranheim");
    expect(cleanSchoolName("Charlottenlund ungdomsskole")).toBe("Charlottenlund ungdomsskole");
  });
});

// ── Barnehage, dagligvare, restaurant ───────────────────────────────────────

describe("barnehage-dekning", () => {
  const bhg = (id: string, name: string, walk?: number) =>
    poi({ id, name, categoryId: "barnehage", travelTime: walk !== undefined ? { walk } : undefined });

  it("leder med ANTALL og navngir de nærmeste med gangtid", () => {
    const pois = [
      bhg("b1", "Grilstad FUS barnehage", 4),
      bhg("b2", "Sjøskogbekken FUS barnehage", 7),
      bhg("b3", "Ranheimsfjæra barnehage", 9),
    ];
    const svar = answerFor(generateCategoryFaq(input({ pois })), "barnehage-dekning");
    expect(svar).toBe(
      "3 barnehager ligger innenfor 10 minutters gange, blant dem [Grilstad FUS barnehage](poi:b1) på 4 minutter og [Sjøskogbekken FUS barnehage](poi:b2) på 7 minutter.",
    );
  });

  it("bruker entall når bare én ligger i gangavstand", () => {
    const pois = [bhg("b1", "Grilstad FUS barnehage", 4), bhg("b2", "Fjern barnehage", 25)];
    expect(answerFor(generateCategoryFaq(input({ pois })), "barnehage-dekning")).toMatch(
      /^Én barnehage ligger/,
    );
  });

  it("oppgir ALDRI et minuttall som ikke er målt", () => {
    // Gangtid er precomputet i pipelinen. Mangler den, står stedet der uten
    // tall — aldri med et haversine-estimat leseren kan måle oss på.
    const pois = [bhg("b1", "Grilstad FUS barnehage"), bhg("b2", "Sjøskogbekken FUS barnehage")];
    const svar = answerFor(generateCategoryFaq(input({ pois })), "barnehage-dekning");
    expect(svar).not.toMatch(/minutter/);
    expect(svar).toContain("2 barnehager ligger i nabolaget");
  });

  it("rydder bort selskapsformen i løpende tekst", () => {
    // Registeret skriver «Grilstad Fus barnehage AS». Ingen sier det høyt.
    const pois = [bhg("b1", "Grilstad Fus barnehage AS", 4), bhg("b2", "Sjøskogbekken FUS", 7)];
    const svar = answerFor(generateCategoryFaq(input({ pois })), "barnehage-dekning");
    expect(svar).toContain("[Grilstad Fus barnehage](poi:b1)");
    expect(svar).not.toContain("AS]");
  });

  it("utelates når temaet ikke har barnehager", () => {
    const entries = generateCategoryFaq(input({ pois: [RANHEIM_SKOLE] }));
    expect(entries.find((e) => e.id === "barnehage-dekning")).toBeUndefined();
  });
});

describe("hverdagshandel", () => {
  const HVERDAG = { themeId: "hverdagsliv", categoryIds: ["shopping", "supermarket", "pharmacy"] };

  it("leder med NÆRMESTE og legger til den neste", () => {
    const pois = [
      poi({ id: "s1", name: "Extra Grilstad", categoryId: "supermarket", travelTime: { walk: 4 } }),
      poi({ id: "s2", name: "Rema 1000 Ranheimsfjæra", categoryId: "supermarket", travelTime: { walk: 9 } }),
    ];
    const svar = answerFor(generateCategoryFaq(input({ ...HVERDAG, pois })), "hverdagshandel");
    expect(svar).toBe(
      "[Extra Grilstad](poi:s1) er nærmest, 4 minutter til fots. [Rema 1000 Ranheimsfjæra](poi:s2) ligger 9 minutter unna.",
    );
  });

  it("står uten tall når gangtiden ikke er målt", () => {
    const pois = [poi({ id: "s1", name: "Extra Grilstad", categoryId: "supermarket" })];
    expect(answerFor(generateCategoryFaq(input({ ...HVERDAG, pois })), "hverdagshandel")).toBe(
      "[Extra Grilstad](poi:s1) er nærmeste dagligvare.",
    );
  });
});

describe("spisesteder", () => {
  const MAT = { themeId: "mat-drikke", categoryIds: ["restaurant", "cafe", "bar", "bakery"] };

  it("svarer med et JA og bredden, siden spørsmålet er stilt som ja/nei", () => {
    const pois = [
      poi({ id: "r1", name: "Chopsticks Horizont", categoryId: "restaurant", travelTime: { walk: 6 } }),
      poi({ id: "r2", name: "Piccoli Fratelli", categoryId: "restaurant", travelTime: { walk: 8 } }),
      poi({ id: "r3", name: "Kafé Grilstad", categoryId: "cafe", travelTime: { walk: 3 } }),
    ];
    const svar = answerFor(generateCategoryFaq(input({ ...MAT, pois })), "spisesteder");
    expect(svar).toMatch(/^Ja — 3 spisesteder ligger innenfor 15 minutters gange/);
  });

  it("navngir det nærmeste uten å love bredde når det bare er ett", () => {
    const pois = [
      poi({ id: "r1", name: "Chopsticks Horizont", categoryId: "restaurant", travelTime: { walk: 6 } }),
    ];
    expect(answerFor(generateCategoryFaq(input({ ...MAT, pois })), "spisesteder")).toBe(
      "Nærmeste spisested er [Chopsticks Horizont](poi:r1), 6 minutter til fots.",
    );
  });
});

// ── Transport ───────────────────────────────────────────────────────────────

describe("transport", () => {
  const TRANSPORT = { themeId: "transport", categoryIds: ["bus", "train", "tram", "bike"] };

  it("oppgir holdeplassen i avrundede METER, ikke i estimert gangtid", () => {
    const svar = answerFor(
      generateCategoryFaq(
        input({ ...TRANSPORT, pois: [STRINDFJORDVEGEN, GRILSTADKLEIVA] }),
      ),
      "naermeste-holdeplass",
    );
    expect(svar).toBe(
      "[Strindfjordvegen](poi:entur-nsr-stopplace-60260) ligger 30 meter fra boligen. [Grilstadkleiva](poi:entur-nsr-stopplace-42157) er 300 meter unna.",
    );
  });

  it("kobler holdeplassen på enturStopplaceId, ikke på POI-id-en", () => {
    // POI-id-en er en fri streng (`entur-NSR-StopPlace-60260`), og
    // kolon→bindestrek-omskrivingen i generatePoiId er ingen kontrakt.
    const svar = answerFor(
      generateCategoryFaq(input({ ...TRANSPORT, pois: [STRINDFJORDVEGEN] })),
      "naermeste-holdeplass",
    );
    expect(svar).toContain("poi:entur-nsr-stopplace-60260");
  });

  it("skiller retningene fra hverandre — linje 20 er to tilbud, ikke ett", () => {
    const svar = answerFor(
      generateCategoryFaq(input({ ...TRANSPORT, pois: [STRINDFJORDVEGEN, GRILSTADKLEIVA] })),
      "linjer",
    );
    expect(svar).toContain("linje 20 mot Grillstad og linje 20 mot Romolslia");
    expect(svar).toContain("gir i tillegg linje 1");
  });

  it("dobler ikke punktumet når destinasjonsskiltet er forkortet", () => {
    // AtB skilter «Romolslia via Strindh.-Ladeham.» — et påsatt setningspunktum
    // ga «Ladeham..». Forkortelsespunktumet gjør begge jobbene.
    const facts: ReportBoardFacts = {
      ...FACTS,
      stops: [
        {
          ...FACTS.stops[0],
          directions: [
            {
              quayId: "q1",
              destinations: ["Romolslia via Strindh.-Ladeham."],
              lines: ["20"],
            },
          ],
        },
      ],
    };
    const svar = answerFor(
      generateCategoryFaq(input({ ...TRANSPORT, boardFacts: facts })),
      "linjer",
    );
    expect(svar).not.toContain("..");
    expect(svar.endsWith("Ladeham.")).toBe(true);
  });

  it("gjentar ikke linjer fra en holdeplass til den neste", () => {
    const facts: ReportBoardFacts = {
      ...FACTS,
      stops: [
        FACTS.stops[0],
        { ...FACTS.stops[1], directions: [{ quayId: "q", destinations: ["Byen"], lines: ["20"] }] },
      ],
    };
    const svar = answerFor(
      generateCategoryFaq(input({ ...TRANSPORT, boardFacts: facts })),
      "linjer",
    );
    expect(svar).not.toContain("i tillegg");
  });

  it("oppgir raskeste reise til sentrum og nevner en direkte forbindelse", () => {
    const svar = answerFor(generateCategoryFaq(input(TRANSPORT)), "til-sentrum");
    expect(svar).toBe(
      "Til Trondheim S tar det 21 minutter med linje 1 og 70. Linje 1 går direkte på 29 minutter.",
    );
  });

  it("nevner ingen direkte forbindelse når den raskeste ALT er direkte", () => {
    const facts: ReportBoardFacts = {
      ...FACTS,
      cityCentre: {
        name: "Trondheim S",
        patterns: [{ minutes: 18, lines: ["1"], transfers: 0, walkMeters: 200 }],
      },
    };
    const svar = answerFor(
      generateCategoryFaq(input({ ...TRANSPORT, boardFacts: facts })),
      "til-sentrum",
    );
    expect(svar).toBe("Til Trondheim S tar det 18 minutter med linje 1.");
  });

  it("gir ingen transport-svar i det hele tatt når Entur-steget feilet", () => {
    const entries = generateCategoryFaq(input({ ...TRANSPORT, boardFacts: undefined }));
    expect(entries).toEqual([]);
  });
});

// ── To-lags-flettingen ──────────────────────────────────────────────────────

describe("kuratert lag", () => {
  it("overstyrer det deterministiske svaret på samme id, uten å bytte plass", () => {
    const entries = generateCategoryFaq(
      input({
        pois: [RANHEIM_SKOLE],
        curated: [{ id: "krets", svar: "Ungene på Grilstad går på Ranheim skole, ti minutter unna." }],
      }),
    );
    expect(entries[0].id).toBe("krets");
    expect(entries[0].answer).toBe("Ungene på Grilstad går på Ranheim skole, ti minutter unna.");
    expect(entries[0].source).toBe("curated");
    // Spørsmålet arves fra malverket når kurator ikke omformulerer det
    expect(entries[0].question).toBe("Hvilken skolekrets sogner boligen til?");
  });

  it("lar kurator omformulere spørsmålet også", () => {
    const entries = generateCategoryFaq(
      input({ curated: [{ id: "krets", spørsmål: "Hvor går ungene på skole?", svar: "På Ranheim." }] }),
    );
    expect(entries[0].question).toBe("Hvor går ungene på skole?");
  });

  it("svarer der det deterministiske laget ikke klarte det", () => {
    // Hele poenget med det kuraterte laget: strøket vet noe registrene ikke har.
    const entries = generateCategoryFaq(
      input({
        boardFacts: undefined,
        schoolZone: { barneskole: null, ungdomsskole: null },
        curated: [{ id: "krets", svar: "Boligen sogner til Ranheim skole." }],
      }),
    );
    expect(entries.map((e) => e.id)).toEqual(["krets"]);
    expect(entries[0].source).toBe("curated");
  });

  it("legger kurators egne spørsmål til på slutten", () => {
    const entries = generateCategoryFaq(
      input({
        pois: [RANHEIM_SKOLE],
        curated: [{ id: "skolevei", spørsmål: "Hvordan er skoleveien?", svar: "Uten kryssing." }],
      }),
    );
    expect(entries.map((e) => e.id)).toEqual(["krets", "vgs-naerhet", "skolevei"]);
  });

  it("dropper et kuratert tillegg uten spørsmålstekst — et svar uten spørsmål er hjemløst", () => {
    const entries = generateCategoryFaq(
      input({ pois: [RANHEIM_SKOLE], curated: [{ id: "skolevei", svar: "Uten kryssing." }] }),
    );
    expect(entries.find((e) => e.id === "skolevei")).toBeUndefined();
  });

  it("merker kilden internt så to-lags-modellen kan evalueres", () => {
    const entries = generateCategoryFaq(
      input({ pois: [RANHEIM_SKOLE], curated: [{ id: "krets", svar: "Kuratert." }] }),
    );
    expect(entries.map((e) => e.source)).toEqual(["curated", "deterministic"]);
  });
});

// ── Tema-spørsmålene (minimum fem per tema, 2026-08-23) ─────────────────────

/** Man–fre + helg, Googles engelske format med U+202F/U+2009 — som i cachen. */
function tider(hverdag: string, lordag = "Saturday: Closed", sondag = "Sunday: Closed") {
  return {
    weekday_text: [
      `Monday: ${hverdag}`,
      `Tuesday: ${hverdag}`,
      `Wednesday: ${hverdag}`,
      `Thursday: ${hverdag}`,
      `Friday: ${hverdag}`,
      lordag,
      sondag,
    ],
  };
}

describe("tema-spørsmålene", () => {
  it("uten-bil navngir ærend-typene som er dekket, aldri de som mangler", () => {
    const entries = generateCategoryFaq(
      input({
        themeId: "hverdagsliv",
        categoryIds: ["supermarket", "pharmacy", "post", "haircare", "shopping"],
        pois: [
          poi({ id: "s1", name: "Extra Grilstad", categoryId: "supermarket", travelTime: { walk: 3 } }),
          poi({ id: "a1", name: "Vitusapotek", categoryId: "pharmacy", travelTime: { walk: 3 } }),
          poi({ id: "p1", name: "Post i Butikk", categoryId: "post", travelTime: { walk: 3 } }),
          poi({ id: "f1", name: "Ranheim Frisør", categoryId: "haircare", travelTime: { walk: 8 } }),
          poi({ id: "k1", name: "Grilstad mall", categoryId: "shopping", travelTime: { walk: 3 } }),
        ],
      }),
    );
    const svar = answerFor(entries, "uten-bil");
    expect(svar).toBe(
      "Hverdagsærendene er i gangavstand: dagligvare, apotek, post, frisør og kjøpesenter ligger alle innenfor 10 minutter til fots.",
    );
  });

  it("uten-bil med bare to dekket sier «deler av», og påstår ingenting om resten", () => {
    const entries = generateCategoryFaq(
      input({
        themeId: "hverdagsliv",
        categoryIds: ["supermarket", "pharmacy"],
        pois: [
          poi({ id: "s1", name: "Extra", categoryId: "supermarket", travelTime: { walk: 3 } }),
          poi({ id: "a1", name: "Apotek 1", categoryId: "pharmacy", travelTime: { walk: 9 } }),
          // Frisøren finnes, men utenfor radiusen — skal ikke telle.
          poi({ id: "f1", name: "Klipp", categoryId: "haircare", travelTime: { walk: 25 } }),
        ],
      }),
    );
    const svar = answerFor(entries, "uten-bil");
    expect(svar).toContain("Deler av hverdagen");
    expect(svar).toContain("dagligvare og apotek");
    expect(svar).not.toMatch(/krever|mangler|ikke/);
  });

  it("uten-bil utelates når bare én ærend-type er dekket", () => {
    const entries = generateCategoryFaq(
      input({
        themeId: "hverdagsliv",
        categoryIds: ["supermarket"],
        pois: [poi({ id: "s1", name: "Extra", categoryId: "supermarket", travelTime: { walk: 3 } })],
      }),
    );
    expect(entries.find((e) => e.id === "uten-bil")).toBeUndefined();
  });

  it("lekeplass leder med nærmeste og teller resten innenfor radiusen", () => {
    const entries = generateCategoryFaq(
      input({
        themeId: "barn-oppvekst",
        categoryIds: ["lekeplass"],
        pois: [
          poi({ id: "l1", name: "Grillstadfjæra lek", categoryId: "lekeplass", travelTime: { walk: 3 } }),
          poi({ id: "l2", name: "Turområdet lek", categoryId: "lekeplass", travelTime: { walk: 4 } }),
          poi({ id: "l3", name: "Bukken bruses veg lek", categoryId: "lekeplass", travelTime: { walk: 9 } }),
          poi({ id: "l4", name: "Hulderveien lek", categoryId: "lekeplass", travelTime: { walk: 15 } }),
        ],
      }),
    );
    const svar = answerFor(entries, "lekeplass");
    expect(svar).toContain("[Grillstadfjæra lek](poi:l1) er nærmeste lekeplass, 3 minutter unna");
    expect(svar).toContain("2 til ligger innenfor 10 minutters gange");
  });

  it("kafé bærer åpningstidene når hverdagene er entydige", () => {
    const entries = generateCategoryFaq(
      input({
        themeId: "mat-drikke",
        categoryIds: ["cafe"],
        pois: [
          poi({
            id: "c1",
            name: "Flipper Kafe",
            categoryId: "cafe",
            travelTime: { walk: 5 },
            openingHoursJson: tider("11:00 AM – 11:00 PM"),
          }),
        ],
      }),
    );
    expect(answerFor(entries, "kafe")).toBe(
      "[Flipper Kafe](poi:c1) ligger 5 minutter til fots, med åpent 11–23 på hverdager.",
    );
  });

  it("søndagsåpent lister bare stedene tidene VET er åpne", () => {
    const entries = generateCategoryFaq(
      input({
        themeId: "mat-drikke",
        categoryIds: ["restaurant", "cafe"],
        pois: [
          poi({
            id: "c1",
            name: "Flipper Kafe",
            categoryId: "cafe",
            travelTime: { walk: 5 },
            openingHoursJson: tider("11:00 AM – 11:00 PM", "Saturday: Closed", "Sunday: 11:00 AM – 5:00 PM"),
          }),
          // Har tider, men søndagsstengt — skal ikke listes.
          poi({
            id: "r1",
            name: "Pizzabakeren",
            categoryId: "restaurant",
            travelTime: { walk: 3 },
            openingHoursJson: tider("2:00 PM – 10:00 PM"),
          }),
          // Uten cachede tider — påstås ingenting om.
          poi({ id: "r2", name: "Pizzapizza", categoryId: "restaurant", travelTime: { walk: 16 } }),
        ],
      }),
    );
    const svar = answerFor(entries, "sondagsapent");
    expect(svar).toBe("På søndager holder [Flipper Kafe](poi:c1) (11–17) åpent.");
  });

  it("søndagsåpent utelates når ingen cachede tider viser søndag åpent", () => {
    const entries = generateCategoryFaq(
      input({
        themeId: "mat-drikke",
        categoryIds: ["restaurant"],
        pois: [poi({ id: "r1", name: "Pizzabakeren", categoryId: "restaurant", travelTime: { walk: 3 } })],
      }),
    );
    expect(entries.find((e) => e.id === "sondagsapent")).toBeUndefined();
  });

  it("trene tidlig/sent svarer med ytterpunktene fra flere sentre", () => {
    const entries = generateCategoryFaq(
      input({
        themeId: "trening-aktivitet",
        categoryIds: ["gym"],
        pois: [
          poi({
            id: "g1",
            name: "Impulse Treningssenter",
            categoryId: "gym",
            travelTime: { walk: 2 },
            openingHoursJson: tider("5:00 AM – 11:00 PM"),
          }),
          poi({
            id: "g2",
            name: "3T-Ranheim",
            categoryId: "gym",
            travelTime: { walk: 19 },
            openingHoursJson: tider("5:00 AM – 12:00 AM"),
          }),
        ],
      }),
    );
    const svar = answerFor(entries, "trene-tidlig-sent");
    expect(svar).toBe(
      "Både tidlig og sent: [Impulse Treningssenter](poi:g1) åpner 05 på hverdager, og [3T-Ranheim](poi:g2) stenger først ved midnatt.",
    );
  });

  it("trene tidlig/sent med ett senter som dekker begge, i ett", () => {
    const entries = generateCategoryFaq(
      input({
        themeId: "trening-aktivitet",
        categoryIds: ["gym"],
        pois: [
          poi({
            id: "g1",
            name: "Impulse Grilstad",
            categoryId: "gym",
            travelTime: { walk: 3 },
            openingHoursJson: tider("5:00 AM – 12:00 AM"),
          }),
        ],
      }),
    );
    expect(answerFor(entries, "trene-tidlig-sent")).toBe(
      "Både tidlig og sent: [Impulse Grilstad](poi:g1) holder åpent 05–24 på hverdager.",
    );
  });

  it("lading scoper påstanden til kartet når nærmeste er utenfor gangavstand", () => {
    const entries = generateCategoryFaq(
      input({
        themeId: "transport",
        categoryIds: ["charging_station"],
        pois: [
          poi({ id: "ch1", name: "Recharge Charging Station", categoryId: "charging_station", travelTime: { walk: 27 } }),
        ],
      }),
    );
    const svar = answerFor(entries, "lading");
    expect(svar).toContain("på kartet");
    expect(svar).toContain("27 minutter");
    // Aldri en negativ påstand poolen ikke kan bære.
    expect(svar).not.toMatch(/ingen|finnes ikke/i);
  });

  it("tog svarer med stasjonene, nærmeste først", () => {
    const entries = generateCategoryFaq(
      input({
        themeId: "transport",
        categoryIds: ["train"],
        pois: [
          poi({ id: "t1", name: "Ranheim stasjon", categoryId: "train", travelTime: { walk: 24 } }),
          poi({ id: "t2", name: "Rotvoll stasjon", categoryId: "train", travelTime: { walk: 20 } }),
        ],
      }),
    );
    expect(answerFor(entries, "tog")).toBe(
      "[Rotvoll stasjon](poi:t2) ligger 20 minutter til fots, og [Ranheim stasjon](poi:t1) 24 minutter.",
    );
  });

  it("ett minutt skrives ut — aldri «1 minutter»", () => {
    const entries = generateCategoryFaq(
      input({
        themeId: "natur-friluftsliv",
        categoryIds: ["park"],
        pois: [poi({ id: "p1", name: "Sjøparken", categoryId: "park", travelTime: { walk: 1 } })],
      }),
    );
    expect(answerFor(entries, "gronntomrade")).toBe(
      "[Sjøparken](poi:p1) er nærmeste grøntområde, ett minutt til fots.",
    );
  });

  it("kuratert-eneste spørsmål (turstier, marka, idrettslag) vises ALDRI uten kuratert svar", () => {
    const entries = generateCategoryFaq(
      input({
        themeId: "natur-friluftsliv",
        categoryIds: ["park", "outdoor", "badeplass"],
        pois: [
          poi({ id: "o1", name: "Ladestien", categoryId: "outdoor", travelTime: { walk: 15 } }),
        ],
      }),
    );
    expect(entries.find((e) => e.id === "turstier")).toBeUndefined();
    expect(entries.find((e) => e.id === "marka")).toBeUndefined();
  });

  it("kuratert svar på en tema-spørsmåls-id slotter inn på katalogens plass", () => {
    const entries = generateCategoryFaq(
      input({
        themeId: "natur-friluftsliv",
        categoryIds: ["park", "outdoor"],
        pois: [poi({ id: "p1", name: "Sjøparken", categoryId: "park", travelTime: { walk: 1 } })],
        curated: [{ id: "turstier", svar: "Turstien langs fjæra binder sammen hele strandlinjen." }],
      }),
    );
    const ids = entries.map((e) => e.id);
    // Katalogrekkefølgen: gronntomrade før turstier — kuratert bytter ikke plass.
    expect(ids.indexOf("gronntomrade")).toBeLessThan(ids.indexOf("turstier"));
    const tursti = entries.find((e) => e.id === "turstier")!;
    expect(tursti.source).toBe("curated");
    // Katalogens spørsmålstekst brukes når kurator ikke har egen.
    expect(tursti.question).toBe("Hvor går turstiene?");
  });
});

// ── Setningsmal-vernet ──────────────────────────────────────────────────────

describe("svarformene", () => {
  it("åpner ULIKT på tvers av kategorier — ingen felles mal", () => {
    // 41 av 158 POI-tekster åpnet likt sist en felles form oppsto av seg selv.
    // Malene her er ulike i FORM, ikke bare i innhold, og det skal de fortsette
    // å være: sogning, antall, nærmeste, ja/nei, avstand.
    const svar = [
      answerFor(generateCategoryFaq(input({ pois: [RANHEIM_SKOLE] })), "krets"),
      answerFor(
        generateCategoryFaq(
          input({
            pois: [poi({ id: "b1", name: "Grilstad FUS", categoryId: "barnehage", travelTime: { walk: 4 } })],
          }),
        ),
        "barnehage-dekning",
      ),
      answerFor(
        generateCategoryFaq(
          input({
            themeId: "hverdagsliv",
            categoryIds: ["supermarket"],
            pois: [poi({ id: "s1", name: "Extra Grilstad", categoryId: "supermarket", travelTime: { walk: 4 } })],
          }),
        ),
        "hverdagshandel",
      ),
      answerFor(
        generateCategoryFaq(
          input({
            themeId: "mat-drikke",
            categoryIds: ["restaurant"],
            pois: [
              poi({ id: "r1", name: "Chopsticks", categoryId: "restaurant", travelTime: { walk: 6 } }),
              poi({ id: "r2", name: "Piccoli", categoryId: "restaurant", travelTime: { walk: 8 } }),
            ],
          }),
        ),
        "spisesteder",
      ),
      answerFor(
        generateCategoryFaq(input({ themeId: "transport", categoryIds: ["bus"] })),
        "naermeste-holdeplass",
      ),
      answerFor(
        generateCategoryFaq(
          input({
            themeId: "hverdagsliv",
            categoryIds: ["supermarket", "pharmacy", "post", "haircare"],
            pois: [
              poi({ id: "s1", name: "Extra", categoryId: "supermarket", travelTime: { walk: 3 } }),
              poi({ id: "a1", name: "Vitusapotek", categoryId: "pharmacy", travelTime: { walk: 3 } }),
              poi({ id: "p1", name: "Posten", categoryId: "post", travelTime: { walk: 3 } }),
              poi({ id: "f1", name: "Frisøren", categoryId: "haircare", travelTime: { walk: 8 } }),
            ],
          }),
        ),
        "uten-bil",
      ),
      answerFor(
        generateCategoryFaq(
          input({
            themeId: "mat-drikke",
            categoryIds: ["cafe"],
            pois: [
              poi({
                id: "c1",
                name: "Kafeen",
                categoryId: "cafe",
                travelTime: { walk: 5 },
                openingHoursJson: tider("11:00 AM – 11:00 PM", "Saturday: Closed", "Sunday: 11:00 AM – 5:00 PM"),
              }),
            ],
          }),
        ),
        "sondagsapent",
      ),
      answerFor(
        generateCategoryFaq(
          input({
            themeId: "trening-aktivitet",
            categoryIds: ["gym"],
            pois: [
              poi({
                id: "g1",
                name: "Impulse",
                categoryId: "gym",
                travelTime: { walk: 3 },
                openingHoursJson: tider("5:00 AM – 12:00 AM"),
              }),
            ],
          }),
        ),
        "trene-tidlig-sent",
      ),
    ];

    // Første ORD skal ikke gjenta seg — det er der en felles mal først viser seg.
    const åpninger = svar.map((s) => s.replace(/^\[/, "").split(/[\s\]]/)[0].toLowerCase());
    expect(new Set(åpninger).size).toBe(åpninger.length);
  });

  it("hvert svar slutter med punktum og starter med stor bokstav eller en lenke", () => {
    const entries = generateCategoryFaq(input({ pois: [RANHEIM_SKOLE, CHARLOTTENLUND_U] }));
    for (const e of entries) {
      expect(e.answer.trim().endsWith("."), e.id).toBe(true);
      expect(/^[A-ZÆØÅ0-9[]/.test(e.answer), e.id).toBe(true);
    }
  });
});

// ── Global nabolags-FAQ ─────────────────────────────────────────────────────

describe("generateGlobalFaq", () => {
  const THEMES = [
    { id: "transport", label: "Transport & Mobilitet" },
    { id: "mat-drikke", label: "Mat & Drikke" },
  ];

  it("svarer på reisen til byen og lenker inn i transport-kategorien", () => {
    const entries = generateGlobalFaq({ boardFacts: FACTS, themes: THEMES });
    expect(entries).toHaveLength(1);
    expect(entries[0].id).toBe("til-byen");
    expect(entries[0].answer).toContain("Til Trondheim S tar det 21 minutter");
    expect(entries[0].answer).toContain("[Transport & Mobilitet](category:transport)");
  });

  it("dropper kategorilenken når temaet ikke nådde boardet", () => {
    const entries = generateGlobalFaq({ boardFacts: FACTS, themes: [THEMES[1]] });
    expect(entries[0].answer).not.toContain("category:");
  });

  it("setter det kuraterte karakteristikk-svaret først", () => {
    const entries = generateGlobalFaq({
      boardFacts: FACTS,
      themes: THEMES,
      curated: [
        {
          id: "karakteristikk",
          spørsmål: "Hva kjennetegner området?",
          svar: "Sjøkanten og Ladestien.",
        },
      ],
    });
    expect(entries.map((e) => e.id)).toEqual(["karakteristikk", "til-byen"]);
    expect(entries[0].source).toBe("curated");
  });

  it("lar kurator overstyre reise-svaret uten å få det duplisert", () => {
    const entries = generateGlobalFaq({
      boardFacts: FACTS,
      themes: THEMES,
      curated: [{ id: "til-byen", svar: "Bussen går hvert tiende minutt." }],
    });
    expect(entries).toHaveLength(1);
    expect(entries[0].source).toBe("curated");
    expect(entries[0].question).toBe("Hvordan kommer jeg meg til byen?");
  });

  it("gir tom liste når verken kuratert innhold eller transittfakta finnes", () => {
    expect(generateGlobalFaq({ themes: THEMES })).toEqual([]);
  });
});
