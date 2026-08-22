/**
 * Parser for stedslenker i FAQ-svar: `[Ranheim skole](poi:nsr-975278980)` og
 * `[Transport & Mobilitet](category:transport)`.
 *
 * HVORFOR NYBYGG: markupen har eksistert på SKRIVE-siden siden
 * grounding-kurateringen (`lib/curation/poi-linker.ts`), og `BoardData.poisById`
 * finnes som oppslagstabell — men ingen render-sti har noen gang tolket den.
 * `NarrativeBody` i utforsk-modalen rendrer rene tekstnoder. FAQ-en er den
 * første flaten som gjør lenkene klikkbare, og parseren hører derfor her, ikke
 * inne i en komponent.
 *
 * TO REGLER SOM IKKE KAN FRAVIKES:
 *
 * 1. POI-IDer ER FRIE STRENGER. `nsr-975278980`, `google-ChIJ…`,
 *    `entur-NSR-StopPlace-60260`, `bus-dronningens-gate` — alle er gyldige. En
 *    UUID-sjekk droppet 6 av 7 grounding-objekter stille ved render
 *    (`poi-ids-heterogeneous-not-uuid-20260428`). Sikkerheten ligger i
 *    OPPSLAGET mot boardets eget POI-sett, aldri i id-ens form.
 *
 * 2. DEGRADER, ALDRI SENSURER. En referanse til et sted som ikke er på boardet
 *    blir REN TEKST med lenketeksten beholdt. Svaret er fortsatt sant; det er
 *    bare ikke klikkbart. Å fjerne setningen ville vært å la kartdekningen
 *    bestemme hva vi får lov til å si.
 */

/** Ett segment av en svartekst, klart til rendring. */
export type LinkedTextNode =
  | { kind: "text"; text: string }
  | { kind: "poi"; text: string; poiId: string }
  | { kind: "category"; text: string; categoryId: string };

/**
 * `[tekst](poi:id)` / `[tekst](category:id)`.
 *
 * Lenketeksten tillater ikke `]`, og målet ikke `)` — begge deler er utelukket
 * fra POI-navn og id-er i praksis, og alternativet (balansert parsing) ville
 * vært mye maskineri for et format vi selv skriver.
 */
const LINK_RE = /\[([^\]]+)\]\((poi|category):([^)]+)\)/g;

export interface LinkResolvers {
  /**
   * Er stedet på boardet? Returner den KANONISKE POI-id-en (den `OPEN_POI`
   * matcher på), eller null. Får den rå id-en fra markupen.
   */
  resolvePoi?: (rawId: string) => string | null;
  /** Samme for kategorier — returner kanonisk kategori-id eller null. */
  resolveCategory?: (rawId: string) => string | null;
}

/**
 * Del en svartekst i tekst- og lenkesegmenter.
 *
 * Uten resolvere blir alt ren tekst med lenketeksten beholdt — nyttig i
 * kontekster som ikke har et board å slå opp i (test, e-post, eksport).
 */
export function parseLinkedText(text: string, resolvers: LinkResolvers = {}): LinkedTextNode[] {
  const nodes: LinkedTextNode[] = [];
  let cursor = 0;

  // Lokal regex-instans: en modul-delt /g-regex bærer `lastIndex` mellom kall
  // og ville gitt ulikt resultat andre gang samme tekst ble parset.
  const re = new RegExp(LINK_RE.source, "g");
  let match: RegExpExecArray | null;

  const pushText = (value: string) => {
    if (!value) return;
    const prev = nodes[nodes.length - 1];
    // Slå sammen tilstøtende tekst så en degradert lenke ikke etterlater et
    // hakk i teksten (React ville ellers rendret dem som separate noder).
    if (prev?.kind === "text") prev.text += value;
    else nodes.push({ kind: "text", text: value });
  };

  while ((match = re.exec(text)) !== null) {
    const [raw, label, scheme, target] = match;
    pushText(text.slice(cursor, match.index));
    cursor = match.index + raw.length;

    const id = target.trim();
    if (scheme === "poi") {
      const resolved = resolvers.resolvePoi?.(id) ?? null;
      if (resolved) nodes.push({ kind: "poi", text: label, poiId: resolved });
      else pushText(label);
      continue;
    }
    const resolved = resolvers.resolveCategory?.(id) ?? null;
    if (resolved) nodes.push({ kind: "category", text: label, categoryId: resolved });
    else pushText(label);
  }

  pushText(text.slice(cursor));
  return nodes;
}

/**
 * Resolvere bygget på boardets egne oppslag.
 *
 * `poisById` er nøklet på LOWERCASED id (`board-data.ts`), mens `OPEN_POI` må
 * ha POI-ens EGEN skrivemåte. Derfor slås det opp i små bokstaver og
 * returneres den kanoniske id-en — en mixed-case referanse som
 * `entur-NSR-StopPlace-60260` ville ellers enten bommet på oppslaget eller
 * sendt en id ingen kategori kjenner igjen.
 */
export function boardLinkResolvers(
  poisById: ReadonlyMap<string, { id: string }>,
  categoryIds: readonly string[],
): Required<LinkResolvers> {
  const categories = new Set(categoryIds);
  return {
    resolvePoi: (rawId) => poisById.get(rawId.toLowerCase())?.id ?? null,
    resolveCategory: (rawId) => (categories.has(rawId) ? rawId : null),
  };
}
