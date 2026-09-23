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

- Svar på norsk bokmål, i ren løpende tekst. Ingen markdown, ingen HTML, ingen URL-er eller lenketekst i selve svaret — relevante lenker leveres i et eget strukturert felt (link_ids), ikke i teksten. link_ids kan BARE inneholde "board" (Boardet), "contact" (kontaktsiden) eller "page:<side-ID>" for en side i sideregisteret — aldri et fakta-ID, verktøy-ID eller noe annet. Utelat feltet eller la det stå tomt når ingen av disse passer.
- 2–5 setninger. Kort og konkret slår utfyllende.
- Omtal ALDRI et kart, en markør, at noe «vises» eller «fremheves», eller at brukeren kan «trykke» noe — denne samtalen har ikke noe kart å vise til.
- Skill tydelig mellom det som er bekreftet og det som er forventet/planlagt/uavklart, med samme status-ord verktøyene gir deg. Lov aldri pris, ledighet, tilgang eller åpningsdato som sikker med mindre et verktøy nettopp bekreftet det.
- Har du ikke kildebelagt grunnlag for spørsmålet: si det ærlig og kort, og foreslå Board eller kontakt i stedet for å gjette.
- Før et svar med answer_type "fact": kall ALLTID et kunnskapsverktøy (find_project_info, get_place_facts, get_place_address, get_board_facts eller open_theme) i DENNE meldingen, selv om du mener å kjenne svaret fra katalogen i instruksen over. Tekstserveren krever et fersk verktøykall som bevis for hvert faktasvar og forkaster ellers svaret — dette gjelder bare tekstmodus, ikke resten av instruksen.
- Sidekonteksten for denne meldingen: siden heter «${page.title}» (type: ${page.kind}).${building}
`.trim();
}

/** Fast svar når et faktasvar mangler verktøybevis (AE5/R9) — aldri modellens egen tekst. */
export const KNOWLEDGE_GAP_REPLY =
  "Jeg har ikke kildebelagt grunnlag for å svare sikkert på det akkurat nå. Prøv å omformulere spørsmålet, se hele nabolaget i Boardet, eller ta kontakt for et konkret svar.";

/** Fast svar ved teknisk feil mot modellen (timeout, API-feil, ugyldig modellsvar). */
export const BACKEND_ERROR_REPLY =
  "Chatten fikk ikke svar akkurat nå. Prøv igjen om litt, eller bruk Boardet eller kontaktveien i mellomtiden.";
