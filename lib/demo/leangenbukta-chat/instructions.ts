import "server-only";

import type { SitePage } from "@/lib/demo/leangenbukta-site/pages";

/**
 * Instruksjonstillegget som gjør Anjas kunnskapsgrunnlag om til en
 * TEKSTCHAT-stemme (2026-09-23, KTD4/R9).
 *
 * `demo.backendInstructions` (samme instruks Boardets Anja får) eies av
 * Board-planen og endres ikke her. Dette tillegget legges ETTER den, og sier
 * bare det tekstmodus trenger utover det: ingen markdown/lenker i selve
 * teksten (lenker leveres strukturert, se `links.ts`), korte svar, aldri
 * kartomtale, og sidekonteksten for AKKURAT dette kallet.
 *
 * Sidekonteksten kommer fra REGISTERET (`getSitePage`), aldri fra
 * nettleseren: ruta slår opp `pageId` selv, og bare feltene her når modellen.
 */
export function textModeAddendum(page: SitePage): string {
  const building = page.boardTopicId
    ? `\nDenne siden gjelder byggetemaet «${page.boardTopicId}» i Boardet. Bruk open_theme eller find_project_info med dette temaet først ved spørsmål om DETTE bygget, men bytt fritt til andre verktøy eller temaer når spørsmålet handler om noe annet. Byggkonteksten kan prioritere svaret, men skal ALDRI dikte en byggspesifikk reisetid, avstand eller fasilitetstilgang uten verktøybevis.`
    : "";
  return `
Du svarer nå i TEKSTCHAT, ikke i tale. Reglene under kommer i TILLEGG til instruksen over, og gjelder bare formen på selve svaret.

- Du er en vennlig, rolig nabolagsguide i en PROTOTYPE fra Placy. Svarene er ikke godkjent av utbygger eller megler; si aldri at utbygger, megler eller Leangenbukta står bak, har godkjent eller garanterer et svar.
- Svar på norsk bokmål, i ren løpende tekst. Ingen markdown, ingen HTML, ingen URL-er eller lenketekst i selve svaret — relevante lenker leveres i et eget strukturert felt (link_ids), ikke i teksten. link_ids kan BARE inneholde "board" (Boardet), "contact" (kontaktsiden) eller "page:<side-ID>" for en side i sideregisteret — aldri et fakta-ID, verktøy-ID eller noe annet. Utelat feltet eller la det stå tomt når ingen av disse passer.
- Form: svaret først, i første setning. Deretter det viktigste forbeholdet, bare hvis det finnes et. Avslutt med én konkret neste handling når den hjelper (Boardet, en side eller salgsteamet). 2–4 setninger totalt; ingen innledende høflighetsfraser, og ikke gjenta det samme forbeholdet i hvert svar.
- Omtal ALDRI et kart, en markør, at noe «vises» eller «fremheves», eller at brukeren kan «trykke» noe — denne samtalen har ikke noe kart å vise til.
- Skill tydelig mellom det som er bekreftet og det som er forventet/planlagt/uavklart, med samme status-ord verktøyene gir deg. Lov aldri pris, ledighet, tilgang eller åpnings- eller innflyttingsdato som sikker med mindre et verktøy nettopp bekreftet det. Dagens ledighet og gjeldende priser kjenner du ikke; henvis til salgsteamet.
- Bygger spørsmålet på en påstand verktøyene ikke bekrefter — et årstall, en dato, at noe er ferdig eller åpent — si rett ut at du ikke finner støtte for det, og gjenta det aldri som fakta. Et årstall brukeren selv nevner er ikke en kilde. Nevn bare årstall som står i verktøysvarene.
- Vær forsiktig med følsomme tema (trygghet, kriminalitet, helse, skoleplass, økonomi): gjengi bare det kildene sier, og ikke vurder eller anbefal på egen hånd.
- Har du ikke kildebelagt grunnlag for spørsmålet: si det ærlig og kort, og foreslå Board eller kontakt i stedet for å gjette.
- Før et svar med answer_type "fact": kall ALLTID et kunnskapsverktøy (find_project_info, get_place_facts, get_place_address, get_board_facts eller open_theme) i DENNE meldingen, selv om du mener å kjenne svaret fra katalogen i instruksen over. Tekstserveren krever et fersk verktøykall som bevis for hvert faktasvar og forkaster ellers svaret — dette gjelder bare tekstmodus, ikke resten av instruksen.
- source_ids: kilde-ID-ene svaret bygger på, høyst fire, hentet fra feltene source_id eller sources[].id i verktøysvarene i DENNE meldingen. Skriv aldri en ID du ikke har sett der; serveren viser bare kilder verktøyene faktisk returnerte. Tom liste når svaret ikke bygger på en kilde.
- Sidekonteksten for denne meldingen: siden heter «${page.title}» (type: ${page.kind}).${building}
`.trim();
}

/**
 * Chattens første melding på en side (2026-09-24). Fast tekst fra
 * sideregisteret, ikke modelltekst: den koster ingen kvote og kan ikke påstå
 * noe om prosjektet. Byggsider nevner bygget, resten nevner siden de står på.
 */
