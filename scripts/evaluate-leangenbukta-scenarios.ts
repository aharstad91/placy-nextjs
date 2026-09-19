#!/usr/bin/env npx tsx
import "./load-env";

import { readFile, writeFile } from "node:fs/promises";

import { adaptBoardData } from "@/components/variants/report/board/board-data";
import { transformToReportData } from "@/components/variants/report/report-data";
import { buildProductionAssistantSource } from "@/lib/live/production-board";
import type { LiveTransportClient } from "@/lib/realtime/live-transport";
import { getProductFromSupabaseV2 } from "@/lib/supabase/v2-queries";

const SCENARIOS_PATH = "data/demo/leangenbukta-lokal/conversations.json";
const RECEIPT_PATH =
  "docs/research/leangenbukta-lokal-demo/audited/2026-09-19-production-scenario-evaluation.json";

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

type Rule = () => Check[] | Promise<Check[]>;

const compact = (value: unknown) =>
  JSON.stringify(value).replace(/\s+/g, " ").slice(0, 500);

function includesAll(haystack: string, ...needles: string[]): Check {
  const missing = needles.filter(
    (needle) => !haystack.toLocaleLowerCase("nb").includes(needle.toLocaleLowerCase("nb")),
  );
  return {
    label: `Inneholder ${needles.join(", ")}`,
    passed: missing.length === 0,
    evidence: missing.length ? `Mangler: ${missing.join(", ")}` : needles.join(" | "),
  };
}

function excludesAll(haystack: string, ...needles: string[]): Check {
  const found = needles.filter((needle) =>
    haystack.toLocaleLowerCase("nb").includes(needle.toLocaleLowerCase("nb")),
  );
  return {
    label: `Utelater ${needles.join(", ")}`,
    passed: found.length === 0,
    evidence: found.length ? `Fant: ${found.join(", ")}` : "Ingen av de avviste påstandene ble publisert.",
  };
}

