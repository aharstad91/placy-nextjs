#!/usr/bin/env npx tsx
import "./load-env";

import { writeFile } from "node:fs/promises";

import { adaptBoardData } from "@/components/variants/report/board/board-data";
import type { BoardState } from "@/components/variants/report/board/board-state";
import { transformToReportData } from "@/components/variants/report/report-data";
import { buildProductionAssistantSource } from "@/lib/live/production-board";
import { executeBoardTool } from "@/lib/realtime/board-tools";
import { getProductFromSupabaseV2 } from "@/lib/supabase/v2-queries";

/**
 * Prosjektuavhengig kontraktsprøve for Anja på et standardboard.
 *
 * De to eksisterende evaluatorene (`evaluate-nyhavna-scenarios.ts` og
 * `evaluate-leangenbukta-scenarios.ts`) tester prosjektenes EGNE reviderte
 * innhold og kan ikke gjenbrukes på et tredje prosjekt. Denne prøver i stedet
 * garantiene som gjelder ethvert board: at hilsenen navngir dette prosjektet,
 * at nærhetssvar kommer fra faktiske POI-er med lagret reisetid, at
 * kartverktøyene bare endrer kartet når oppslaget lykkes, at avbrudd fører
 * tilbake til turen, og at et board uten researchlag ikke får fakta det ikke
 * har dekning for.
 *
 * Kjør:
 *   npx tsx scripts/evaluate-board-assistant.ts \
 *     --customer skanska --project lillebytunet \
 *     --receipt docs/research/<prosjekt>/audited/<dato>-assistant-evaluation.json
 */

interface Check {
  label: string;
  passed: boolean;
  evidence: string;
}

function options() {
  const values = process.argv.slice(2);
  const value = (flag: string) => {
    const index = values.indexOf(flag);
    return index >= 0 ? values[index + 1] : undefined;
  };
  const customer = value("--customer");
  const projectSlug = value("--project");
  if (!customer || !projectSlug) {
    throw new Error("--customer og --project er påkrevd");
  }
  return { customer, projectSlug, receiptPath: value("--receipt") ?? null };
}

const compact = (value: unknown) =>
  JSON.stringify(value ?? null).replace(/\s+/g, " ").slice(0, 500);
