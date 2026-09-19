import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ resolve: vi.fn(), enabled: vi.fn(), notFound: vi.fn(() => { throw new Error('NEXT_NOT_FOUND'); }) }));
vi.mock('next/navigation', () => ({ notFound: mocks.notFound }));
vi.mock('@/lib/live/hosted-access', () => ({ hostedVoiceEnabled: mocks.enabled }));
vi.mock('@/lib/live/projects', async importOriginal => ({ ...await importOriginal<typeof import('@/lib/live/projects')>(), resolveVoiceProject: mocks.resolve }));
vi.mock('@/app/demo/nyhavna-lokal/layout', () => ({ default: () => null }));
vi.mock('@/app/demo/nyhavna-lokal/lokal-board-gate', () => ({ default: () => null }));
vi.mock('@/components/variants/report/reels/ReportReelsPage', () => ({ default: () => null }));
import { VoiceProjectError } from '@/lib/live/projects';
import ProjectPage, { generateMetadata } from '@/app/[slug]/page';

beforeEach(() => { vi.clearAllMocks(); mocks.enabled.mockReturnValue(true); });
describe('public project failure presentation', () => {
  it.each(['nyhavna','another-project'])('uses the same page and canonical URL contract for %s', async slug => {
    mocks.resolve.mockResolvedValue({slug,project:{name:slug},demo:{id:'fixture',board:{}}});
    const props={params:Promise.resolve({slug})};
    expect(await generateMetadata(props)).toMatchObject({robots:{index:false,follow:false},alternates:{canonical:`https://placy.no/${slug}`}});
    expect(await ProjectPage(props)).toBeTruthy();
    expect(mocks.resolve).toHaveBeenCalledWith({project:slug});
  });
  it.each([ProjectPage, generateMetadata])('keeps unknown projects as not found for page and metadata', async render => {
    mocks.resolve.mockRejectedValue(new VoiceProjectError());
    await expect(render({ params: Promise.resolve({slug:'missing'}) })).rejects.toThrow('NEXT_NOT_FOUND');
    expect(mocks.notFound).toHaveBeenCalledOnce();
  });
  it.each([ProjectPage, generateMetadata])('passes outages to the retryable error boundary instead of notFound', async render => {
    const outage = new VoiceProjectError('unavailable');
    mocks.resolve.mockRejectedValue(outage);
    await expect(render({ params: Promise.resolve({slug:'nyhavna'}) })).rejects.toBe(outage);
    expect(mocks.notFound).not.toHaveBeenCalled();
  });
  it('does not resolve or render projects when hosted access is disabled', async () => {
    mocks.enabled.mockReturnValue(false);
    await expect(ProjectPage({ params: Promise.resolve({slug:'nyhavna'}) })).rejects.toThrow('NEXT_NOT_FOUND');
    expect(mocks.resolve).not.toHaveBeenCalled();
  });
});
