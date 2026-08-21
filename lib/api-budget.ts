/**
 * Hardt tak på betalte API-kall — per døgn, delt av alle scripts.
 *
 * BAKGRUNN (2026-08-14): en dags arbeid brukte 722 Gemini grounding-kall og
 * ~485 Places-kall uten at noe i koden kunne stoppet det. Eneste bremsen var at
 * Google selv svarer 403/429. Andreas: «vi må ha maks cap så vi ikke bruker
 * penger på dette her.»
 *
 * DESIGN — hvorfor taket ligger her og ikke i hvert script:
 *   Et tak per script glipper neste gang noen skriver et nytt script. Denne
 *   modulen kalles rett før hvert utgående kall, så et nytt kallsted må aktivt
 *   omgå den for å slippe unna.
 *
 * DØGN, IKKE KJØRING: et per-kjøring-tak stopper ikke ti kjøringer etter
 * hverandre. Regnskapet føres derfor i en fil per dato.
 *
 * APPEND-ONLY: flere scripts kan kjøre samtidig (det gjorde de i dag). En
 * les-endre-skriv mot samme JSON ville mistet kall i kappløpet, så hver
 * belastning skrives som én linje og summeres ved lesing.
 */

import * as fs from "node:fs";
import * as path from "node:path";

/**
 * SKU-ene vi faktisk betaler for. Delt opp etter prisnivå, ikke etter
 * endepunkt: hele kallet faktureres på det HØYESTE nivået noe felt i
 * feltmasken tilhører (funn 2026-08-12), så `places-details-enterprise` og
 * `places-details-essentials` er to ulike penger.
 */
export const API_SKUS = [
  "gemini-grounding",
  "gemini-video",
  "gemini-image",
  "places-nearby",
  "places-text",
  "places-details-enterprise",
  "places-details-essentials",
  "places-photo",
] as const;

export type ApiSku = (typeof API_SKUS)[number];

/**
 * Døgntak. Bevisst konservative: de skal stoppe en løpsk løkke, ikke tillate
 * en stor planlagt kjøring. Trenger du mer, hev taket eksplisitt for den
 * kjøringen — det er da et valg, ikke et uhell.
 *
 * `gemini-video` står på 0 med vilje: Veo koster i en helt annen størrelsesorden
 * enn resten, og skal aldri kunne fyre av utilsiktet.
 */
export const DEFAULT_DAILY_CAPS: Record<ApiSku, number> = {
  "gemini-grounding": 1200, // gratiskvoten er 1 500/døgn — vi holder margin
  "gemini-video": 0,
  "gemini-image": 50,
  "places-nearby": 400,
  "places-text": 200,
  "places-details-enterprise": 600,
  "places-details-essentials": 1000,
  "places-photo": 1000,
};

/** Grov USD per 1 000 kall — kun for rapportering, ikke for håndheving. */
export const USD_PER_1000: Record<ApiSku, number> = {
  "gemini-grounding": 35,
  "gemini-video": 400,
  "gemini-image": 30,
  "places-nearby": 32,
  "places-text": 32,
  "places-details-enterprise": 17,
  "places-details-essentials": 0,
  "places-photo": 3,
};

export class ApiBudgetExceededError extends Error {
  constructor(
    readonly sku: ApiSku,
    readonly brukt: number,
    readonly tak: number,
    readonly forsokt: number,
  ) {
    super(
      `API-taket for «${sku}» er nådd: ${brukt}/${tak} kall brukt i dag, forsøkte ${forsokt} til. ` +
        `Hev med ${envVarForSku(sku)}=<antall> for denne kjøringen hvis det er et bevisst valg.`,
    );
    this.name = "ApiBudgetExceededError";
  }
}

export function envVarForSku(sku: ApiSku): string {
  return `PLACY_CAP_${sku.toUpperCase().replace(/-/g, "_")}`;
}

/** Taket for en SKU: env-overstyring hvis satt og gyldig, ellers default. */
export function capForSku(
  sku: ApiSku,
  env: Record<string, string | undefined> = process.env,
): number {
  const raw = env[envVarForSku(sku)];
  if (raw === undefined) return DEFAULT_DAILY_CAPS[sku];
  const parsed = Number(raw);
  // En ugyldig verdi må ikke tolkes som «ubegrenset» — da ville en skrivefeil
  // slått av taket i stedet for å feile høylytt.
  if (!Number.isFinite(parsed) || parsed < 0) return DEFAULT_DAILY_CAPS[sku];
  return Math.floor(parsed);
}

