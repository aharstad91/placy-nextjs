import { describe, expect, it, vi } from 'vitest';
import { loadDataset, assertReferences } from '@/lib/demo/local-board/dataset';
import { localPlacesSchema, type LocalDataset } from '@/lib/demo/local-board/schema';
import { buildLocalBoard } from '@/lib/demo/local-board/board';
import { buildVoiceDeps, buildLocalInstructions } from '@/lib/demo/local-board/voice';
import { createNyhavnaKnowledge } from '@/lib/realtime/nyhavna-knowledge';
import { createNyhavnaConversation } from '@/lib/realtime/nyhavna-conversation';
import { createPresentation } from '@/lib/demo/local-board/presentation';

import { getLocalDemo } from "@/lib/demo/local-board/registry";

const NYHAVNA = getLocalDemo("nyhavna-lokal");

async function fixture(): Promise<LocalDataset> {
  const real = await loadDataset(NYHAVNA);
  const sourceId = real.sources[0].id;
  const common = { coordinates: real.board.center, checkedAt: '2026-09-14', status: 'existing', sourceIds: [sourceId], travelTime: { walk: 10 } };
  const places = localPlacesSchema.parse([
    { ...common, id: 'senter', name: 'Testsenter', categoryId: 'hverdagsliv', placeType: 'Kjøpesenter', icon: 'Store', anchorSummary: 'Dagligvarer, apotek og servering.' },
    ...[['matbutikk', 'hverdagsliv', 'Dagligvare', 'supermarket'], ['apotek', 'hverdagsliv', 'Apotek', 'pharmacy'], ['kaffe', 'mat-drikke', 'Kaffebar', 'cafe'], ['bakeri', 'mat-drikke', 'Bakeri', 'bakery']].map(([id,categoryId,placeType,poiCategoryId]) => ({ ...common, id, name: id, categoryId, placeType, poiCategoryId, parentPlaceId: 'senter', facts: [{ id: `${id}-fakta`, text: `${id} ligger i Testsenter.`, sourceId, checkedAt: '2026-09-14', verification: 'confirmed' }] })),
    { ...common, id: 'utenfor', name: 'Utenfor senteret', categoryId: 'hverdagsliv', placeType: 'Dagligvare' },
  ]);
  return { ...real, places, topics: [], faqs: [{ id: 'handle', question: 'Mat?', answer: '[Matbutikk](poi:matbutikk)', categoryId: 'hverdagsliv', origin: 'local', sourceIds: [sourceId], caveats: [] }], board: { ...real.board, presentation: [{ id: 'hverdag', categoryId: 'hverdagsliv', text: 'Matbutikken og apoteket ligger i senteret.', placeIds: ['matbutikk', 'apotek'], sourceIds: [sourceId], checkedAt: '2026-09-14' }] } };
}

