/**
 * Nyhavnas egen talte hilsen – delt av klienten (som sender den som
 * `session.instructions.append` rett etter `session.started`) og
 * serverinstruksjonen, så de aldri sier ulike ting om språk og identitet.
 * Live har ingen `response.create` for hilsener og ingen «hilsen ferdig»-event;
 * mikrofonsporet må flyte hele tiden, også mens guiden hilser.
 *
 * Uten merkenavn: «Placy» er et engelsklignende ord som mistenkes for å dra
 * uttalen i første svar. Det er en HYPOTESE, ikke en dokumentert årsak til
 * dialektdrift – lyttetesten sammenligner med og uten (se
 * docs/research/nyhavna-leve-demo/lyttetest.md). Merkenavnet står fortsatt i
 * grensesnittet og produktet.
 *
 * ETT åpent spørsmål, ikke et intervju: svaret er det som avgjør hvilket tema
 * omvisningen begynner med (`set_interests`).
 *
 * Formen er den felles standardhilsenen i `board-greeting.ts` med Nyhavna som
 * sted. Konstanten er beholdt fordi Nyhavna-datasettets kunnskaps- og
 * paritetstester refererer den direkte.
 */
import {
  defaultGreetingInstruction,
  defaultGreetingText,
} from "@/lib/realtime/board-greeting";

export { greetingInstruction } from "@/lib/realtime/board-greeting";

export const NYHAVNA_GREETING_TEXT = defaultGreetingText("Nyhavna");

export const NYHAVNA_GREETING_INSTRUCTION = defaultGreetingInstruction("Nyhavna");
