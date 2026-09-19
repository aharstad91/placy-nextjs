import type { BoardData, BoardPOI } from "@/components/variants/report/board/board-data";

export type AddressPurpose = "address" | "directions" | "disambiguation";

export interface SpokenAddressEntry {
  id: string;
  name: string;
  address: string;
}

/** Visuelle adressefelt holdes utenfor modelldata, men beholdes i et smalt serveroppslag. */
export function boardAddressBook(board: BoardData): Map<string, SpokenAddressEntry> {
  const result = new Map<string, SpokenAddressEntry>();
  for (const poi of board.categories.flatMap((category) => category.pois)) {
    const address = poi.address?.trim() || poi.raw.address?.trim();
    if (address) result.set(String(poi.id), { id: String(poi.id), name: poi.name, address });
    for (const child of poi.childPOIs ?? []) {
      if (child.address?.trim()) result.set(String(child.id), { id: String(child.id), name: child.name, address: child.address.trim() });
    }
  }
  return result;
}

function redact(text: string | undefined, addresses: readonly string[]): string | undefined {
  if (!text) return text;
  return addresses.reduce((value, address) => value.split(address).join("stedet"), text);
}

function spokenPoi(poi: BoardPOI, addresses: readonly string[]): BoardPOI {
  const raw = {
    ...poi.raw,
    address: undefined,
    description: redact(poi.raw.description, addresses),
    childPOIs: poi.raw.childPOIs?.map((child) => ({
      ...child,
      address: undefined,
      description: redact(child.description, addresses),
    })),
  };
  return {
    ...poi,
    address: undefined,
    body: redact(poi.body, addresses),
    raw,
    childPOIs: raw.childPOIs,
  };
}

/**
 * Ny BoardData-verdi for modellen. Originalen forblir urørt og brukes av UI-et.
 * Også fritekst renses for eksakte, kjente adresseverdier slik at FAQ eller
 * redaksjonell tekst ikke blir en bakdør rundt adresseverktøyet.
 */
export function spokenBoardProjection(board: BoardData): BoardData {
  const book = boardAddressBook(board);
  const addresses = [board.home.address, ...[...book.values()].map((entry) => entry.address)]
    // Katalogdata bruker av og til stedsnavn ("Lade", "Trondheim S") i
    // adressefeltet. De må ikke globalt erstattes inni navn og FAQ. Et presist
    // gateadresseuttrykk har husnummer; selve adressefeltene fjernes uansett.
    .filter((value): value is string => Boolean(value?.trim()) && /\d/.test(value));
  const categories = board.categories.map((category) => {
    const pois = category.pois.map((poi) => spokenPoi(poi, addresses));
    const byId = new Map(pois.map((poi) => [String(poi.id), poi]));
    return {
      ...category,
      lead: redact(category.lead, addresses) ?? "",
      body: redact(category.body, addresses) ?? "",
      pois,
      topRankedPois: (category.topRankedPois ?? []).map((poi) => byId.get(String(poi.id)) ?? spokenPoi(poi, addresses)),
      editorial: category.editorial ? {
        ...category.editorial,
        intro: redact(category.editorial.intro, addresses),
        body: redact(category.editorial.body, addresses) ?? "",
        faq: category.editorial.faq?.map((entry) => ({
          ...entry,
          question: redact(entry.question, addresses) ?? "",
          answer: redact(entry.answer, addresses) ?? "",
        })),
        unplaced: category.editorial.unplaced?.map((value) => redact(value, addresses) ?? ""),
      } : undefined,
    };
  });
  const allPois = categories.flatMap((category) => category.pois);
  return {
    ...board,
    home: { ...board.home, address: board.home.name, heroIntro: redact(board.home.heroIntro, addresses) },
    areaIntro: redact(board.areaIntro, addresses),
    globalFaq: board.globalFaq?.map((entry) => ({
      ...entry,
      question: redact(entry.question, addresses) ?? "",
      answer: redact(entry.answer, addresses) ?? "",
    })),
    publishedKnowledge: board.publishedKnowledge?.map((fact) => ({
      ...fact,
      subjectName: redact(fact.subjectName, addresses),
      factText: redact(fact.factText, addresses) ?? "",
    })),
    categories,
    poisById: new Map(allPois.map((poi) => [poi.id, poi.raw])),
  };
}
