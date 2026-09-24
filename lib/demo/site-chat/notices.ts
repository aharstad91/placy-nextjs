/**
 * Forbeholdet under et chatsvar (2026-09-24), felles for alle kunder.
 * Kundens egne tekster og formuleringer kommer fra profilen
 * (`SiteChatReplies.notices`).
 */

export type ReplyNoticeKind = "sales" | "timing" | "provisional";

export interface ReplyNotice {
  kind: ReplyNoticeKind;
  text: string;
}

/**
 * Forbeholdstekstene for én nettsidekopi. `alreadyQualified` legger til
 * kundens egne formuleringer som betyr at svaret allerede har forbeholdet
 * (f.eks. en henvisning til salgsteamet eller til utbygger).
 */
export interface ReplyNoticeTexts extends Record<ReplyNoticeKind, string> {
  alreadyQualified?: Partial<Record<ReplyNoticeKind, RegExp>>;
}

const SALES_WORDS = /\b(pris\w*|kost\w*|kr|kroner|felleskost\w*|ledig\w*|solgt|til salgs|i salg)\b/i;
const TIMING_WORDS = /innflytt\w*|flytte inn|ferdig\w*|byggestart|åpner|åpning|tidsplan|\b(?:19|20)\d{2}\b/i;
const ALREADY_QUALIFIED: Record<ReplyNoticeKind, RegExp> = {
  sales: /kan ikke bekrefte|må bekreftes|sjekk (?:gjeldende|oppdatert)/i,
  timing: /forventet|anslag|ikke bekreftet|kan endre seg|oppdatert (?:dato|tidsplan|tidspunkt)/i,
  provisional: /planlagt|forventet|uavklart|ikke bekreftet/i,
};

/**
 * Forbeholdet ved ett svar (2026-09-24), eller null. Vises bare når spørsmålet
 * eller svaret handler om pris/ledighet eller tidspunkt, eller når
 * verktøyene selv merket grunnlaget som planlagt/uavklart — aldri som et
 * generelt forbehold på hver melding. Småprat og avslag får aldri et.
 */
export function replyNotice(
  input: { userText: string; reply: string; answerType: string; provisional: boolean },
  texts: ReplyNoticeTexts,
): ReplyNotice | null {
  if (input.answerType !== "fact" && input.answerType !== "gap") return null;
  const text = `${input.userText}\n${input.reply}`;
  let kind: ReplyNoticeKind | null = null;
  if (SALES_WORDS.test(text)) kind = "sales";
  else if (TIMING_WORDS.test(text)) kind = "timing";
  else if (input.provisional && input.answerType === "fact") kind = "provisional";
  // En egen stripe hjelper bare når selve svaret mangler forbeholdet.
  // Modellen kan allerede ha sagt «forventet» eller henvist til kundens kontakt;
  // å gjenta det rett under svaret gjør chatten tyngre uten å gjøre den tryggere.
  if (!kind || ALREADY_QUALIFIED[kind].test(input.reply) || texts.alreadyQualified?.[kind]?.test(input.reply)) return null;
  return { kind, text: texts[kind] };
}