export function pageOpening(page: SitePage): string {
  const name = page.shortName ?? page.title;
  switch (page.kind) {
    case "home":
      return "Hei! Spør meg om Leangenbukta, byggene og nærområdet. Jeg svarer ut fra offentlige kilder og sier fra når noe bare er planlagt eller ikke bekreftet.";
    case "building":
      return `Hei! Du ser på ${name}. Spør om bygget, hva som er planlagt, eller hva som finnes rundt. Pris, ledighet og innflytting bekrefter salgsteamet.`;
    case "location":
      return "Hei! Spør om reisetider, skoler, turområder og hverdagen rundt Leangenbukta.";
    default:
      return `Hei! Du leser «${name}». Spør meg om Leangenbukta eller nærområdet, så svarer jeg kort ut fra offentlige kilder.`;
  }
}

export type ReplyNoticeKind = "sales" | "timing" | "provisional";

export interface ReplyNotice {
  kind: ReplyNoticeKind;
  text: string;
}

const NOTICE_TEXT: Record<ReplyNoticeKind, string> = {
  sales: "Pris og ledighet endrer seg. Sjekk gjeldende prisliste og ledige boliger med salgsteamet.",
  timing: "Framdrift og innflytting kan endre seg. Salgsteamet har den oppdaterte tidsplanen.",
  provisional: "Noe av dette er planlagt eller uavklart i kildene, ikke ferdig bekreftet.",
};

const SALES_WORDS = /\b(pris\w*|kost\w*|kr|kroner|felleskost\w*|ledig\w*|solgt|til salgs|i salg)\b/i;
const TIMING_WORDS = /innflytt\w*|flytte inn|ferdig\w*|byggestart|åpner|åpning|tidsplan|\b(?:19|20)\d{2}\b/i;
const ALREADY_QUALIFIED: Record<ReplyNoticeKind, RegExp> = {
  sales: /kan ikke bekrefte|må bekreftes|sjekk (?:gjeldende|oppdatert)|kontakt salgsteamet|avklar.{0,40}salgsteamet/i,
  timing: /forventet|anslag|ikke bekreftet|kan endre seg|oppdatert (?:dato|tidsplan|tidspunkt)/i,
  provisional: /planlagt|forventet|uavklart|ikke bekreftet/i,
};

/**
 * Forbeholdet ved ett svar (2026-09-24), eller null. Vises bare når spørsmålet
 * eller svaret handler om pris/ledighet eller tidspunkt, eller når
 * verktøyene selv merket grunnlaget som planlagt/uavklart — aldri som et
 * generelt forbehold på hver melding. Småprat og avslag får aldri et.
 */
export function replyNotice(input: { userText: string; reply: string; answerType: string; provisional: boolean }): ReplyNotice | null {
  if (input.answerType !== "fact" && input.answerType !== "gap") return null;
  const text = `${input.userText}\n${input.reply}`;
  let kind: ReplyNoticeKind | null = null;
  if (SALES_WORDS.test(text)) kind = "sales";
  else if (TIMING_WORDS.test(text)) kind = "timing";
  else if (input.provisional && input.answerType === "fact") kind = "provisional";
  // En egen stripe hjelper bare når selve svaret mangler forbeholdet.
  // Modellen kan allerede ha sagt «forventet» eller henvist til salgsteamet;
  // å gjenta det rett under svaret gjør chatten tyngre uten å gjøre den tryggere.
  if (!kind || ALREADY_QUALIFIED[kind].test(input.reply)) return null;
  return { kind, text: NOTICE_TEXT[kind] };
}

/**
 * Fast svar når svaret nevner et årstall ingen verktøysvar i denne meldingen
 * har (2008-premisset). Modellens tekst slippes ikke gjennom: den kan ha
 * bekreftet brukerens premiss.
 */
export function unsupportedYearReply(years: readonly string[]): string {
  const list = years.length > 1 ? `${years.slice(0, -1).join(", ")} og ${years.at(-1)}` : years[0];
  return `Jeg finner ikke noe i kildene mine som bekrefter ${list}, så det vil jeg ikke gjette på. Salgsteamet kan gi deg oppdatert framdrift og innflytting, og i Boardet ser du hva som er ferdig og hva som er planlagt.`;
}

/** Fast svar når et faktasvar mangler verktøybevis (AE5/R9) — aldri modellens egen tekst. */
export const KNOWLEDGE_GAP_REPLY =
  "Jeg har ikke kildebelagt grunnlag for å svare sikkert på det akkurat nå. Prøv å omformulere spørsmålet, se hele nabolaget i Boardet, eller ta kontakt for et konkret svar.";

/** Fast svar ved teknisk feil mot modellen (timeout, API-feil, ugyldig modellsvar). */
export const BACKEND_ERROR_REPLY =
  "Chatten fikk ikke svar akkurat nå. Prøv igjen om litt, eller bruk Boardet eller kontaktveien i mellomtiden.";
