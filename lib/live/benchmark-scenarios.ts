export const BENCHMARK_RESERVATION_USD = 5;
export interface BenchmarkScenario {
  id: string;
  fixtures: string[];
  durationSeconds?: number;
  mode?: 'interrupt' | 'concurrent' | 'disconnect' | 'silence';
}
export const BENCHMARK_SCENARIOS: BenchmarkScenario[] = [
  { id: 'quiet', fixtures: ['01-interesse'] },
  { id: 'school', fixtures: ['02-bo-barn', '03-skolevei', '04-ungdomsskole'] },
  { id: 'tool-heavy', fixtures: ['12-kafeer', '13-barnehager', '05-sykle', '06-andre-stedet'] },
  { id: 'sources', fixtures: ['07-kilder', '08-pause-a', '08-pause-b'] },
  { id: 'interrupted', fixtures: ['01-interesse', '09-avbrudd', '11-stopp'], mode: 'interrupt' },
  { id: 'corrected', fixtures: ['12-kafeer', '10-korrigering'] },
  ...[5, 15, 26].map((minutes) => ({ id: `long-${minutes}m`, fixtures: ['12-kafeer', '13-barnehager', '03-skolevei'], durationSeconds: minutes * 60 })),
  { id: 'concurrent', fixtures: ['12-kafeer', '13-barnehager'], mode: 'concurrent' },
  { id: 'disconnect', fixtures: ['01-interesse'], mode: 'disconnect' },
  { id: 'silence', fixtures: [], durationSeconds: 150, mode: 'silence' },
];
export function expandScenarios(selection: string, repeat: number): BenchmarkScenario[] {
  if (!Number.isInteger(repeat) || repeat < 1 || repeat > 10) throw new Error('repeat must be 1–10');
  const ids = selection === 'short' ? BENCHMARK_SCENARIOS.slice(0, 6).map(s => s.id) : selection.split(',');
  return ids.flatMap(id => {
    const scenario = BENCHMARK_SCENARIOS.find(s => s.id === id);
    if (!scenario) throw new Error(`Unknown scenario: ${id}`);
    return Array.from({ length: repeat }, () => ({ ...scenario, fixtures: [...scenario.fixtures] }));
  });
}
export interface BenchmarkLedgerRow {
  id: string; scenario_id: string | null; state: string; accounting_status: string;
  reservation_usd: number; known_cost_usd: number; voice_seconds: number | null;
  backend_cost_usd: number; invalid_usage: boolean; provider_closed: boolean;
  final_usage_confirmed: boolean; termination_reason: string | null;
}
export function liabilityUsd(rows: BenchmarkLedgerRow[]): number {
  return rows.reduce((sum, row) => {
    const known = Number(row.known_cost_usd), reserved = Number(row.reservation_usd);
    if (!Number.isFinite(known) || known < 0 || !Number.isFinite(reserved) || reserved < 0) throw new Error('Invalid ledger liability');
    // Even a complete usage checkpoint cannot release the live reservation.
    return sum + (row.accounting_status === 'complete' && row.state === 'closed' ? known : Math.max(known, reserved));
  }, 0);
}
export function admitBenchmark(rows: BenchmarkLedgerRow[], ceiling: number, starts: number): boolean {
  if (!Number.isFinite(ceiling) || ceiling <= 0 || !Number.isInteger(starts) || starts < 1 || starts > 2) return false;
  return liabilityUsd(rows) + BENCHMARK_RESERVATION_USD * starts <= ceiling;
}
export function costDistribution(rows: BenchmarkLedgerRow[]) {
  const costs = rows.filter(r => r.accounting_status === 'complete' && r.state === 'closed').map(r => Number(r.known_cost_usd)).sort((a, b) => a - b);
  const n = costs.length;
  return { samples: n, incomplete: rows.length - n, medianUsd: n ? (costs[Math.floor((n - 1) / 2)] + costs[Math.floor(n / 2)]) / 2 : null,
    p95Usd: n ? costs[Math.ceil(n * .95) - 1] : null, maxUsd: n ? costs[n - 1] : null };
}
