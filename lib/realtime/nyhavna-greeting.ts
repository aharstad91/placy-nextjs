/**
 * Den talte hilsenen – delt av klienten (som sender den som
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
 */
export const NYHAVNA_GREETING_TEXT =
  "Hei! Jeg kan vise deg rundt på Nyhavna. Hva er viktigst for deg når du vurderer et nytt sted å bo?";

/**
 * Hilsenen som instruksjon til stemmen.
 *
 * Teksten er et argument og ikke en konstant fordi hilsenen hører til
 * DATASETTET: den lokale demoen oppgir sin i `board.json`. Reglene rundt den
 * (start nå, si den ordrett, ikke nevn noe navn, vent) er kodens og skal være
 * de samme uansett hvilket board som snakker.
 */
export const greetingInstruction = (text: string) =>
  `Begynn samtalen nå, uten å vente på brukeren. Si nøyaktig dette, på norsk: «${text}» Ikke nevn noe navn på deg selv. Vent så, og lytt. Ikke be backenden om hjelp før brukeren har svart.`;

export const NYHAVNA_GREETING_INSTRUCTION = greetingInstruction(NYHAVNA_GREETING_TEXT);
