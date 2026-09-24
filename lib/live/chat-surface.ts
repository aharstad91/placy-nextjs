import "server-only";

import { textChatTools } from "@/lib/demo/site-chat/text-tools";
import { LOCAL_VOICE_PACING } from "@/lib/demo/local-board/voice-instructions";
import type { LiveConversation, LiveFunctionTool } from "@/lib/live/types";
import type { TranscriptTurn } from "@/lib/demo/site-chat/transcript";

/**
 * Stemmen i chatboksen (2026-09-24), felles for alle kunder: samme Live-rute og
 * samme datasett som kundens board, men en flate UTEN kart. Hvilke datasett som
 * har en chatboks, og kundens stedsnavn og kontaktperson, kommer fra
 * kunderegisteret (`lib/demo/site-chat/customers.ts`) — ikke herfra.
 *
 * ## Den semantiske grensen
 *
 * Boardets Anja styrer kartet: verktøylista har `MAP_TOOLS` og
 * presentasjonsverktøyene, backend-instruksen ber om `show_category` og
 * `highlight_places`, og temaverktøyene returnerer kartdirektiver serveren selv
 * sender til nettleseren. Chatboksen har ingen nettleserbro som kan utføre noe
 * av det. Et direktiv som ble sendt ville ventet på et kart som ikke finnes,
 * og et «jeg viser deg det i kartet» ville vært usant.
 *
 * Denne flaten gir derfor:
 * - bare rene oppslag (samme filter som tekstchatten, `textChatTools`);
 * - en samtale der serverens egne kartdirektiver, kartnotater og
 *   «Kartet fremhever nå …»-instrukser er fjernet før noe når modellen;
 * - en egen, kort stemmeinstruks og et tillegg til backend-instruksen som
 *   sier at kartreglene over ikke gjelder.
 *
 * ## Én samtale med tekstchatten
 *
 * Starter talen med et gyldig, signert historikktoken fra tekstchatten
 * (`lib/demo/site-chat/transcript.ts`), legges de verifiserte turene
 * inn som Live-sesjonens `session.input` (`chatSurfaceHistoryInput`), og
 * instruksen sier at samtalen fortsetter. Uten gyldig token er talen en ny
 * samtale, og instruksen sier at Anja ikke skal late som hun husker noe.
 */

export const CHAT_SURFACE = "chat";

/** Det stemmen trenger fra kundens profil (`SiteChatVoiceProfile`). */
export interface ChatSurfaceVoice {
  placeName: string;
  salesContact: string;
}

export function chatSurfaceTools(tools: readonly LiveFunctionTool[]): LiveFunctionTool[] {
  return textChatTools(tools);
}

/** Tar bort kartlovnader fra et verktøysvar: `instruction` er skrevet for et synlig kart. */
function withoutMapInstruction(result: unknown): unknown {
  if (!result || typeof result !== "object" || Array.isArray(result)) return result;
  if (!("instruction" in result)) return result;
  const rest = { ...(result as Record<string, unknown>) };
  delete rest.instruction;
  return rest;
}

/**
 * Samme samtaletilstand som boardet, uten kartsiden. Kartdirektiver droppes,
 * kartnotater til stemmen og backenden sendes aldri, og et kartvalg fra
 * flaten (som chatten uansett ikke sender) blir ignorert.
 */
export function chatSurfaceConversation(conversation: LiveConversation): LiveConversation {
  return {
    async execute(name, args) {
      const outcome = await conversation.execute(name, args);
      return { result: withoutMapInstruction(outcome.result) };
    },
    observeBrowserResult: () => {},
    // Omvisningsnotatet lister «Fremhevet i kartet»; i chatten er det feil.
    noteIfChanged: () => null,
    mapContextIfChanged: () => null,
    onMapSelection: () => null,
    setBoardState: () => {},
  };
}

/** Live-grensen for `session.input` er 128 meldinger; tokenets vindu (40 turer) ligger langt under. */
const LIVE_INPUT_MAX_MESSAGES = 128;

/**
 * Verifiserte turer som Live-meldinger (`session.input`). Bare turer fra et
 * signert token kommer hit — aldri klientens bobler.
 */
export function chatSurfaceHistoryInput(turns: readonly TranscriptTurn[]) {
  return turns.slice(-LIVE_INPUT_MAX_MESSAGES).map((turn) => ({
    type: "message" as const,
    role: turn.role,
    content: [{ type: turn.role === "user" ? ("input_text" as const) : ("output_text" as const), text: turn.text }],
  }));
}

