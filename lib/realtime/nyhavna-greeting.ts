/**
 * Den talte hilsenen – delt av klienten (som ber om den i `response.create`) og
 * serverinstruksjonen, så de aldri sier ulike ting om språk og identitet.
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

export const NYHAVNA_GREETING_INSTRUCTION = `Si nøyaktig, på norsk og med samme stemme og uttale som resten av samtalen: «${NYHAVNA_GREETING_TEXT}» Ikke nevn noe navn på deg selv. Ikke kall verktøy før brukeren har svart.`;
