import { parseArgs } from 'node:util';
import { readFile } from 'node:fs/promises';
import { compareProviderCosts, costPeriod, fetchProviderCosts, listProviderProjects } from '@/lib/live/provider-costs';

async function main() {
  const { values } = parseArgs({ options: {
    'list-projects': { type: 'boolean' }, 'openai-project': { type: 'string' },
    from: { type: 'string' }, to: { type: 'string' }, ledger: { type: 'string' }, help: { type: 'boolean' },
  } });
  if (values.help) {
    console.log('Read-only OpenAI cost comparison. Requires OPENAI_ADMIN_KEY in .env.local or environment.\n\nnpx tsx scripts/openai-reconcile.ts --list-projects\nnpx tsx scripts/openai-reconcile.ts --openai-project proj_... --from YYYY-MM-DD --to YYYY-MM-DD --ledger .context/voice-costs.json\n\nDates are UTC; --to is exclusive. Export the ledger without any filters. Output is a review report, never an automatic adjustment or invoice.');
    return;
  }
  process.env.DOTENV_CONFIG_QUIET = 'true';
  await import('@/scripts/load-env');
  const key = process.env.OPENAI_ADMIN_KEY ?? '';
  if (values['list-projects']) {
    console.log(JSON.stringify({ projects: await listProviderProjects(key) }, null, 2));
    return;
  }
  if (!values['openai-project'] || !values.from || !values.to || !values.ledger) throw new Error('Required: --openai-project, --from, --to and --ledger (see --help)');
  const period = costPeriod(values.from, values.to);
  let ledger: unknown;
  try { ledger = JSON.parse(await readFile(values.ledger, 'utf8')); }
  catch { throw new Error('Cannot read a valid ledger JSON file'); }
  const provider = await fetchProviderCosts(key, values['openai-project'], period);
  console.log(JSON.stringify(compareProviderCosts(provider, ledger), null, 2));
}

void main().catch(error => {
  // Known validation failures are sanitized by the reader. Never print raw provider data or stack traces.
  console.error(error instanceof Error ? error.message.replaceAll(process.env.OPENAI_ADMIN_KEY || '\0', '[redacted]') : 'Cost comparison failed');
  process.exitCode = 1;
});
