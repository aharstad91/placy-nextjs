/**
 * Parser for de cachede åpningstidene (`pois.opening_hours_json.weekday_text`)
 * — så FAQ-en kan svare på «kan jeg trene sent?» og «er noe åpent på søndag?».
 *
 * KILDEN ER GOOGLES VISNINGSSTRENGER, IKKE STRUKTURERTE DATA. `weekday_text`
 * er sju linjer ment for øyne («Monday: 5:00 AM – 12:00 AM»), og formatet
 * varierer med språket kallet ble gjort på — engelsk AM/PM med U+202F/U+2009
 * som mellomrom, eller norsk 24-timers («mandag: 07:00–23:00»). Begge støttes.
 *
 * KONSERVATIV MED VILJE: en linje som ikke matcher mønstrene gir `null` for
 * den dagen, og et sted med flere intervaller per dag (lunsjstengt) gir også
 * `null` — å slå sammen «11–14, 17–21» til «11–21» ville påstått at stedet er
 * åpent klokka 15. Regelen er den samme som i resten av FAQ-en: mangler
 * faktumet, utelates svaret. Et tall leseren kan etterprøve må stemme.
 *
 * Døgnåpent representeres som 00:00–24:00 — da faller «åpner tidlig» og
 * «stenger sent» ut av samme sammenlikninger som alle andre tider.
 */

/** Én dags åpningstid, i minutter fra midnatt. `close` kan være 1440 (24:00). */
export interface DayHours {
  openMin: number;
  closeMin: number;
}

/** Stengt er et faktum, uparselig er fravær av faktum — de må kunne skilles. */
export type ParsedDay = DayHours | "closed" | null;

const RANGE_RE =
  /^(\d{1,2})[:.](\d{2})(?:\s*(AM|PM))?\s*[–—-]\s*(\d{1,2})[:.](\d{2})(?:\s*(AM|PM))?$/i;

function toMinutes(hour: number, minute: number, ampm: string | undefined): number | null {
  let h = hour;
  if (ampm) {
    const upper = ampm.toUpperCase();
    if (h < 1 || h > 12) return null;
    if (upper === "AM") h = h === 12 ? 0 : h;
    else h = h === 12 ? 12 : h + 12;
  }
  if (h > 24 || minute > 59) return null;
  return h * 60 + minute;
}

/**
 * Én `weekday_text`-linje → dagens tider. Dag-prefikset («Monday: », «mandag: »)
 * strippes på første kolon — dagnavnet trengs ikke, rekkefølgen i lista er
 * alltid mandag først (Google Places-kontrakten).
 */
export function parseWeekdayLine(line: string): ParsedDay {
  const idx = line.indexOf(": ");
  if (idx === -1) return null;
  // Googles engelske strenger bruker U+202F (narrow no-break) og U+2009 (thin).
  const value = line
    .slice(idx + 2)
    .replace(/[   ]/g, " ")
    .trim();

  if (/^(closed|stengt)$/i.test(value)) return "closed";
  if (/^(open 24 hours|døgnåpent)$/i.test(value)) return { openMin: 0, closeMin: 1440 };
  // Flere intervaller (lunsjstengt) — å slå dem sammen ville diktet en åpningstid.
  if (value.includes(",")) return null;

  const m = RANGE_RE.exec(value);
  if (!m) return null;
  // Google deler markøren når begge tidene er på samme halvdel av døgnet:
  // «Sunday: 1:00 – 10:00 PM» betyr 13–22. En åpningstid uten egen markør
  // arver derfor stengetidens — ellers leses «1:00» som klokka 01 om natta.
  const openMarker = m[3] ?? m[6];
  const open = toMinutes(Number(m[1]), Number(m[2]), openMarker);
  let close = toMinutes(Number(m[4]), Number(m[5]), m[6]);
  if (open === null || close === null) return null;
  // «12:00 AM» som stengetid er midnatt i slutten av dagen, ikke starten.
  if (close === 0) close = 1440;
  if (close <= open) return null; // over midnatt (nattklubb) — utenfor det vi lover
  return { openMin: open, closeMin: close };
}

/** Alle sju dagene, mandag først. Kortere/lengre liste enn 7 gir tom hånd. */
export function parseWeekdayText(weekdayText: readonly string[] | undefined): ParsedDay[] | null {
  if (!weekdayText || weekdayText.length !== 7) return null;
  return weekdayText.map(parseWeekdayLine);
}

/**
 * Hverdagenes felles åpningstid (man–fre), eller null når de spriker eller
 * noen av dem ikke lot seg lese. «Åpent 05–23 på hverdager» er bare sant når
 * alle fem hverdagene faktisk sier det samme.
 */
export function weekdayConsensus(days: readonly ParsedDay[]): DayHours | null {
  const weekdays = days.slice(0, 5);
  const first = weekdays[0];
  if (!first || first === "closed") return null;
  for (const day of weekdays.slice(1)) {
    if (!day || day === "closed") return null;
    if (day.openMin !== first.openMin || day.closeMin !== first.closeMin) return null;
  }
  return first;
}

/** Søndagens tider — indeks 6 i mandag-først-lista. */
export function sundayHours(days: readonly ParsedDay[]): ParsedDay {
  return days[6] ?? null;
}

/**
 * «05–23», «11–23», «07.30–15», «05–24». Hele timer uten minutter — det er
 * slik åpningstider skrives på en dør, og det er presisjonen kilden har.
 */
export function formatHourRange(hours: DayHours): string {
  const part = (min: number) => {
    const h = Math.floor(min / 60);
    const m = min % 60;
    const hh = String(h).padStart(2, "0");
    return m === 0 ? hh : `${hh}.${String(m).padStart(2, "0")}`;
  };
  return `${part(hours.openMin)}–${part(hours.closeMin)}`;
}