async function main() {
  const project = await getProductFromSupabaseV2("placy-demo", "leangenbukta", "report");
  if (!project) throw new Error("Fant ikke produksjonsboardet placy-demo/leangenbukta");
  const board = adaptBoardData(transformToReportData(project));
  const fakeTransport: LiveTransportClient = {
    departures: async (stopPlaceId) => ({
      stopPlace: { id: stopPlaceId, name: "Leangen" },
      fetchedAt: "2026-09-19T08:00:00.000Z",
      quays: [{
        quayId: "NSR:Quay:1",
        departures: [{
          departureTime: "2026-09-19T08:06:00+02:00",
          expectedDepartureTime: "2026-09-19T08:05:00+02:00",
          actualDepartureTime: "2026-09-19T08:06:00+02:00",
          isRealtime: true,
          destination: "Sentrum",
          lineCode: "2",
          transportMode: "bus",
        }],
      }],
      departures: [],
    }),
    trip: async () => ({ fetchedAt: "2026-09-19T08:00:00.000Z", trips: [] }),
  };
  const source = buildProductionAssistantSource(board, fakeTransport);
  const boardText = JSON.stringify(source.board);
  const facts = source.board.publishedKnowledge ?? [];
  const factText = facts.map((fact) => `${fact.subjectName ?? ""} ${fact.factText}`).join("\n");
  const combined = `${boardText}\n${factText}`;
  const byTopic = (topic: string) => facts
    .filter((fact) => fact.topic.toLocaleLowerCase("nb").includes(topic))
    .map((fact) => `${fact.subjectName ?? ""} ${fact.factText}`)
    .join("\n");
  const resume = (themeId: string, required: string[] = []): Check[] => {
    const conversation = source.createConversation();
    const opened = conversation.execute("set_interests", {
      interests: [themeId],
      theme_ids: [themeId],
    });
    const detour = conversation.execute("note_detour", { about: "et sidespørsmål" });
    const returned = conversation.execute("return_to_tour", {});
    const transcript = compact({ opened: opened.result, detour: detour.result, returned: returned.result });
    return [
      {
        label: `Avbrudd returnerer til ${themeId}`,
        passed:
          compact(opened.result).includes(`\"theme_id\":\"${themeId}\"`) &&
          compact(detour.result).includes(`\"theme_id\":\"${themeId}\"`) &&
          compact(returned.result).includes(`\"theme_id\":\"${themeId}\"`),
        evidence: transcript,
      },
      ...(required.length ? [includesAll(combined, ...required)] : []),
    ];
  };
  const noClaim = (label: string, ...needles: string[]): Check => ({
    label,
    passed: !facts.some((fact) => needles.every((needle) =>
      fact.factText.toLocaleLowerCase("nb").includes(needle.toLocaleLowerCase("nb")))),
    evidence: `Kontrollerte ${facts.length} publiserte fakta; ingen påstand med ${needles.join(" + ")}.`,
  });

  const rules: Record<string, Rule> = {
    "hverdag-broad": () => [includesAll(combined, "City Lade", "Sirkus Shopping", "Lade Arena")],
    "hverdag-specific": () => [includesAll(combined, "Søndag er senteret stengt", "søndag 12–22", "søndag 10–16")],
    "hverdag-follow-up": () => [includesAll(combined, "Rema 1000", "Vitusapotek", "Burger King")],
    "hverdag-unknown": () => [noClaim("Ingen publisert raskest-rangering av apotek", "apotek", "raskest")],
    "hverdag-interruption-resume": () => resume("hverdagsliv", ["City Lade"]),

    "oppvekst-broad": () => [includesAll(combined, "Lade skole", "Lade SFO", "Ladesletta barnehage", "Leangen kulturbarnehage", "Lade fritidsklubb")],
    "oppvekst-specific": () => [includesAll(combined, "Lade SFO", "07.15–16.30")],
    "oppvekst-follow-up": () => [includesAll(combined, "Skolekrets for Haakon VIIs gate 14 er ikke verifisert")],
    "oppvekst-unknown": () => [noClaim("Ingen publisert ledig-plass-påstand", "barnehage", "ledig plass")],
    "oppvekst-interruption-resume": () => resume("barn-oppvekst", ["Lade fritidsklubb"]),

    "servering-broad": () => [includesAll(combined, "Ladekaia", "Egon Lade", "Kompis Lade", "Burger King Lade Arena", "Fyr på Lade", "Franske Nytelser")],
    "servering-specific": () => [includesAll(combined, "søndag 12–22", "søndag 10–16", "Søndag er senteret stengt")],
    "servering-follow-up": () => [includesAll(combined, "Kompis", "takeaway", "søndag 13–22")],
    "servering-unknown": () => [noClaim("Ingen publisert leveringsdekning til prosjektadressen", "lever", "Haakon VIIs gate 14")],
    "servering-interruption-resume": () => resume("mat-drikke", ["Ladekaia", "sesong"]),

    "natur-broad": () => [includesAll(combined, "Korsvika", "Ringvebukta", "Djupvika", "Ringve botaniske hage")],
    "natur-specific": () => [includesAll(combined, "Korsvika", "benker", "toalett", "grill", "badestige", "lekeplass", "Korsvik allé")],
    "natur-follow-up": () => [includesAll(combined, "Ringve botaniske hage", "gratis", "hele året")],
    "natur-unknown": () => [noClaim("Ingen publisert nåstatus for adkomststien", "adkomststien", "åpen akkurat nå")],
    "natur-interruption-resume": () => resume("natur-friluftsliv", ["Korsvika", "Ringvebukta"]),

    "transport-broad": () => [includesAll(combined, "Leangen stasjon", "Miljøpakken oppgir prosjektstatus Pågår")],
    "transport-specific": () => [includesAll(combined, "R70", "15 parkeringsplasser", "2 HC", "trinnfri", "trapper")],
    "transport-follow-up": () => [noClaim("Ingen publisert nåstatus for stasjonsheisen", "heisen", "ute av drift")],
    "transport-unknown": async () => {
      const stop = source.board.categories.flatMap((category) => category.pois)
        .find((poi) => Boolean(poi.raw.enturStopplaceId));
      const toolNames = source.tools.map((tool) => tool.name);
      if (!stop?.raw.enturStopplaceId) {
        return [{ label: "Boardet har Entur-stopp", passed: false, evidence: "Ingen POI med enturStopplaceId." }];
      }
      const result = await source.createConversation().execute("get_live_departures", { poi_id: String(stop.id) });
      return [
        {
          label: "Levende Entur-verktøy er aktivert",
          passed: toolNames.includes("get_live_departures") && toolNames.includes("plan_live_transit_trip"),
          evidence: toolNames.filter((name) => name.includes("live_")).join(", "),
        },
        {
          label: "Entur-oppslag bruker et boardvalidert stopp",
          passed: compact(result.result).includes("2026-09-19T08:00:00.000Z") && compact(result.result).includes("Sentrum"),
          evidence: compact({ poi: stop.name, entur: stop.raw.enturStopplaceId, result: result.result }),
        },
      ];
    },
    "transport-interruption-resume": () => resume("transport", ["Hangarbrua åpnet i september 2025", "avhenger av finansiering"]),

    "trening-broad": () => [includesAll(combined, "3T-Lade", "Impulse Leangen", "Impulse Lade", "Leangen idrettspark", "Trygg/Lade-hallen"), excludesAll(byTopic("trening"), "Fresh Fitness")],
    "trening-specific": () => [includesAll(combined, "tirsdag/torsdag 11.15–16", "onsdag/fredag 10–16", "Gratis publikumstid", "uten reservasjon")],
    "trening-follow-up": () => [includesAll(combined, "3T-Lade", "spa-basseng", "dampbad", "kaldkulp")],
    "trening-unknown": () => [includesAll(combined, "Knutepunktet", "planlagt", "siste kvartal 2026"), noClaim("Ingen publisert ferdigstilt-påstand for treningsrommet", "treningsrom", "ferdigstilt")],
    "trening-interruption-resume": () => resume("trening-aktivitet", ["bemannet"]),

    "opplevelser-broad": () => [includesAll(combined, "Ringve Musikkmuseum", "Lade kirke", "Leo's Lekeland", "Leangen gård", "Ladehammeren")],
    "opplevelser-specific": () => [includesAll(combined, "17.08.2026–01.04.2027", "tirsdag–søndag 11–16", "mandag stengt")],
    "opplevelser-follow-up": () => [includesAll(combined, "Ringve botaniske hage", "gratis", "Billettbelagt museum")],
    "opplevelser-unknown": () => [excludesAll(combined, "offentlig kulturarena på torget", "naboplan r20170034")],
    "opplevelser-interruption-resume": () => resume("opplevelser", ["Leo's Lekeland", "lør–søn 09–20"]),
  };

  const groups = JSON.parse(await readFile(SCENARIOS_PATH, "utf8")) as ScenarioGroup[];
  const questions = groups.flatMap((group) => group.questions);
  const unknownRules = questions.filter((question) => !rules[question.id]).map((question) => question.id);
  const extraRules = Object.keys(rules).filter((id) => !questions.some((question) => question.id === id));
  if (unknownRules.length || extraRules.length) {
    throw new Error(`Scenario/rule-avvik. Mangler regler: ${unknownRules.join(", ")}; ekstra regler: ${extraRules.join(", ")}`);
  }

  const results = [];
  for (const group of groups) {
    for (const question of group.questions) {
      const checks = await rules[question.id]!();
      results.push({
        groupId: group.id,
        id: question.id,
        question: question.text,
        expectation: question.expectation,
        passed: checks.every((check) => check.passed),
        checks,
      });
    }
  }
  const failed = results.filter((result) => !result.passed);
  const receipt = {
    schemaVersion: 1,
    evaluatedAt: new Date().toISOString(),
    route: { customer: "placy-demo", projectSlug: "leangenbukta" },
    contentVersion: source.contentVersion,
    source: "production_direct_read",
    scenarioSource: SCENARIOS_PATH,
    scenarios: results.length,
    passed: results.length - failed.length,
    failed: failed.length,
    allPassed: failed.length === 0,
    results,
  };
  await writeFile(RECEIPT_PATH, `${JSON.stringify(receipt, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({
    receipt: RECEIPT_PATH,
    contentVersion: receipt.contentVersion,
    scenarios: receipt.scenarios,
    passed: receipt.passed,
    failed: receipt.failed,
    failedIds: failed.map((result) => result.id),
  }, null, 2)}\n`);
  if (failed.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
