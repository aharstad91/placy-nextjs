/**
 * Spørsmålsforslagene i Nyhavna-chattens temarad (2026-09-24), per stabil
 * kategori-ID i `data/demo/nyhavna-lokal/board.json`.
 *
 * Kategoriene selv (navn, ikon, farge) leses fra boardet. Hvert spørsmål peker
 * på noe datasettet dekker — et tema i `topics.json` eller steder i
 * `places.json` — slik at et forslag ikke inviterer til et kunnskapshull.
 * `categories.test.ts` holder ID-ene i takt med boardet.
 */
export const NH_CATEGORY_QUESTIONS: Readonly<Record<string, readonly [string, string, string]>> = {
  "nyhavna-bydel": [
    "Hva planlegges på Nyhavna?",
    "Hva er Transittkaia?",
    "Hva er Bunkerkvartalet?",
  ],
  hverdagsliv: [
    "Hvor handler vi dagligvarer?",
    "Finnes det et apotek i nærheten?",
    "Hva finner jeg på Solsiden senter?",
  ],
  "barn-oppvekst": [
    "Hvilke skoler er aktuelle?",
    "Hvilke barnehager finnes i nærområdet?",
    "Hvor kan barna leke ute?",
  ],
  "mat-drikke": [
    "Hvor finner vi kaféer og bakerier?",
    "Hvilke restauranter finnes i nærheten?",
    "Hva vet dere om Dora Kaffebar?",
  ],
  "natur-friluftsliv": [
    "Hvor kommer vi inn på Ladestien?",
    "Hvilke parker ligger i nærheten?",
    "Hva vet dere om Korsvika?",
  ],
  transport: [
    "Hvor er nærmeste holdeplass?",
    "Hvordan kommer vi oss til sentrum?",
    "Kan vi bruke bildeling?",
  ],
  "trening-aktivitet": [
    "Hvilke treningssentre finnes i nærheten?",
    "Hvor kan vi spille padel?",
    "Finnes det en bokseklubb i nærheten?",
  ],
  opplevelser: [
    "Hva kan vi gjøre som familie i nærområdet?",
    "Hva er Rockheim?",
    "Hva vet dere om HAVET Arena?",
  ],
};
