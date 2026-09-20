/**
 * Den talte åpningen, uten prosjektnavn i koden.
 *
 * Hilsenen er INNHOLD: et board oppgir sin egen i `assistant.greeting` (ordinære
 * boards) eller i datasettets `board.json` (lokale demoer). Reglene rundt den
 * (start nå, si den ordrett, ikke legg til navn, vent) er kodens og skal være de
 * samme uansett hvilket board som snakker.
 *
 * Fallbacken var tidligere Nyhavnas egen hilsen. Det betydde at et hvilket som
 * helst annet prosjekt uten egen hilsen ville presentere seg som Nyhavna —
 * funnet da Lillebytunet ble kjørt gjennom den samme standardboard-harnessen.
 * Fallbacken navngir nå boardets eget sted og påstår ingenting om det.
 */
export const greetingInstruction = (text: string) =>
  `Begynn samtalen nå, uten å vente på brukeren. Si nøyaktig dette, på norsk: «${text}» Ikke legg til andre navn enn de som står i hilsenen. Vent så, og lytt. Ikke be backenden om hjelp før brukeren har svart.`;

/** Standardhilsen for et board som ikke har fått sin egen. */
export const defaultGreetingText = (placeName: string) =>
  `Hei! Jeg kan vise deg rundt på ${placeName}. Hva er viktigst for deg når du vurderer et nytt sted å bo?`;

/** Standardhilsen som ferdig instruksjon til stemmen. */
export const defaultGreetingInstruction = (placeName: string) =>
  greetingInstruction(defaultGreetingText(placeName));
