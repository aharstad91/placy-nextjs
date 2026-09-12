import { describe, expect, it } from 'vitest';
import { getNyhavnaSnapshot } from '@/lib/demo/nyhavna-leve/snapshot';
import { nyhavnaKnowledge } from '@/lib/demo/nyhavna-leve/knowledge';
import { createNyhavnaKnowledge } from '@/lib/realtime/nyhavna-knowledge';

describe('server knowledge boundary', () => {
  it('resolves every curated alias and keeps all packets bounded and sourced', async () => {
    const { board } = await getNyhavnaSnapshot();
    const execute = createNyhavnaKnowledge(board);
    for (const entity of nyhavnaKnowledge.entities) {
      for (const query of [entity.name, ...entity.aliases]) {
        const result = execute('find_places', { query }) as { places: Array<{ id: string }> };
        expect(result.places[0]?.id, query).toBe(entity.id);
        expect(result.places.length).toBeLessThanOrEqual(6);
      }
      const details = execute('get_place_facts', { poi_id: entity.id }) as { map_poi_id: string | null; facts: Array<{ text: string; source_id: string }>; sources: Array<{ id: string }>; related: Array<{ source_id: string }> };
      expect(details.map_poi_id).toBe(entity.mapPoiId);
      expect(JSON.stringify(details).length).toBeLessThan(6000);
      for (const fact of details.facts) {
        expect(entity.facts.some(f => f.text === fact.text && f.verification === 'confirmed')).toBe(true);
        expect(details.sources.some(s => s.id === fact.source_id)).toBe(true);
      }
      for (const relation of details.related) expect(details.sources.some(s => s.id === relation.source_id)).toBe(true);
    }
  });
  it('keeps broad culture results alongside partial name matches', async () => {
    const execute = createNyhavnaKnowledge((await getNyhavnaSnapshot()).board);
    const result = execute('find_places', { query: 'kultur' }) as { places: Array<{ name: string }> };
    expect(result.places.length).toBeGreaterThan(1);
    expect(result.places.some(p => /Fyringsbunkeren/i.test(p.name))).toBe(true);
  });
  it('does not turn unreviewed base records or unknown questions into facts', async () => {
    const { board } = await getNyhavnaSnapshot();
    const execute = createNyhavnaKnowledge(board);
    const curated = new Set(nyhavnaKnowledge.entities.map(e => e.mapPoiId));
    for (const poi of board.categories.flatMap(c => c.pois).filter(p => !curated.has(String(p.id)))) {
      expect(execute('get_place_facts', { poi_id: String(poi.id) })).toHaveProperty('error');
    }
    expect(execute('find_places', { query: 'skriv pythonkode' })).toMatchObject({ matches: 0, places: [] });
    expect(execute('unknown_tool', {})).toHaveProperty('error');
  });
  it('paginates all records without duplicates and preserves unknown locations', async () => {
    const execute = createNyhavnaKnowledge((await getNyhavnaSnapshot()).board);
    const ids: string[] = [];
    let offset: number | null = 0;
    while (offset !== null) {
      const page = execute('find_places', { offset }) as { places: Array<{ id: string; map_poi_id: string | null }>; next_offset: number | null };
      ids.push(...page.places.map(p => p.id));
      for (const place of page.places) if (nyhavnaKnowledge.entities.find(e => e.id === place.id)?.mapPoiId === null) expect(place.map_poi_id).toBeNull();
      offset = page.next_offset;
    }
    expect(new Set(ids).size).toBe(nyhavnaKnowledge.entities.length);
    expect(ids).toHaveLength(nyhavnaKnowledge.entities.length);
  });
});