export interface BudgetDecision {
  tillatt: boolean;
  brukt: number;
  tak: number;
  gjenstaende: number;
}

/** Ren avgjørelse — ingen IO. Testes direkte. */
export function vurderBelastning(
  brukt: number,
  antall: number,
  tak: number,
): BudgetDecision {
  const gjenstaende = Math.max(0, tak - brukt);
  return {
    tillatt: brukt + antall <= tak,
    brukt,
    tak,
    gjenstaende,
  };
}

/** Summer en append-only-logg til forbruk per SKU. */
export function summerLedger(linjer: string[]): Record<string, number> {
  const sum: Record<string, number> = {};
  for (const linje of linjer) {
    const trimmet = linje.trim();
    if (!trimmet) continue;
    try {
      const { sku, n } = JSON.parse(trimmet) as { sku: string; n: number };
      if (typeof sku !== "string" || !Number.isFinite(n)) continue;
      sum[sku] = (sum[sku] ?? 0) + n;
    } catch {
      // En korrupt linje (halvskrevet ved samtidig skriving) skal ikke velte
      // regnskapet — den hoppes over, og resten summeres.
      continue;
    }
  }
  return sum;
}

// ── IO ──────────────────────────────────────────────────────────────────────

function ledgerDir(): string | null {
  const eksplisitt = process.env.PLACY_API_LEDGER_DIR;
  if (eksplisitt) return eksplisitt;
  // Testsuiten kaller de samme kodestiene med mocket fetch. Uten dette ville et
  // vitest-løp brukt opp døgntaket for ekte kjøringer — oppdaget da rapporten
  // viste 15 grounding-kall etter `npm test` uten at noe var sendt til Google.
  // Tester som SKAL prøve budsjettet setter PLACY_API_LEDGER_DIR selv.
  if (process.env.VITEST) return null;
  return path.join(process.cwd(), ".api-usage");
}

export function ledgerPath(dato: string): string | null {
  const dir = ledgerDir();
  return dir === null ? null : path.join(dir, `${dato}.jsonl`);
}

/** ISO-dato i lokal tid — regnskapet skal følge arbeidsdagen, ikke UTC. */
export function idag(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function lesForbruk(dato: string = idag()): Record<string, number> {
  const fil = ledgerPath(dato);
  if (fil === null || !fs.existsSync(fil)) return {};
  return summerLedger(fs.readFileSync(fil, "utf8").split("\n"));
}

/**
 * Belast budsjettet for `antall` kall mot `sku`. Kaster hvis taket nås.
 *
 * MÅ kalles FØR selve kallet. Kaller man etterpå, er pengene allerede brukt.
 */
export function belastApiKall(sku: ApiSku, antall = 1): BudgetDecision {
  const tak = capForSku(sku);
  const forbruk = lesForbruk();
  const brukt = forbruk[sku] ?? 0;
  const beslutning = vurderBelastning(brukt, antall, tak);

  if (!beslutning.tillatt) {
    throw new ApiBudgetExceededError(sku, brukt, tak, antall);
  }

  const dir = ledgerDir();
  if (dir !== null) {
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(
      `${path.join(dir, `${idag()}.jsonl`)}`,
      `${JSON.stringify({ sku, n: antall, t: new Date().toISOString() })}\n`,
    );
  }

  return { ...beslutning, brukt: brukt + antall, gjenstaende: tak - brukt - antall };
}

/** Rapport for `scripts/api-usage.ts`. */
export function forbruksrapport(dato: string = idag()): Array<{
  sku: ApiSku;
  brukt: number;
  tak: number;
  usd: number;
}> {
  const forbruk = lesForbruk(dato);
  return API_SKUS.map((sku) => ({
    sku,
    brukt: forbruk[sku] ?? 0,
    tak: capForSku(sku),
    usd: ((forbruk[sku] ?? 0) * USD_PER_1000[sku]) / 1000,
  }));
}
