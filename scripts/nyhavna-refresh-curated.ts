import { readFile } from 'node:fs/promises';
import type { Project } from '@/lib/types';
import { LEVE_POIS, LEVE_CATEGORIES, LEVE_THEMES } from '@/lib/demo/nyhavna-leve/content';
import { buildLeveProject } from '@/lib/demo/nyhavna-leve/build';
import { writeNyhavnaSnapshot } from '@/lib/demo/nyhavna-leve/write-snapshot';
async function main() {
  const path = 'data/demo/nyhavna-snapshot.json';
  const prior = JSON.parse(await readFile(path, 'utf8')) as { project: Project };
  const ids = new Set(LEVE_POIS.map(p => p.id));
  const cats = new Set(LEVE_CATEGORIES.map(c => c.id));
  const ts = new Set(LEVE_THEMES.map(t => t.id));
  const project = buildLeveProject({ ...prior.project, pois: prior.project.pois.filter(p => !ids.has(p.id)), categories: prior.project.categories.filter(c => !cats.has(c.id)), reportConfig: { ...prior.project.reportConfig, themes: prior.project.reportConfig?.themes?.filter(t => !ts.has(t.id)) } });
  const result = await writeNyhavnaSnapshot(project);
  console.log(JSON.stringify({ snapshotId: result.snapshotId, records: result.records, curated: result.curated, factualVerificationPending: result.factualVerificationPending }));
}
void main();
