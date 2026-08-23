/**
 * «Neste hverdag klokka 08:00 i Norge», som et absolutt tidspunkt.
 *
 * HVORFOR DETTE IKKE ER `d.setHours(8, 0, 0, 0)`: bygg og provisjonering kjører
 * i UTC (Vercel, CI, cron), og der gir setHours 08:00 UTC — altså 10:00 norsk
 * tid om sommeren. Transittfaktaene vi henter ville da beskrevet en helt annen
 * time enn skoleveien de skal svare på, uten at noe feilet.
 *
 * Rushtiden er valgt bevisst: linjer og reisetider varierer med tid på døgnet,
 * og en boligkjøpers spørsmål («hvor lang tid tar det til byen?») handler om
 * hverdagsmorgenen, ikke om natta. Helg er utelatt av samme grunn.
 *
 * Ingen tidssone-avhengighet: offsetet leses ut av `Intl` for den konkrete
 * datoen, så sommertid håndteres uten en tabell noen må vedlikeholde.
 */

const OSLO = "Europe/Oslo";

/** Klokkeslettet transittfaktaene hentes for. Rushtid på en hverdagsmorgen. */
export const RUSHTIME_HOUR = 8;

interface OsloParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** 0 = søndag, 6 = lørdag — samme koding som `Date.getDay()`. */
  weekday: number;
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

const FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: OSLO,
  hour12: false,
  weekday: "short",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/** Veggklokka i Oslo for et gitt absolutt tidspunkt. */
export function osloParts(instant: Date): OsloParts {
  const parts = Object.fromEntries(
    FORMATTER.formatToParts(instant).map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    // Intl gir «24» for midnatt i hour12:false — normaliser til 0.
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekday: WEEKDAY_INDEX[parts.weekday] ?? 0,
  };
}

/**
 * Det absolutte tidspunktet der veggklokka i Oslo viser den oppgitte datoen og
 * timen.
 *
 * To passeringer: første gjetning antar UTC, andre korrigerer med det faktiske
 * offsetet på den datoen. Én runde holder overalt bortsett fra i selve
 * omstillingstimen, og der er en times avvik på et representativt
 * avreisetidspunkt uten betydning.
 */
function osloWallClockToInstant(
  year: number,
  month: number,
  day: number,
  hour: number,
): Date {
  const guess = Date.UTC(year, month - 1, day, hour, 0, 0);
  const seen = osloParts(new Date(guess));
  const seenAsUtc = Date.UTC(
    seen.year,
    seen.month - 1,
    seen.day,
    seen.hour,
    seen.minute,
    seen.second,
  );
  return new Date(guess - (seenAsUtc - guess));
}

/**
 * Neste hverdag kl. 08:00 norsk tid, som ISO-8601 med offset (`…+02:00`) —
 * formen Enturs `DateTime`-skalar tar imot.
 *
 * «Neste» betyr alltid en dag FRAM: kjører provisjoneringen mandag 07:00 er
 * svaret tirsdag, ikke samme dag. Det er med vilje — et tidspunkt som allerede
 * er passert når faktaene brukes ville gjort dem uleselige å etterprøve.
 *
 * @param now Injiserbar for tester. Default: nå.
 */
export function nextWeekdayRushHour(now: Date = new Date()): string {
  const here = osloParts(now);
  // Start på morgendagen i Oslo-kalenderen og gå fram til første hverdag.
  const cursor = new Date(Date.UTC(here.year, here.month - 1, here.day));
  for (let i = 0; i < 8; i++) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const y = cursor.getUTCFullYear();
    const m = cursor.getUTCMonth() + 1;
    const d = cursor.getUTCDate();
    const instant = osloWallClockToInstant(y, m, d, RUSHTIME_HOUR);
    const weekday = osloParts(instant).weekday;
    if (weekday >= 1 && weekday <= 5) return toOffsetIso(instant);
  }
  // Uoppnåelig: åtte dager inneholder alltid en hverdag. Kaster framfor å
  // returnere et tidspunkt ingen har regnet på.
  throw new Error("Fant ingen hverdag innen åtte dager — sjekk systemklokka");
}

/** `2026-08-24T08:00:00+02:00`. Offsetet leses av Oslo-veggklokka, ikke antatt. */
function toOffsetIso(instant: Date): string {
  const p = osloParts(instant);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  const offsetMinutes = Math.round((asUtc - instant.getTime()) / 60_000);
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${p.year}-${pad(p.month)}-${pad(p.day)}` +
    `T${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}
