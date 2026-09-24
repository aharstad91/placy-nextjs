/**
 * Leangenbuktas spørsmålsforslag i temaraden (2026-09-24), per stabil
 * kategori-ID. Selve raden bygges av `lib/demo/site-chat/categories.ts`.
 *
 * Kategoriene (id, navn, ikon, farge) leses fra `loadLiveDemo`s board — ikke
 * en egen liste her. Bare spørsmålene er demo-spesifikke, knyttet til den
 * stabile kategori-ID-en. Et tema uten spørsmål her vises ikke i raden.
 *
 * Temavalget styrer bare forslagene; Anja har samme kunnskap uansett tema.
 * Spørsmålene lover derfor ingenting om pris, ledighet eller andre salgstall
 * i sanntid — de peker på det datasettet faktisk dekker.
 */
export const CATEGORY_QUESTIONS: Readonly<Record<string, readonly [string, string, string]>> = {
  "leangenbukta-prosjektet": [
    "Hva er Leangenbukta?",
    "Hvilke bygg består Leangenbukta av?",
    "Hvilke fellesarealer får beboerne?",
  ],
  hverdag: [
    "Hvilke dagligvarebutikker finnes på Lade?",
    "Hva finner jeg på City Lade?",
    "Hvilke apotek er omtalt i området?",
  ],
  oppvekst: [
    "Hva vet dere om Lade skole?",
    "Hvilke barnehager ligger i nærheten?",
    "Hvor kan barna leke ute?",
  ],
  servering: [
    "Hvor kan vi spise ved sjøen?",
    "Finnes det et bakeri i nærheten?",
    "Hva vet dere om Ladekaia?",
  ],
  natur: [
    "Hvilke badeplasser er omtalt i nærområdet?",
    "Hva er Ringve botaniske hage?",
    "Hva vet dere om Korsvika?",
  ],
  transport: [
    "Hva vet dere om Leangen stasjon?",
    "Hvilken sykkelforbindelse er planlagt?",
    "Hvordan kommer jeg meg til sentrum uten bil?",
  ],
  trening: [
    "Hvilke treningssentre er omtalt i området?",
    "Hva finnes i Leangen idrettspark?",
    "Hvor kan vi gå på skøyter?",
  ],
  opplevelser: [
    "Hva kan barnefamilier finne på i nærheten?",
    "Hva er Ringve Musikkmuseum?",
    "Finnes det et lekeland innendørs i nærheten?",
  ],
};
