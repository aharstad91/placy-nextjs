#!/usr/bin/env npx tsx
import "./load-env";

import { readFile, writeFile } from "node:fs/promises";

import { adaptBoardData } from "@/components/variants/report/board/board-data";
import { transformToReportData } from "@/components/variants/report/report-data";
import { executeBoardTool } from "@/lib/realtime/board-tools";
import type { BoardState } from "@/components/variants/report/board/board-state";
import { buildProductionAssistantSource } from "@/lib/live/production-board";
import type { LiveTransportClient } from "@/lib/realtime/live-transport";
import { getProductFromSupabaseV2 } from "@/lib/supabase/v2-queries";

const SCENARIOS_PATH = "data/demo/nyhavna-lokal/conversations.json";
const RECEIPT_PATH =
  "docs/research/nyhavna-lokal-demo/audited/2026-09-19-standard-scenario-evaluation.json";

interface ScenarioQuestion {
  id: string;
  text: string;
  expectation: string;
}

interface ScenarioGroup {
  id: string;
  questions: ScenarioQuestion[];
}

interface Check {
  label: string;
  passed: boolean;
  evidence: string;
}

type ScenarioStatus = "passed" | "failed" | "manual_pending";
type Rule = () => Check[] | Promise<Check[]>;

const compact = (value: unknown) => JSON.stringify(value).replace(/\s+/g, " ").slice(0, 700);
const norwegian = (value: string) => value.toLocaleLowerCase("nb");

function textOf(source: ReturnType<typeof buildProductionAssistantSource>) {
  const facts = source.board.publishedKnowledge ?? [];
  const faq = [
    ...(source.board.globalFaq ?? []),
    ...source.board.categories.flatMap((category) => category.editorial?.faq ?? []),
  ];
  return {
    facts,
    faq,
    all: [
      source.board.home.heroIntro,
      source.board.areaIntro,
      ...facts.map((fact) => `${fact.subjectName ?? ""} ${fact.topic} ${fact.factText}`),
      ...faq.flatMap((entry) => [entry.question, entry.answer]),
      ...source.board.categories.flatMap((category) => [category.label, category.lead, category.body, category.editorial?.intro, category.editorial?.body]),
    ].filter((value): value is string => Boolean(value)).join("\n"),
  };
}

function includes(text: string, ...needles: string[]): Check {
  const lowered = norwegian(text);
  const missing = needles.filter((needle) => !lowered.includes(norwegian(needle)));
  return {
    label: `Inneholder ${needles.join(", ")}`,
    passed: missing.length === 0,
    evidence: missing.length ? `Mangler: ${missing.join(", ")}` : needles.join(" | "),
  };
}

function excludes(text: string, ...needles: string[]): Check {
  const lowered = norwegian(text);
  const found = needles.filter((needle) => lowered.includes(norwegian(needle)));
  return {
    label: `Utelater ${needles.join(", ")}`,
    passed: found.length === 0,
    evidence: found.length ? `Fant: ${found.join(", ")}` : "Ingen av de avviste uttrykkene i publisert innhold.",
  };
}

function hasPlace(source: ReturnType<typeof buildProductionAssistantSource>, name: string): Check {
  const poi = source.board.categories.flatMap((category) => category.pois)
    .find((candidate) => norwegian(candidate.name) === norwegian(name));
  return {
    label: `${name} finnes i standardboardets POI-pool`,
    passed: Boolean(poi),
    evidence: poi ? `${poi.id} · ${poi.raw.category.name}` : "Ikke funnet.",
  };
}

function manual(reason: string): Check {
  return { label: "Krever fysisk/manuell test", passed: false, evidence: reason };
}

function toolNames(source: ReturnType<typeof buildProductionAssistantSource>) {
  return new Set(source.tools.map((tool) => tool.name));
}