describe('lokale kjøpesentre', () => {
  it('beholder servering når stemmen viser et senter fra en kafé', async () => {
    const { executeBoardTool, boardToolTargets } = await import('@/lib/realtime/board-tools');
    const { initialBoardState } = await import('@/components/variants/report/board/board-state');
    const b = buildLocalBoard(await fixture(), NYHAVNA);
    const food = b.categories.find(c => c.id === 'mat-drikke')!;
    const onCategory = vi.fn();
    const env = { data: b, state: { ...initialBoardState, activeCategoryId: food.id }, dispatch: vi.fn(), onCategory, followHighlightCategory: true };
    executeBoardTool('highlight_places', { poi_ids: ['senter'] }, env);
    const shown = executeBoardTool('show_place', { poi_id: 'senter' }, env);
    expect(onCategory.mock.calls).toEqual([[b.categories.indexOf(food)], [b.categories.indexOf(food)]]);
    expect(boardToolTargets('show_place', shown, b, food.id)).toEqual({ categoryIds: [food.id], poiIds: ['senter'] });
  });
  it('viser senteret én gang og butikkene i eksisterende senterregister', async () => {
    const d = await fixture(); assertReferences(d, NYHAVNA);
    const b = buildLocalBoard(d, NYHAVNA);
    expect([...b.poisById.keys()]).toEqual(['senter', 'utenfor']);
    const centre = b.categories.find(c => c.id === 'hverdagsliv')!.pois.find(p => p.id === 'senter')!;
    expect(centre.isAnchor).toBe(true);
    expect(centre.childPOIs).toHaveLength(4);
    expect(new Set(centre.childPOIs!.map(p => p.category.name))).toEqual(new Set(['Dagligvare','Apotek','Kaffebar','Bakeri']));
    expect(centre.raw.anchorSummary).toBeTruthy();
  });
  it('viser senteret i servering med bare serveringsmedlemmene', async () => {
    const b = buildLocalBoard(await fixture(), NYHAVNA);
    const food = b.categories.find(c => c.id === 'mat-drikke')!;
    expect(food.pois.map(p => p.id)).toEqual(['senter']);
    expect(food.pois[0].childPOIs!.map(p => p.id)).toEqual(['kaffe','bakeri']);
  });
  it('bevarer butikkens egne fakta, men sender kartet til senteret', async () => {
    const d = await fixture(), b = buildLocalBoard(d, NYHAVNA);
    const voice = buildVoiceDeps(d);
    const knowledge = createNyhavnaKnowledge(b, voice.knowledge);
    expect(knowledge('get_place_facts', { poi_id: 'kaffe' })).toMatchObject({ id: 'kaffe', map_poi_id: 'senter', facts: [{ text: 'kaffe ligger i Testsenter.' }] });
    expect(voice.curatedFor('mat-drikke').find(p => p.id === 'kaffe')?.map_poi_id).toBe('senter');
    const line = buildLocalInstructions(d, b).split('\n').find(line => line.startsWith('STEDER OG REISETIDER (data): '))!;
    expect(JSON.parse(line.slice('STEDER OG REISETIDER (data): '.length))).toContainEqual(expect.objectContaining({ id: 'kaffe', map_poi_id: 'senter' }));
  });
  it('henter senterets egne fakta selv når en butikk står først i datasettet', async () => {
    const d = await fixture(); d.places.reverse();
    const knowledge = createNyhavnaKnowledge(buildLocalBoard(d, NYHAVNA), buildVoiceDeps(d).knowledge);
    expect(knowledge('get_place_facts', { poi_id: 'senter' })).toMatchObject({ id: 'senter', name: 'Testsenter' });
  });
  it('peker manus og FAQ-lenker til den synlige sentermarkøren', async () => {
    const d = await fixture(), b = buildLocalBoard(d, NYHAVNA);
    expect(b.categories.find(c => c.id === 'hverdagsliv')!.editorial!.faq![0].answer).toBe('[Matbutikk](poi:senter)');
    const tour = createPresentation(createNyhavnaConversation(b, buildVoiceDeps(d)), { segments: d.board.presentation!, places: d.places, center: d.board.center, categories: d.board.categories, homeName: d.board.name, discoveryCategoryIds: d.board.discoveryCategoryIds });
    expect(tour.execute('present_neighbourhood', { action: 'next' }).directives).toContainEqual({ name: 'highlight_places', args: { poi_ids: ['senter'] } });
  });
  it('avviser ukjent forelder, selvreferanse og en forelder som ikke er senter', async () => {
    for (const parentPlaceId of ['ukjent','matbutikk','utenfor']) {
      const d = await fixture(); d.places.find(p => p.id === 'matbutikk')!.parentPlaceId = parentPlaceId;
      expect(() => assertReferences(d, NYHAVNA)).toThrow(/parentPlaceId/);
    }
  });
  it('avviser kjedede sentre og udokumentert lite senterutvalg', async () => {
    const d = await fixture(); d.places[0].parentPlaceId = 'utenfor';
    expect(() => assertReferences(d, NYHAVNA)).toThrow(/parentPlaceId/);
    const small = await fixture(); small.places = small.places.filter(p => p.id !== 'bakeri');
    expect(() => assertReferences(small, NYHAVNA)).toThrow(/minst fire/);
  });
});
