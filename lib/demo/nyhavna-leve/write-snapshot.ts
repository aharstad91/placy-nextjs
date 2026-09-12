import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Project } from '@/lib/types';
import { projectContentHash } from '@/lib/demo/nyhavna-leve/snapshot';
import { buildNyhavnaInventory } from '@/lib/demo/nyhavna-leve/inventory';
import { transformToReportData } from '@/components/variants/report/report-data';
import { adaptBoardData } from '@/components/variants/report/board/board-data';
import { nyhavnaKnowledge } from '@/lib/demo/nyhavna-leve/knowledge';
import { LEVE_POI_ALIASES } from '@/lib/demo/nyhavna-leve/poi-aliases';

/** Both capture and curated refresh publish the same snapshot/ledger pair. */
export async function writeNyhavnaSnapshot(input: Project, directory = 'data/demo') {
  const project = JSON.parse(JSON.stringify(input)) as Project;
  const projectHash = projectContentHash(project);
  const snapshotId = `nyhavna-${projectHash.slice(0, 16)}`;
  const report = transformToReportData(project);
  const inventory = buildNyhavnaInventory(project, report, adaptBoardData(report));
  const mapped = new Map(nyhavnaKnowledge.entities.filter(e => e.mapPoiId).map(e => [e.mapPoiId, e]));
  const records = project.pois.map(p => ({ id: p.id, name: p.name, parentPoiId: p.parentPoiId ?? null, sourceUrls: p.editorialSources ?? [], disposition: mapped.has(p.id) ? 'curated-facts-audited' : 'unverified-not-used-for-agent-fact-answers', knowledgeId: mapped.get(p.id)?.id ?? null, checkedAt: '2026-09-12', reviewKind: mapped.has(p.id) ? 'primary-source-fact-review' : 'source-coverage-and-agent-access-review', factualAccuracyVerified: false }));
  const ledger = {
    snapshotId,
    note: 'Every source record assessed for provenance/access; baseline POI factual accuracy remains unverified. Curated facts carry individual verification in knowledge.ts. Coordinates/reisetider follow separate evidence.',
    records,
    mergedRecords: Object.entries(LEVE_POI_ALIASES).map(([id, canonicalId]) => ({ id, canonicalId, disposition: 'duplicate-identity-merged', checkedAt: '2026-09-12' })),
  };
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, 'nyhavna-review-ledger.json'), JSON.stringify(ledger, null, 2) + '\n');
  await writeFile(join(directory, 'nyhavna-snapshot.json'), JSON.stringify({ schemaVersion: 1, snapshotId, projectHash, project, inventory }, null, 2) + '\n');
  return { snapshotId, projectHash, inventory, records: records.length, curated: mapped.size, factualVerificationPending: records.length - mapped.size };
}
