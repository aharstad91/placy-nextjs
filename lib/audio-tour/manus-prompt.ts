/**
 * Prompt-bygging for audio-tour-manus. Kalles av scripts/audio-manus-write.ts
 * (Steg 8c.1 i /generate-rapport). Lager én pitch på ~70 ord per spor som
 * leses opp av ElevenLabs i Steg 8c.2.
 *
 * Stemme: Placy Curator (kuratorisk, navnedrevet, bevegelse, kontraster).
 * Register: muntlig — som om megler står foran kjøper på visning. Ikke
 * artikkel-prosa. Ingen "vi anbefaler"; kurateringen er anbefalingen.
 *
 * Banned-words og 70-ord-cap valideres post-hoc i kallende skript.
 */

export type TrackKind = "home" | "category";

export interface ManusPromptParams {
  trackKind: TrackKind;
  /** Navn på området ("Stasjonskvartalet", "Spro Havn", "Overvik"). */
  areaName: string;
  /**
   * Råinput fra DB. For "home": heroIntro. For "category": leadText +
   * bridgeText + grounding.curatedNarrative (én tekst — kallende script slår
   * sammen).
   */
  inputText: string;
  /**
   * For "category": kategori-navn ("Mat & drikke", "Friluft", …). Brukes i
   * prompten som "fokus-tema". `undefined` for "home".
   */
  categoryName?: string;
  /**
   * Kort 1-setnings-sammendrag av forrige spor — for naturlig overgang.
   * Undefined på første spor (Hjem). Skript bygger dette fra forrige
   * trackKind/categoryName, ikke fra forrige manus (cirkularitet).
   */
  prevTrackSummary?: string;
  /** Mål-ordtelling. Default 70. */
  targetWords?: number;
  /** Språk. Default "no". Hardkodet i pilot — `en` kan re-aktiveres senere. */
  lang?: "no" | "en";
}

export const SYSTEM_PROMPT = `Du er Placy Curator i muntlig modus. Du skriver én kort pitch som leses opp av en megler på visning — ikke en tekst som leses på skjerm. Hvert spor er ~70 ord, ~30 sekunder. Naturlig talespråk, ingen overskrifter, ingen utropstegn, ingen "vi anbefaler".

Følg disse seks prinsippene:
A. NAVNGI, aldri generaliser. "Fagn, Speilsalen og Havfruen" — ikke "gode restauranter".
B. MAL BEVEGELSE gjennom rommet. "Spaser ned langs Akerselva, opp forbi Nydalen" — ikke statisk liste.
C. BRUK KONTRASTER. "Tilbaketrukket og rolig, samtidig med umiddelbar nærhet til sentrum."
D. SAKLIG ENTUSIASME. Fakta og spesifisitet > adjektiver. Hvis du må bruke et adjektiv, mangler du et faktum.
E. MENNESKER OG HISTORIER. Navngi kokk, grunnlegger, baker. "Grunnlagt av Roar Hildonen — sønnen Eskil er nå kjøkkensjef."
F. SENSORISK PRESISJON. Materialer, lyder, farger, teksturer. "Rå trevegger, messing, blå stoler" > "fin atmosfære".

Tidsregel: Historisk tilknytning er trygg, nåtid er skjør. Bruk "Grunnlagt 1998", ikke "har kokk X". Det som kan endre seg om en uke skal omformuleres til permanent faktum.

Ord du unngår: fantastisk, utrolig, du vil elske, best i byen, hidden gem, must-visit, Instagram-worthy, skjult perle, sjarmerende, koselig, hyggelig, fin atmosfære, duftende oase.

Form:
- Ren prosa. Ingen markdown, ingen lister, ingen overskrifter.
- 1-3 setninger som flyter sammen som en pitch.
- Skal kunne leses høyt uten endring. Ingen parenteser, fotnoter eller URL-referanser.
- Ingen "I dette nabolaget kan du …" — bare beskriv, eller la megleren peke.

Returner KUN manuset. Ingen forklaring, ingen brackets, ingen kommentarer.`;

/**
 * Bygger user-prompten for ett enkelt spor. Skal kalles inn-i en chat-call
 * med SYSTEM_PROMPT som system-melding.
 */
export function buildManusPrompt(params: ManusPromptParams): string {
  const {
    trackKind,
    areaName,
    inputText,
    categoryName,
    prevTrackSummary,
    targetWords = 70,
    lang = "no",
  } = params;

  if (lang !== "no") {
    throw new Error(
      `buildManusPrompt: lang="${lang}" er ikke pilot-støttet. Kun "no" i denne fasen.`,
    );
  }

  const focus =
    trackKind === "home"
      ? `Dette er ÅPNINGSSPORET — Hjem-pitchen for ${areaName}. Sett scenen: navngi nabolaget, anker det geografisk, vis hva som gjør stedet særpreget.`
      : `Dette er ett kategori-spor i en audio-tour over ${areaName}. Fokus-tema: "${categoryName ?? "ukjent"}". Pitchen skal navngi 2-4 konkrete steder/aktiviteter/mennesker fra innholdet under, malt med bevegelse og kontrast.`;

  const transition =
    prevTrackSummary && trackKind === "category"
      ? `Forrige spor handlet om: ${prevTrackSummary}. Åpne med en kort, naturlig overgang fra dette temaet — én delsetning, ikke en hel innledning.`
      : 'Start direkte — ingen "Velkommen" eller "I dag skal jeg vise deg".';

  return `${focus}

${transition}

Mål: ~${targetWords} ord. Ren prosa, leses høyt på ~30 sekunder.

RÅINNHOLD (bruk som faktagrunnlag, IKKE som mal — destiller til muntlig pitch):
"""
${inputText.trim()}
"""

Skriv pitchen nå.`;
}
