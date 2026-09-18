import { describe, expect, it, vi } from 'vitest';
import { loadDataset } from '@/lib/demo/local-board/dataset';
import { buildLocalBoard } from '@/lib/demo/local-board/board';
import { visibleReserveBoard } from '@/lib/demo/local-board/reserve';
import { radiusOptions, discoveryGeometry, radiusPlaces } from '@/lib/demo/local-board/radius';
import { createPresentation } from '@/lib/demo/local-board/presentation';
import { createNyhavnaConversation } from '@/lib/realtime/nyhavna-conversation';
import { buildVoiceDeps } from '@/lib/demo/local-board/voice';

import { executeBoardTool } from '@/lib/realtime/board-tools';
import { initialBoardState } from '@/components/variants/report/board/board-state';
import type { BoardData } from '@/components/variants/report/board/board-data';

import { getLocalDemo } from "@/lib/demo/local-board/registry";

const NYHAVNA = getLocalDemo("nyhavna-lokal");

const category = 'trening-aktivitet';

/**
 * Neste ekstrautvalg for en kategori: det knappen og stemmen skal enes om.
 *
 * Bor i testen og ikke i `reserve.ts` fordi ingen produksjonsflate spør etter
 * «neste radius» uten å vite hvilken – flatene slår opp en oppgitt `radius_km`.
 */
const nextReserveIds = (data: BoardData, categoryId: string, revealed: ReadonlySet<string>): string[] =>
  radiusOptions(data.demoRadiusPlaces ?? [], categoryId, revealed).options[0]?.ids ?? [];
