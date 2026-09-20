import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const modulePath = process.env.PGLITE_MODULE ?? '/tmp/placy-voice-ledger-pg/node_modules/@electric-sql/pglite/dist/index.js';
// The PostgreSQL/WASM dependency is deliberately isolated from the application bundle.
// CI without that optional verifier still runs the service/controller unit suites.
describe.skipIf(!process.env.PGLITE_MODULE && !existsSync(modulePath))('shared platform SQL admission integration', () => {
  it('enforces identity, aggregate policies, liability, immutable purpose, grants and repeatable seeds', () => {
    const result = execFileSync(process.execPath, [resolve('lib/live/metering/verify-shared-platform.mjs')], {
      env: { ...process.env, PGLITE_MODULE: modulePath }, encoding: 'utf8', timeout: 60_000,
    });
    expect(result).toContain('PASS: shared platform SQL');
  }, 65_000);
});
