/**
 * Typografien i rapport-sidebaren, som delte klasser (2026-08-28).
 *
 * ## Hvorfor overskriftene ikke er eyebrows lenger
 *
 * Fire steder skrev samme overskrift på samme måte — 11 px, kapitéler, 0,18em
 * sperring, `stone-400` — og resultatet var at ingen av dem leste som en
 * overskrift. «SPØRSMÅL OG SVAR» sto svakere enn svarene under seg, og
 * «ANSVARLIG MEGLER» svakere enn plassholderteksten i kortet sitt (Andreas,
 * 2026-08-28: «alt er veldig lite synlig»). Eyebrow-formen MERKER en seksjon,
 * og det er riktig når seksjonen ellers er tydelig — men her var den det eneste
 * som skilte to blokker fra hverandre, og da må den bære.
 *
 * Overskriftene er derfor vanlig setningsform, samme størrelse som brødteksten,
 * halvfet og i tekstfargen: ingen kapitéler, ingen sperring.
 *
 * ## Hvorfor konstanter og ikke inline-klasser
 *
 * Fordi drift var problemet. Fire kallsteder må endres sammen, ellers har
 * sidebaren to slags overskrifter igjen — og det var nøyaktig tilstanden før
 * denne runden.
 */

/**
 * Seksjonsoverskrift: «Verdt å merke seg», «Spørsmål og svar»,
 * «I kartutsnittet», «Ansvarlig megler». Setter selv ingen margin — avstanden
 * ned til innholdet hører til seksjonen, ikke til teksten.
 */
export const SIDEBAR_SECTION_TITLE =
  "text-[16px] font-semibold leading-snug tracking-[-0.01em] text-stone-900";

/**
 * Brødtekst — strøkets og temaenes prosa.
 *
 * 14 px var for smått for en kolonne som ER lesestoffet (Andreas, 2026-08-28).
 * 16 px er også iOS' egen brødtekst-størrelse, og det betyr noe her: mobilens
 * sheet rendrer samme komponent (`StoryCard variant="sheet"`), så tallet gjelder
 * begge flatene.
 *
 * Fargen er et hakk mørkere enn før (`stone-700` mot `stone-600`) av samme grunn
 * som overskriftene ble sterkere: teksten er innholdet, ikke en undertekst til
 * noe annet.
 */
export const SIDEBAR_PROSE = "text-[16px] leading-[1.6] text-stone-700";