async function fixture() {
  const dataset = await loadDataset(NYHAVNA);
  const board = buildLocalBoard(dataset, NYHAVNA);
  return { board, tour: createPresentation(createNyhavnaConversation(board, buildVoiceDeps(dataset)), { segments: dataset.board.presentation ?? [], places: dataset.places, center: dataset.board.center, categories: dataset.board.categories, homeName: dataset.board.name, discoveryCategoryIds: dataset.board.discoveryCategoryIds }) };
}
describe('radius discovery', () => {
  it('shows an initial selection and loads remaining nearby places before expanding and expands categories independently in two-kilometre steps', async () => {
    const { board } = await fixture();
    let revealed = new Set<string>();
    let visible = visibleReserveBoard(board, revealed);
    expect(visible.categories.find(c => c.id === category)?.pois).toHaveLength(6);
    expect(visible.categories.find(c => c.id === 'natur-friluftsliv')?.pois).toHaveLength(4);
    expect(visible.poisById.has('pool-3t-rosten')).toBe(false);
    expect(visible.poisById.has('flex-gym')).toBe(true);
    expect(visible.poisById.has('buld-no')).toBe(true);
    const first = nextReserveIds(board, category, revealed);
    expect(first).toHaveLength(4);
    expect(first).toContain('pool-fresh-fitness-trondheim-sentrum');
    expect(first).toContain('pool-3t-lade');
    expect(first).not.toContain('pool-3t-leangen');
    expect(first).not.toContain('pool-3t-ilsvika');
    const distances = first.map(id => board.demoRadiusPlaces!.find(p => p.id === id)!.distanceKm);
    expect(distances).toEqual([...distances].sort((a, b) => a - b));
    revealed = new Set(first);
    visible = visibleReserveBoard(board, revealed);
    expect(visible.categories.find(c => c.id === category)?.pois).toHaveLength(10);
    expect(visible.categories.find(c => c.id === 'natur-friluftsliv')?.pois).toHaveLength(4);
    expect(discoveryGeometry(visible, category)[0].name).toBe('2 km fra Nyhavna');
    const second = nextReserveIds(board, category, revealed);
    expect(second).toHaveLength(3);
    second.forEach(id => revealed.add(id));
    while (nextReserveIds(board, category, revealed).length) nextReserveIds(board, category, revealed).forEach(id => revealed.add(id));
    visible = visibleReserveBoard(board, revealed);
    expect(visible.categories.find(c => c.id === category)?.pois).toHaveLength(17);
    expect(visible.poisById.has('pool-3t-rosten')).toBe(true);
    expect(nextReserveIds(board, category, revealed)).toEqual([]);
    expect(nextReserveIds(board, 'transport', revealed)).toEqual([]);
  });
  it('voice and button use identical IDs; advances only after browser success', async () => {
    const { tour, board } = await fixture();
    const initial = tour.execute('present_neighbourhood', { action: 'category', category_id: category });
    expect(initial.result).toMatchObject({ invitation: 'Vil du se flere lignende treningssteder i nærheten?' });
    // The general chapter tool must also preserve the invitation and activate the category.
    expect(tour.execute('open_theme', { theme_id: category }).result).toHaveProperty('invitation');
    const more = tour.execute('reveal_more_places', { category_id: category });
    expect(more.result).toMatchObject({ matches: 4, radius_km: 2 });
    expect(more.result).toHaveProperty("places");
    expect((more.result as {places: unknown[]}).places).toHaveLength(4);
    const directive = more.directives![0];
    expect((more.result as {places: {id: string}[]}).places.map(p => p.id)).toEqual(directive.args.poi_ids);
    expect(more.result).toMatchObject({ invitation: 'Vil du se enda flere lignende treningssteder litt lenger unna?' });
    expect(directive.args.poi_ids).toEqual(nextReserveIds(board, category, new Set()));
    tour.observeBrowserResult(directive.name, directive.args, { error: 'disconnected' });
    expect(tour.execute('reveal_more_places', { category_id: category }).result).toMatchObject({ matches: 4 });
    tour.observeBrowserResult(directive.name, directive.args, { ok: true });
    expect(tour.execute('reveal_more_places', { category_id: category }).result).toMatchObject({ matches: 3, radius_km: 4 });
    expect(tour.execute('reveal_more_places', { category_id: 'missing' }).directives).toBeUndefined();
    expect(tour.execute('reveal_more_places', { category_id: category, radius_km: 50 }).directives).toBeUndefined();
  });
  it('remembers offline reveals on voice start and can skip directly to 10km', async () => {
    const { tour, board } = await fixture();
    const option = radiusOptions(board.demoRadiusPlaces!, category, new Set()).options.find(o => o.radiusKm === 10)!;
    tour.setBoardState({ selected_category_id: category, selected_place_id: null, travel_mode: 'walk', revealed_place_ids: option.ids });
    expect(tour.execute('reveal_more_places', { category_id: category }).result).toMatchObject({ matches: 0 });
    const nature = tour.execute('reveal_more_places', { category_id: 'natur-friluftsliv', radius_km: 10 });
    expect(nature.result).toMatchObject({ matches: 8, radius_km: 10 });
  });
  it('includes and highlights every place even when a reveal exceeds six', async () => {
    const { board, tour } = await fixture();
    const outcome = tour.execute('reveal_more_places', { category_id: category, radius_km: 10 });
    const ids = outcome.directives![0].args.poi_ids as string[];
    expect(ids.length).toBeGreaterThan(6);
    expect((outcome.result as {places: {id: string}[]}).places.map(p => p.id)).toEqual(ids);
    const result = executeBoardTool('highlight_places', { poi_ids: ids }, {
      data: visibleReserveBoard(board, new Set(ids)), state: initialBoardState,
      dispatch: vi.fn(), highlightLimit: ids.length,
    });
    expect(result).toHaveProperty('highlighted');
    if ('ok' in result) expect(result.highlighted?.map(p => p.id)).toEqual(ids);
  });
  it('uses distance not travel time and rejects out-of-range or unrelated categories', () => {
    const center = { lat: 0, lng: 0 };
    const points = radiusPlaces([
      { id: 'near', categoryId: category, coordinates: { lat: 0.01, lng: 0 } },
      { id: 'far', categoryId: category, coordinates: { lat: 0.06, lng: 0 } },
      { id: 'outside', categoryId: category, coordinates: { lat: 0.1, lng: 0 } },
      { id: 'unrelated', categoryId: 'transport', coordinates: center },
    ], center, [category]);
    expect(points.map(p => p.id)).toEqual(['near', 'far']);
    expect(radiusOptions(points, category, new Set()).options).toEqual([{ radiusKm: 8, ids: ['far'] }, { radiusKm: 10, ids: ['far'] }]);
  });
});