export const CHAT_SURFACE_CONTINUED_BACKEND_ADDENDUM =
  "- Samtalen fortsetter fra chatboksen: de tidligere meldingene (skrevne og eventuelt talte) er med i samtalen. Bruk dem til å forstå hva brukeren viser til, men hent fakta med verktøyene.";

/** Tillegget til backend-instruksen for chatflaten, med kundens kontaktperson. */
export function chatSurfaceBackendAddendum(voice: Pick<ChatSurfaceVoice, "salesContact">): string {
  return CHAT_SURFACE_BACKEND_ADDENDUM.replace("{{salesContact}}", voice.salesContact);
}

const CHAT_SURFACE_BACKEND_ADDENDUM = `
FLATE: CHATBOKS UTEN KART. Denne talesamtalen foregår i en chatboks på nettsiden, ikke i boardet. Reglene under går foran alt over som handler om kart.
- Det finnes ikke noe kart, sidepanel eller markører. Verktøyene show_category, show_place, highlight_places, clear_highlights, reset_board, set_travel_mode og present_neighbourhood finnes ikke her. Ikke be om dem, og ikke si at noe vises, fremheves, åpnes eller kan trykkes på.
- Fokus er nabolaget og hvordan det er å bo her: hverdagen, reisetider, skoler og barnehager, dagligvarer, turområder og det som finnes i nærheten. Svar kort, med de viktigste stedene og reisetidene fra verktøysvarene.
- Pris, ledighet, salgsstatus og innflytting kjenner du ikke; henvis til {{salesContact}}.
- Bruk bare fakta fra verktøysvarene. Skill mellom det som finnes i dag og det som er planlagt.
`.trim();

/** Kort stemmeinstruks for chatflaten. Boardets instruks er skrevet for en kartomvisning. */
export function chatSurfaceVoiceInstructions(voice: ChatSurfaceVoice, options: { continued?: boolean } = {}): string {
  const name = voice.placeName;
  const history = options.continued
    ? "Samtalen fortsetter fra chatboksen: meldingene før talen (skrevne og eventuelt talte) ligger i samtalehistorikken. Bygg videre på dem uten å gjenta deg selv, og ikke si at dette er en ny samtale. Du har bare de siste delene av samtalen; viser brukeren til noe du ikke finner der, si det kort og be dem si det igjen. Brukeren kan også skrive meldinger under talesamtalen; de er en del av samme samtale."
    : "Dette er en ny samtale. Du ser ikke det brukeren eventuelt har skrevet i tekstchatten før talen startet. Viser brukeren til noe tidligere, si kort at du ikke ser den tekstsamtalen, og be dem si det igjen. Brukeren kan også skrive meldinger under talesamtalen; de er en del av denne samtalen.";
  return `Du heter Anja og er en digital AI-guide fra Placy som svarer på spørsmål om ${name} og nabolaget rundt. Samtalen skjer i en chatboks på nettsiden, uten kart. Vær varm, rolig og konkret. Du er ikke ansatt hos utbygger eller megler, og har ingen egne opplevelser av stedene. Snakk norsk bokmål. ${LOCAL_VOICE_PACING}

${history}

Hovedspørsmålet er «Hvordan er det å bo her?». Svar på det brukeren spør om. Ved et bredt spørsmål, gi to knagger: «Vil du begynne med det praktiske, som transport og dagligvarer, eller med turområder og ting å gjøre?» og vent på valget. Hold svarene korte: to til fire setninger, så stopp og la brukeren spørre videre.

Deleger til backenden når du trenger fakta om steder, reisetider, skoler, tilbud eller prosjektet. Ikke deleger når brukeren bare hilser, nøler eller ber deg vente. Bruk én kort ventefrase ved merkbar venting, som «La meg se» eller «Jeg finner fram det», og ikke samme frase to ganger på rad.

Bruk bare fakta backenden har gitt. Si stedets navn sammen med reisetid og reisemåte. Skill mellom det som finnes i dag og det som er planlagt. Det finnes ikke noe kart: ikke si at noe vises, fremheves eller kan trykkes på, og ikke si at du ser i kartet. Pris, ledighet og innflytting bekrefter ${voice.salesContact}. Ikke nevn demo, register eller kildegrunnlag.`;
}
