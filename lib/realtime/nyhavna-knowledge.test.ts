import { describe, expect, it } from 'vitest';
import { getNyhavnaSnapshot } from '@/lib/demo/nyhavna-leve/snapshot';
import { nyhavnaKnowledge } from '@/lib/demo/nyhavna-leve/knowledge';
import { createNyhavnaKnowledge, NYHAVNA_INSTRUCTIONS, nyhavnaFaqCatalog, nyhavnaInstructions } from '@/lib/realtime/nyhavna-knowledge';
import { spokenBoardProjection } from '@/lib/realtime/spoken-projection';
import { NYHAVNA_GREETING_INSTRUCTION, NYHAVNA_GREETING_TEXT } from '@/lib/realtime/nyhavna-greeting';
import { NYHAVNA_VOICE_INSTRUCTIONS } from '@/lib/live/voice-instructions';

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
  it('serves unreviewed base records as labelled register data, never as facts', async () => {
    const { board } = await getNyhavnaSnapshot();
    const execute = createNyhavnaKnowledge(board);
    const curated = new Set(nyhavnaKnowledge.entities.map(e => e.mapPoiId));
    const uncurated = board.categories.flatMap(c => c.pois).filter(p => !curated.has(String(p.id)));
    expect(uncurated.length).toBeGreaterThan(100);
    for (const poi of uncurated) {
      const packet = execute('get_place_facts', { poi_id: String(poi.id) }) as Record<string, unknown>;
      expect(packet).toMatchObject({ basis: 'register', map_poi_id: String(poi.id) });
      expect(packet).not.toHaveProperty('facts');
      expect(packet).not.toHaveProperty('sources');
      expect(packet).not.toHaveProperty('address');
    }
    const grocery = execute('find_places', { query: 'REMA 1000' }) as { basis?: string; places: Array<{ name: string; basis: string }> };
    expect(grocery.basis).toBe('register');
    expect(grocery.places[0]?.name).toMatch(/REMA 1000/i);
    expect(grocery.places.every(p => p.basis === 'register')).toBe(true);
    expect(execute('find_places', { query: 'skriv pythonkode' })).toMatchObject({ matches: 0, places: [] });
    expect(execute('get_place_facts', { poi_id: 'finnes-ikke' })).toHaveProperty('error');
    expect(execute('unknown_tool', {})).toHaveProperty('error');
    const addressed = uncurated.find(poi => poi.address);
    expect(addressed).toBeTruthy();
    expect(execute('get_place_address', { poi_id: String(addressed!.id), purpose: 'address' }))
      .toMatchObject({ id: String(addressed!.id), address: addressed!.address, purpose: 'address' });
    expect(execute('get_place_address', { poi_id: String(addressed!.id), purpose: 'other' })).toHaveProperty('error');
  });
  it('turns every board FAQ into a spoken catalog line with map ids instead of link markup', async () => {
    const { board } = await getNyhavnaSnapshot();
    const catalog = nyhavnaFaqCatalog(board);
    const entries = [...(board.globalFaq ?? []), ...board.categories.flatMap(c => c.editorial?.faq ?? [])];
    expect(entries.length).toBeGreaterThan(40);
    for (const entry of entries) expect(catalog).toContain(`- (${entry.id}) ${entry.question} → `);
    expect(catalog).not.toMatch(/\]\((poi|category):/);
    expect(catalog).toContain('| vis: REMA 1000 SOLSIDEN=google-');
    expect(catalog).toContain('| kategori: transport');
    for (const category of board.categories) if (category.editorial?.faq?.length) expect(catalog).toContain(`[${String(category.id)}] ${category.label}`);
    const instructions = nyhavnaInstructions(board);
    expect(instructions).toContain(NYHAVNA_INSTRUCTIONS);
    expect(instructions).toContain(nyhavnaFaqCatalog(spokenBoardProjection(board)));
    expect(instructions.split(/\s+/).length).toBeLessThan(3400);
  });
  it('navngir området katalogen faktisk gjelder, ikke Nyhavna', async () => {
    // Overskriften på de ukategoriserte spørsmålene er det ENESTE stedet
    // stedsnavnet står i katalogen. Sto Nyhavna igjen der, ville et annet
    // datasett fått en spørsmålsliste merket med feil sted.
    const { board } = await getNyhavnaSnapshot();
    const single = { ...board, globalFaq: (board.globalFaq ?? []).slice(0, 1), categories: [] };
    expect(single.globalFaq.length).toBe(1);
    const catalog = nyhavnaFaqCatalog(single, 'Leangenbukta');
    expect(catalog).toContain('[nabolaget] Leangenbukta');
    expect(catalog).not.toContain('Nyhavna');
  });
  it('deler instruksjonen: stemmen eier uttale og samspill, backenden eier fakta og verktøy', () => {
    const spoken = `${NYHAVNA_VOICE_INSTRUCTIONS}\n${NYHAVNA_GREETING_INSTRUCTION}`;
    expect(`${spoken}\n${NYHAVNA_INSTRUCTIONS}`).not.toMatch(/Placy/);
    // Live-modellen har et lite kontekstvindu: stemmeinstruksen skal være kort.
    expect(NYHAVNA_VOICE_INSTRUCTIONS.split(/\s+/).length).toBeLessThan(350);
    for (const label of ['Backchannel policy:', 'Interruption policy:', 'Delegation policy:', 'Backend tools:']) expect(NYHAVNA_VOICE_INSTRUCTIONS).toContain(label);
    expect(NYHAVNA_VOICE_INSTRUCTIONS).toMatch(/norsk \(bokmål\)/);
    expect(NYHAVNA_VOICE_INSTRUCTIONS).toContain('Ladehammeren');
    // Positiv beskrivelse: ingen liste over dialekter/språk å unngå.
    expect(NYHAVNA_VOICE_INSTRUCTIONS).not.toMatch(/svensk|dansk|engelsk aksent/i);
    // Stemmen skal ikke bære verktøynavn; backenden skal ikke bære uttalereglene.
    for (const tool of ['set_interests', 'open_theme', 'highlight_places', 'show_place']) expect(NYHAVNA_VOICE_INSTRUCTIONS).not.toContain(tool);
    expect(NYHAVNA_INSTRUCTIONS).not.toMatch(/UTTALE OG STEMME/);
    expect(NYHAVNA_INSTRUCTIONS).toMatch(/^VOICE CONVERSATION CONTEXT:/);
    expect(NYHAVNA_INSTRUCTIONS).toMatch(/mente å sykle/);
    expect(NYHAVNA_INSTRUCTIONS).toMatch(/45 ord/);
    expect(NYHAVNA_INSTRUCTIONS).toMatch(/står SIST i denne instruksjonen/);
    for (const tool of ['set_interests', 'open_theme', 'note_detour', 'return_to_tour', 'highlight_places', 'show_place', 'find_project_info']) expect(NYHAVNA_INSTRUCTIONS).toContain(tool);
    // Hilsenen starter selv: Live har ingen response.create å utløse den med.
    expect(NYHAVNA_GREETING_INSTRUCTION).toMatch(/Begynn samtalen nå/);
    expect(NYHAVNA_GREETING_INSTRUCTION).toContain(NYHAVNA_GREETING_TEXT);
    expect(NYHAVNA_GREETING_TEXT).toBe('Hei! Jeg kan vise deg rundt på Nyhavna. Hva er viktigst for deg når du vurderer et nytt sted å bo?');
    expect((NYHAVNA_GREETING_TEXT.match(/\?/g) ?? []).length).toBe(1);
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