function mockBoardState(): BoardState {
  return {
    phase: "default",
    activeCategoryId: null,
    activePOIId: null,
    introPlaying: false,
    exploreOpen: false,
    highlightedPoiIds: [],
    travelMode: "walk",
    showContours: false,
    exploreSuppressed: false,
  };
}

async function main() {
  const project = await getProductFromSupabaseV2("nyhavna-utvikling", "nyhavna", "report");
  if (!project) throw new Error("Fant ikke standardboardet nyhavna-utvikling/nyhavna.");
  const board = adaptBoardData(transformToReportData(project));
  const fakeTransport: LiveTransportClient = {
    departures: async (stopPlaceId) => ({
      stopPlace: { id: stopPlaceId, name: "Dora" },
      fetchedAt: "2026-09-19T10:30:00.000Z",
      quays: [{
        quayId: "NSR:Quay:nyhavna",
        departures: [{
          departureTime: "2026-09-19T10:36:00+02:00",
          expectedDepartureTime: "2026-09-19T10:35:00+02:00",
          actualDepartureTime: "2026-09-19T10:36:00+02:00",
          isRealtime: true,
          destination: "Sentrum",
          lineCode: "2",
          transportMode: "bus",
        }],
      }],
      departures: [],
    }),
    trip: async (_from, to) => ({
      fetchedAt: "2026-09-19T10:30:00.000Z",
      trips: [{
        duration: 900,
        walkDistance: 250,
        legs: [{ mode: "foot", distance: 250, duration: 180, from: "Nyhavna", to: `${to.lat},${to.lng}` }],
      }],
    }),
  };
  const source = buildProductionAssistantSource(board, fakeTransport);
  const material = textOf(source);
  const allText = material.all;
  const conversation = () => source.createConversation();
  const openAndReturn = (themeId: string): Check[] => {
    const session = conversation();
    const opened = session.execute("set_interests", { interests: [themeId], theme_ids: [themeId] });
    const detour = session.execute("note_detour", { about: "kollektiv" });
    const returned = session.execute("return_to_tour", {});
    const transcript = compact({ opened: opened.result, detour: detour.result, returned: returned.result });
    return [{
      label: `Avbrudd går tilbake til ${themeId}`,
      passed: transcript.includes(`\"theme_id\":\"${themeId}\"`) && compact(detour.result).includes(themeId),
      evidence: transcript,
    }];
  };
  const search = (query: string, expectedName: string): Check => {
    const output = conversation().execute("find_places", { query }) as { result: { places?: Array<{ name?: string }> } };
    const places = output.result.places ?? [];
    return {
      label: `Søk etter ${query} finner ${expectedName}`,
      passed: places.some((place) => norwegian(place.name ?? "") === norwegian(expectedName)),
      evidence: compact(output.result),
    };
  };
  const unknownId = (): Check => {
    const output = conversation().execute("get_place_facts", { poi_id: "not-a-board-poi" }) as { result: { error?: string } };
    return {
      label: "Ukjent POI-ID avvises av kunnskapsverktøyet",
      passed: Boolean(output.result.error?.includes("Ukjent sted")),
      evidence: compact(output.result),
    };
  };
  const transportStop = source.board.categories.flatMap((category) => category.pois)
    .find((poi) => Boolean(poi.raw.enturStopplaceId));
  const liveDeparture = async (): Promise<Check[]> => {
    if (!transportStop?.raw.enturStopplaceId) return [{ label: "Boardet har et Entur-validert stopp", passed: false, evidence: "Ingen POI med enturStopplaceId." }];
    const result = await conversation().execute("get_live_departures", { poi_id: String(transportStop.id) });
    return [{
      label: "Levende Entur-oppslag bruker boardvalidert stopp",
      passed: compact(result.result).includes("2026-09-19T10:30:00.000Z") && compact(result.result).includes("Sentrum"),
      evidence: compact({ poi: transportStop.name, id: transportStop.id, entur: transportStop.raw.enturStopplaceId, result: result.result }),
    }];
  };
  const mapUnknownId = (): Check => {
    const actions: unknown[] = [];
    const result = executeBoardTool("show_place", { poi_id: "not-a-board-poi" }, {
      data: source.board,
      state: mockBoardState(),
      dispatch: (action) => { actions.push(action); },
    });
    return {
      label: "Ukjent POI-ID endrer ikke karttilstand",
      passed: "error" in result && actions.length === 0,
      evidence: compact({ result, actions }),
    };
  };
  const mapSelection = (): Check => {
    const clicked = conversation().onMapSelection("place", "not-a-board-poi");
    return {
      label: "Ukjent kartklikk lager ikke falsk samtalehandling",
      passed: clicked === null,
      evidence: String(clicked),
    };
  };

  const manualScenarios = new Map<string, string>([
    ["drift-samtykke", "Bekreft i nettleseren at dialogen vises før mikrofon- og OpenAI-sesjon startes."],
    ["drift-mikrofon", "Avvis mikrofon i nettleseren og kontroller gjenopprettingsmeldingen på telefon."],
    ["drift-stemme", "Fysisk samtale på telefon: norsk uttale, stabil stemme, avbrudd og kartutfall."],
    ["drift-rate-limit", "Krever kontrollert sesjons-/kostnadsgrense i integrert miljø."],
    ["kart-flere-steder", "Krever faktisk klientkvittering fra highlight_places, ikke bare serverkontrakt."],
    ["kart-ett-sted", "Krever faktisk detaljpanel og klientkvittering fra show_place."],
    ["samtale-avbrudd", "Automatisk serverkontrakt testes, men stemmeavbrudd må prøves fysisk."],
    ["kart-klikk", "Automatisk kartklikk-kontrakt testes, men UI-integrasjonen må prøves i nettleser."],
  ]);

  const rules: Record<string, Rule> = {
    "inngang-hilsen": () => [includes(source.voiceInstructions, "Nyhavna", "AI-guide")],
    "inngang-planer": () => [includes(allText, "Transittkaia", "planlagt")],
    "inngang-dagens-omrade": () => [hasPlace(source, "Dora Kaffebar"), hasPlace(source, "Snurr Nyhavna")],
    "inngang-identitet": () => [includes(source.voiceInstructions, "ikke megler")],
    "inngang-adresse-stoy": () => [
      excludes(source.backendInstructions, "Kobbes gate 2"),
      (() => {
        const result = conversation().execute("find_places", { query: "Dora Kaffebar" }) as { result: unknown };
        return { label: "Vanlig stedsøk sender ikke adresse", passed: !compact(result.result).includes("Kobbes gate"), evidence: compact(result.result) };
      })(),
    ],

    "bydel-formal": () => [includes(allText, "bolig", "kultur", "grønt")],
    "bydel-transittkaia": () => [hasPlace(source, "Transittkaia"), search("Transittkaia", "Transittkaia")],
    "bydel-kullkranpiren": () => [hasPlace(source, "Kullkranpiren"), search("Kullkranpiren", "Kullkranpiren")],
    "bydel-strandveikaia": () => [hasPlace(source, "Strandveikaia"), search("Strandveikaia", "Strandveikaia")],
    "bydel-ladehammerkaia": () => [hasPlace(source, "Ladehammerkaia"), search("Ladehammerkaia", "Ladehammerkaia")],
    "bydel-bunkerkvartalet": () => [hasPlace(source, "Bunkerkvartalet"), search("Bunkerkvartalet", "Bunkerkvartalet")],
    "bydel-folg-planene": () => [includes(allText, "nyhetsbrev")],

    "hverdag-dagligvarer": () => [hasPlace(source, "MENY Solsiden"), hasPlace(source, "KIWI Lilleby")],
    "oppvekst-skoler": () => [includes(allText, "Lilleby", "Rosenborg"), includes(allText, "må avklares")],
    "oppvekst-skolevei": () => [includes(allText, "trygghet", "ikke vurdert")],
    "oppvekst-barnehager": () => [includes(allText, "Nedre Elvehavn", "Voldsminde"), excludes(allText, "ledig plass")],
    "oppvekst-ledig-plass": () => [excludes(allText, "ledig plass nå")],

    "servering-kafe": () => [hasPlace(source, "Dora Kaffebar"), hasPlace(source, "Snurr Nyhavna")],
    "servering-restauranter": () => [hasPlace(source, "Ladejarlen"), hasPlace(source, "Nyhavna BistroBar")],
    "servering-menyer": () => [includes(allText, "åpningstider", "egne sider")],
    "opplevelser-familie": () => [hasPlace(source, "Dora 1 Bowling"), hasPlace(source, "Nyhavna Padel"), hasPlace(source, "Ladestien")],
    "natur-ladestien": () => [hasPlace(source, "Ladestien"), search("Ladestien", "Ladestien")],

    "transport-holdeplass": () => [search("Losgata", "Losgata bussholdeplass"), search("Dora", "Dora")],
    "transport-sentrum-live": async () => {
      const destination = source.board.categories.flatMap((category) => category.pois).find((poi) => norwegian(poi.name).includes("solsiden"));
      if (!destination) return [{ label: "Boardet har et konkret Entur-mål", passed: false, evidence: "Fant ikke Solsiden." }];
      const result = await conversation().execute("plan_live_transit_trip", { destination_poi_id: String(destination.id) });
      return [{ label: "Reiseplan bruker tidsstemplet Entur-resultat", passed: compact(result.result).includes("2026-09-19T10:30:00.000Z"), evidence: compact(result.result) }];
    },
    "transport-avganger-live": async () => [
      { label: "Live Entur-verktøy er aktivert", passed: toolNames(source).has("get_live_departures") && toolNames(source).has("plan_live_transit_trip"), evidence: [...toolNames(source)].filter((name) => name.includes("live")).join(", ") },
      ...(await liveDeparture()),
    ],
    "transport-live-feil": async () => {
      const failing: LiveTransportClient = { departures: async () => { throw { code: "unavailable" }; }, trip: async () => { throw { code: "unavailable" }; } };
      const failureSource = buildProductionAssistantSource(board, failing);
      if (!transportStop) return [{ label: "Boardet har Entur-stopp", passed: false, evidence: "Mangler." }];
      const result = await failureSource.createConversation().execute("get_live_departures", { poi_id: String(transportStop.id) });
      return [{ label: "Entur-feil faller tilbake uten gammel rutetabell", passed: compact(result.result).includes("Jeg bruker ikke eldre research"), evidence: compact(result.result) }];
    },
    "transport-bildeling": () => [includes(allText, "Mellomveien"), includes(allText, "reservasjon")],
    "transport-parkering": () => [includes(allText, "parkering"), includes(allText, "skilting")],

    "trening-bredde": () => [
      hasPlace(source, "Nyhavna Padel"),
      hasPlace(source, "CrossFit Trondheim"),
      hasPlace(source, "3T-Solsiden"),
      search("Flex Gym", "Flex Gym"),
      hasPlace(source, "Buld.no"),
    ],
    "trening-skjult-poi": () => [search("Buld.no", "Buld.no")],
    "opplevelser-bowling": () => [hasPlace(source, "Dora 1 Bowling"), search("Dora 1 Bowling", "Dora 1 Bowling")],
    "trening-registersted": () => [search("Buld.no", "Buld.no")],
    "opplevelser-ukjent": () => [excludes(allText, "ledige baner akkurat nå")],

    "kart-flere-steder": () => [
      { label: "Kartverktøyet highlight_places er registrert", passed: toolNames(source).has("highlight_places"), evidence: "Klientkvittering er fortsatt manuell." },
    ],
    "kart-ett-sted": () => [{ label: "Kartverktøyet show_place er registrert", passed: toolNames(source).has("show_place"), evidence: "Klientkvittering er fortsatt manuell." }],
    "samtale-avbrudd": () => openAndReturn("barn-oppvekst"),
    "kart-klikk": () => {
      const place = source.board.categories.flatMap((category) => category.pois).find((poi) => norwegian(poi.name).includes("dora 2"));
      const selected = place ? conversation().onMapSelection("place", String(place.id)) : null;
      return [{ label: "Kartklikk bruker samme server-samtale", passed: Boolean(selected?.commentary) && Array.isArray(selected?.directives), evidence: compact(selected) }];
    },
    "kart-ukjent-id": () => [unknownId(), mapUnknownId(), mapSelection()],

    "drift-content-version": () => [{ label: "Standardboardet har en innholdsversjon", passed: /^[a-f0-9]{64}$/.test(source.contentVersion), evidence: source.contentVersion }],
    "drift-samtykke": () => [manual("Samtykke er en klientinteraksjon og kan ikke bevises av serverens datasett.")],
    "drift-mikrofon": () => [manual("Mikrofontillatelse og feiltekst må kontrolleres i en ekte mobilnettleser.")],
    "drift-stemme": () => [manual("Audio, uttale og avbrudd er ikke simulerbare i denne scriptsjekken.")],
    "drift-rate-limit": () => [manual("Må kjøres mot en kontrollert grense uten å bruke produksjonskvote.")],
  };

  const groups = JSON.parse(await readFile(SCENARIOS_PATH, "utf8")) as ScenarioGroup[];
  const questions = groups.flatMap((group) => group.questions);
  const missing = questions.filter((question) => !rules[question.id]).map((question) => question.id);
  const extra = Object.keys(rules).filter((id) => !questions.some((question) => question.id === id));
  if (missing.length || extra.length) throw new Error(`Scenario/rule-avvik. Mangler: ${missing.join(", ")}; ekstra: ${extra.join(", ")}`);

  const results = [];
  for (const group of groups) {
    for (const question of group.questions) {
      const checks = await rules[question.id]!();
      const isManual = manualScenarios.has(question.id);
      const automatedPassed = checks.filter((check) => check.label !== "Krever fysisk/manuell test").every((check) => check.passed);
      const status: ScenarioStatus = isManual
        ? (automatedPassed ? "manual_pending" : "failed")
        : (automatedPassed ? "passed" : "failed");
      results.push({ groupId: group.id, id: question.id, question: question.text, expectation: question.expectation, status, automatedPassed, manualReason: manualScenarios.get(question.id) ?? null, checks });
    }
  }
  const passed = results.filter((result) => result.status === "passed");
  const failed = results.filter((result) => result.status === "failed");
  const pending = results.filter((result) => result.status === "manual_pending");
  const receipt = {
    schemaVersion: 1,
    evaluatedAt: new Date().toISOString(),
    route: { customer: "nyhavna-utvikling", projectSlug: "nyhavna" },
    source: "production_direct_read",
    contentVersion: source.contentVersion,
    scenarioSource: SCENARIOS_PATH,
    inventory: { categories: source.board.categories.length, pois: source.board.categories.reduce((sum, category) => sum + category.pois.length, 0), facts: material.facts.length, faq: material.faq.length },
    scenarios: results.length,
    automated: { passed: passed.length, failed: failed.length, allPassed: failed.length === 0 },
    manual: { pending: pending.length, scenarioIds: pending.map((result) => result.id) },
    results,
  };
  await writeFile(RECEIPT_PATH, `${JSON.stringify(receipt, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ receipt: RECEIPT_PATH, contentVersion: receipt.contentVersion, inventory: receipt.inventory, scenarios: receipt.scenarios, automated: receipt.automated, manual: receipt.manual, failedIds: failed.map((result) => result.id) }, null, 2)}\n`);
  if (failed.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
