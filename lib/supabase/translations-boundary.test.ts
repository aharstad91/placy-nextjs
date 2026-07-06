import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Source-level guard for lib/supabase/translations.ts.
//
// We deliberately read the file as TEXT instead of importing it: the module
// imports `server-only`, whose default export THROWS unless resolved under the
// React Server `react-server` export condition (Next.js server build). Vitest's
// node resolution would hit that throw at import time. The build-time
// enforcement is exactly what we are asserting, so a static check is the right
// instrument here — `npm run build` is the live proof that client imports fail.
const SRC = readFileSync(
  join(process.cwd(), "lib/supabase/translations.ts"),
  "utf8"
);

describe("translations.ts — server-boundary enforcement (r05.4)", () => {
  it("imports 'server-only' so a client-component import fails at build-time", () => {
    expect(SRC).toMatch(/import\s+["']server-only["']/);
  });

  it("uses the @/lib/supabase wrapper (./client), never @supabase/supabase-js directly", () => {
    expect(SRC).toMatch(/from\s+["']\.\/client["']/);
    expect(SRC).not.toMatch(/@supabase\/supabase-js/);
  });

  it("leser v2-skjemaet (cutover) — typet, uten any-cast", () => {
    expect(SRC).toMatch(/\.schema\("v2"\)/);
    expect(SRC).not.toMatch(/as any/);
  });

  it("returns an empty map on error / unconfigured client (fail-soft contract)", () => {
    // Both the unconfigured-client guard and the query-error guard return {}.
    expect(SRC.match(/return\s*\{\}/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });
});
