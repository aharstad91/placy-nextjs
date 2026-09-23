/**
 * Siste vask av teksten før den forlater serveren (2026-09-23).
 *
 * Widgeten setter ALLTID svaret med `textContent` (aldri `innerHTML`), så en
 * `<script>` i teksten kan aldri kjøre uansett. Denne funksjonen er likevel
 * forsvar i dybden mot en fremtidig konsument som er mindre forsiktig: den
 * fjerner kontrolltegn (bortsett fra linjeskift) og kapper lengden. Den
 * fjerner IKKE vanlig tekst med skarpe eller krøllparenteser — det er ikke
 * jobben til dette laget; jobben er at teksten aldri blir kjørbar kode eller
 * inneholder rå styretegn en terminal/skjermleser kan mistolke.
 */
const MAX_REPLY_LENGTH = 1200;

export function sanitizeReply(text: string): string {
  const withoutControlChars = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
  const collapsed = withoutControlChars.replace(/[ \t]+/g, " ").trim();
  return collapsed.length > MAX_REPLY_LENGTH ? `${collapsed.slice(0, MAX_REPLY_LENGTH)}…` : collapsed;
}
