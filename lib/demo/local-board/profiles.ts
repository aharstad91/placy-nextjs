/**
 * Boardets DOMENEPROFIL (2026-09-18).
 *
 * ## Hvorfor profilen er et eget begrep
 *
 * Boardet har allerede to ord som ligner: `boardMode` (hvilken flate som
 * vises) og `venueType` (hva slags sted markøren står på). Ingen av dem sier
 * hva slags KUNNSKAP datasettet må bære. Et boligprosjekt må skille byggestatus
 * fra åpning og innflytting; en bruktbolig har ingen byggestatus, men har en
 * boligprofil og en nabolagshistorie; et næringsbygg har leietakere og
 * åpningstider. Samme grensesnitt, ulikt datagrunnlag.
 *
 * Presser man dette inn i `boardMode` eller `venueType`, blir «hvordan ser
 * flaten ut» og «hva må være kildekontrollert» samme spørsmål — og da arver et
 * nytt datasett enten alt eller ingenting. Derfor et eget felt i `board.json`.
 *
 * ## Hvorfor de uimplementerte profilene står her likevel
 *
 * De er GRENSENE for gjenbruk, ikke et tilbud. `IMPLEMENTED_PROFILES` er den
 * eneste lista som betyr noe ved lasting: står en profil bare i katalogen,
 * avvises datasettet med en feil som sier hvorfor. Alternativet — å la et
 * `resale`-datasett laste og bli behandlet som et boligprosjekt — ville gitt en
 * demo som later som den har kunnskap den aldri har definert.
 */

/** Rekkefølgen er dokumentasjonens, ikke en prioritering. */
export const BOARD_PROFILE_IDS = ["housing-development", "resale", "commercial"] as const;

export type BoardProfileId = (typeof BOARD_PROFILE_IDS)[number];

export interface BoardProfile {
  id: BoardProfileId;
  /** Navnet på norsk, slik det står i dokumentasjonen og i feilmeldinger. */
  label: string;
  /** Hva slags kunnskap datasettet må bære for at profilen skal gi mening. */
  knowledgeNeeds: string;
}

export const BOARD_PROFILES: Record<BoardProfileId, BoardProfile> = {
  "housing-development": {
    id: "housing-development",
    label: "boligprosjekt",
    knowledgeNeeds:
      "Bygg, fasiliteter og uteområder under utvikling: byggestatus, om tilbudet er åpnet, oppgitt tidspunkt med opprinnelig presisjon, hvem som har adgang, hva som er bekreftet ved innflytting i et navngitt bygg, og hvor kildene spriker.",
  },
  resale: {
    id: "resale",
    label: "bruktbolig",
    knowledgeNeeds:
      "Boligen slik den står i dag og nabolaget rundt: boligens egne opplysninger, skolekrets, nærtilbud og hverdagsavstander. Ingen byggestatus, ingen innflyttingskobling.",
  },
  commercial: {
    id: "commercial",
    label: "næring",
    knowledgeNeeds:
      "Bygget og virksomhetene i det: arealer, leietakere, adkomst, åpningstider og fellesfunksjoner. Adgang handler om leietakere og besøkende, ikke om beboere.",
  },
};

/**
 * Profilene som faktisk er bygd.
 *
 * Endres denne, må kunnskapsmodellen for profilen finnes FØRST — lista er ikke
 * en bryter, den er en påstand om at koden bærer profilens begreper.
 */
export const IMPLEMENTED_PROFILES: readonly BoardProfileId[] = ["housing-development"];

export function isImplementedProfile(id: BoardProfileId): boolean {
  return IMPLEMENTED_PROFILES.includes(id);
}