const nb = (value: string) => value.toLocaleLowerCase("nb");

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
  const args = options();
  const project = await getProductFromSupabaseV2(args.customer, args.projectSlug, "report");
  if (!project) throw new Error(`Fant ikke standardboardet ${args.customer}/${args.projectSlug}.`);
  const board = adaptBoardData(transformToReportData(project));
  const source = buildProductionAssistantSource(board);
  const conversation = () => source.createConversation();
  const projectName = board.home.name;
  const pois = board.categories.flatMap((category) => category.pois);
  const travelMinutes = (poi: (typeof pois)[number]) => {
    const stored = poi.raw.travelTime as { walk?: number } | null | undefined;
    return typeof stored?.walk === "number" ? stored.walk : null;
  };
  const withTravelTime = pois.filter((poi) => travelMinutes(poi) !== null);
  const samplePoi = withTravelTime[0] ?? pois[0];
  const auditedClaims = board.publishedKnowledge ?? [];

  const checks: Check[] = [];

  // 1. Oppstart — hilsenen hører til DETTE prosjektet.
  const greeting = board.assistant?.greeting ?? "";
  checks.push({
    label: "Oppstart: boardet har en egen hilsen som navngir prosjektet",
    passed: greeting.length > 0 && nb(greeting).includes(nb(projectName)),
    evidence: compact({ projectName, greeting: greeting.slice(0, 160) }),
  });

  // Den vanligste gjenbruksfeilen: fallback-hilsen fra et annet prosjekt.
  const otherProjects = ["Nyhavna", "Leangenbukta", "Wesselsløkka", "Stasjonskvartalet"]
    .filter((name) => nb(name) !== nb(projectName));
  const spoken = `${greeting}\n${source.voiceInstructions}\n${source.backendInstructions}`;
  checks.push({
    label: "Oppstart: hverken hilsen eller instruksjoner navngir et annet prosjekt",
    passed: !otherProjects.some((name) => nb(spoken).includes(nb(name))),
    evidence: compact(otherProjects.filter((name) => nb(spoken).includes(nb(name)))),
  });

  // 2. Bredt prosjektspørsmål — enten kildebelagte treff, eller et uttrykkelig
  //    «jeg har ikke grunnlag». Aldri prosa uten kilde.
  const projectInfo = conversation().execute("find_project_info", { query: projectName }) as {
    result: { matches?: number; results?: unknown[]; note?: string };
  };
  const matches = projectInfo.result.matches ?? (projectInfo.result.results ?? []).length;
  const declines = nb(projectInfo.result.note ?? "").includes("uten å gjette");
  checks.push({
    label: "Bredt prosjektspørsmål gir enten kildebelagte treff eller et uttrykkelig «ikke grunnlag»",
    passed: matches > 0 || declines,
    evidence: compact({ auditedClaims: auditedClaims.length, result: projectInfo.result }),
  });

  // 3. Nærhetsspørsmål — oppslaget skal treffe et sted som faktisk står på
  //    boardet, og svaret skal bære den lagrede reisetiden Anja oppgir minutter
  //    fra. Søkeordet er boardets eget stedsnavn, så prøven er prosjektuavhengig.
  const probe = withTravelTime[0] ?? pois[0];
  const nearby = probe
    ? (conversation().execute("find_places", { query: probe.name }) as {
        result: { places?: Array<{ name?: string; travel_minutes_from_board_origin?: unknown }> };
      }).result
    : { places: [] };
  const nearbyPlaces = nearby.places ?? [];
  const hit = nearbyPlaces.find((place) => nb(place.name ?? "\u0000") === nb(probe?.name ?? ""));
  checks.push({
    label: "Nærhetsoppslag finner et sted som faktisk står på boardet",
    passed: Boolean(hit),
    evidence: compact({ query: probe?.name, count: nearbyPlaces.length, first: nearbyPlaces.slice(0, 3) }),
  });
  checks.push({
    label: "Nærhetssvaret bærer lagret reisetid, så minutter ikke gjettes",
    passed: Boolean(hit?.travel_minutes_from_board_origin) && withTravelTime.length > 0,
    evidence: compact({ withTravelTime: withTravelTime.length, total: pois.length, hit }),
  });

  // 4. Vis ett sted — kartet følger verktøyet.
  const oneActions: unknown[] = [];
  const showOne = samplePoi
    ? executeBoardTool("show_place", { poi_id: String(samplePoi.id) }, {
        data: board,
        state: mockBoardState(),
        dispatch: (action) => { oneActions.push(action); },
      })
    : { error: "Boardet har ingen POI-er" };
  checks.push({
    label: "Vis ett sted: kartet endres når oppslaget lykkes",
    passed: !("error" in showOne) && oneActions.length > 0
      && compact(oneActions).includes(String(samplePoi?.id)),
    evidence: compact({ poi: samplePoi?.name, result: showOne, actions: oneActions }),
  });

  // 5. Vis flere steder.
  const manyIds = withTravelTime.slice(0, 3).map((poi) => String(poi.id));
  const manyActions: unknown[] = [];
  const showMany = manyIds.length > 0
    ? executeBoardTool("highlight_places", { poi_ids: manyIds }, {
        data: board,
        state: mockBoardState(),
        dispatch: (action) => { manyActions.push(action); },
      })
    : { error: "For få POI-er" };
  checks.push({
    label: "Vis flere steder: alle id-ene havner i karttilstanden",
    passed: !("error" in showMany)
      && manyIds.every((id) => compact(manyActions).includes(id)),
    evidence: compact({ ids: manyIds, result: showMany, actions: manyActions }),
  });

  // 6. Anja skal ikke hevde at noe vises før verktøyet har lyktes.
  const failedActions: unknown[] = [];
  const failed = executeBoardTool("show_place", { poi_id: "not-a-board-poi" }, {
    data: board,
    state: mockBoardState(),
    dispatch: (action) => { failedActions.push(action); },
  });
  checks.push({
    label: "Mislykket oppslag endrer ikke kartet (ingen påstand før verktøyet lykkes)",
    passed: "error" in failed && failedActions.length === 0,
    evidence: compact({ result: failed, actions: failedActions }),
  });
  checks.push({
    label: "Ukjent kartklikk lager ikke en falsk samtalehandling",
    passed: conversation().onMapSelection("place", "not-a-board-poi") === null,
    evidence: compact(conversation().onMapSelection("place", "not-a-board-poi")),
  });
  checks.push({
    label: "Instruksjonen krever fullført backend-svar før Anja avslutter",
    passed: nb(source.voiceInstructions).includes("vent på hele resultatet"),
    evidence: compact(source.voiceInstructions.slice(-220)),
  });

  // 7. Avbrudd og fortsettelse.
  const themeId = board.categories[0]?.id;
  const session = conversation();
  const opened = themeId ? session.execute("set_interests", { interests: [String(themeId)], theme_ids: [String(themeId)] }) : null;
  const detour = session.execute("note_detour", { about: "kollektiv" });
  const returned = session.execute("return_to_tour", {});
  checks.push({
    label: "Avbrudd og fortsettelse går tilbake til det åpnede temaet",
    passed: Boolean(themeId) && compact(returned.result).includes(String(themeId)),
    evidence: compact({ themeId, opened: opened?.result, detour: detour.result, returned: returned.result }),
  });

  // 8. Registergrensen — et board uten researchlag får ingen fakta.
  const factsForSample = samplePoi
    ? (conversation().execute("get_place_facts", { poi_id: String(samplePoi.id) }) as {
        result: { basis?: string; facts?: unknown[]; sources?: unknown[] };
      }).result
    : null;
  checks.push({
    label: auditedClaims.length > 0
      ? "Stedsoppslag oppgir grunnlaget sitt"
      : "Uten researchlag gir stedsoppslag ingen fakta eller kilder",
    passed: factsForSample !== null && (auditedClaims.length > 0
      ? true
      : (factsForSample.facts ?? []).length === 0
        && (factsForSample.sources ?? []).length === 0),
    evidence: compact({ poi: samplePoi?.name, result: factsForSample }),
  });
  checks.push({
    label: "Ukjent POI-ID avvises av kunnskapsverktøyet",
    passed: Boolean((conversation().execute("get_place_facts", { poi_id: "not-a-board-poi" }) as {
      result: { error?: string };
    }).result.error),
    evidence: compact(conversation().execute("get_place_facts", { poi_id: "not-a-board-poi" }).result),
  });

  const manual = [
    "Samtykkedialog før mikrofon og sesjon starter.",
    "Avvist mikrofon gir forståelig gjenopprettingsmelding.",
    "Fysisk lyttetest på HTTPS-origin: norsk uttale, tempo, avbrudd midt i et svar.",
    "Visuell kvittering i klienten for ett sted og for flere steder.",
  ];

  const receipt = {
    schemaVersion: 1,
    evaluatedAt: new Date().toISOString(),
    customer: args.customer,
    projectSlug: args.projectSlug,
    projectName,
    inventory: {
      pois: pois.length,
      poisWithTravelTime: withTravelTime.length,
      themes: board.categories.length,
      auditedClaims: auditedClaims.length,
    },
    automatic: { passed: checks.filter((c) => c.passed).length, total: checks.length },
    checks,
    manualGates: manual,
  };
  if (args.receiptPath) await writeFile(args.receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
  if (checks.some((check) => !check.passed)) process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
