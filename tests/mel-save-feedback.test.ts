import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMelSaveFeedback, MEL_SAVE_MS } from '../src/rendering/mel-save-feedback';
import { setReducedMotion, resetPreferenceCache } from '../src/presentation/preferences';
import { publishPlayerSaved, subscribeBoardFeed } from '../src/rendering/board-feed';
class Element {
  children: Element[] = []; parent: Element | null = null; className = ''; textContent = ''; attributes = new Map<string, string>();
  setAttribute(key: string, value: string) { this.attributes.set(key, value); }
  append(...elements: Element[]) { for (const e of elements) { e.parent = this; this.children.push(e); } }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(e => e !== this); this.parent = null; }
}
const receipt = { type: 'playerSaved', source: 'mel', battleId: 'b1' } as const;
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); resetPreferenceCache(); });
describe('Mel confirmed-save feedback in 2D and 3D', () => {
  it('deduplicates confirmed/server/change copies, publishes once, and removes shield and label at exactly 2s', () => {
    vi.useFakeTimers(); vi.stubGlobal('document', { createElement: () => new Element() });
    const host = new Element(), saved = vi.fn(), off = subscribeBoardFeed({ frame() {}, events() {}, playerSaved: saved });
    const feedback = createMelSaveFeedback(host as unknown as HTMLElement, publishPlayerSaved);
    feedback.push([receipt, receipt]); feedback.push([receipt]);
    expect(host.children).toHaveLength(1); expect(saved).toHaveBeenCalledTimes(1);
    expect(host.children[0]!.children.map(e => e.textContent)).toContain('免死');
    expect(MEL_SAVE_MS).toBe(2000);
    vi.advanceTimersByTime(MEL_SAVE_MS - 1); expect(host.children).toHaveLength(1);
    vi.advanceTimersByTime(1); expect(host.children).toHaveLength(0);
    feedback.push([receipt]); expect(host.children).toHaveLength(0);
    feedback.reset(); feedback.push([receipt]); expect(host.children).toHaveLength(1);
    feedback.dispose(); expect(host.children).toHaveLength(0); off();
  });
  it('honours the in-app reduced-motion preference', () => {
    vi.useFakeTimers(); vi.stubGlobal('document', { createElement: () => new Element() });
    setReducedMotion(true);
    const host = new Element(), feedback = createMelSaveFeedback(host as unknown as HTMLElement);
    feedback.push([receipt]); expect(host.children[0]!.className).toBe('mel-save-feedback mel-save-reduced');
    feedback.dispose(); expect(vi.getTimerCount()).toBe(0);
  });
  it('ignores unrelated events and cancels pending timers when disposed', () => {
    vi.useFakeTimers(); vi.stubGlobal('document', { createElement: () => new Element() });
    const host = new Element(), saved = vi.fn(), feedback = createMelSaveFeedback(host as unknown as HTMLElement, saved);
    const unrelated = { ...receipt, source: 'other' };
    feedback.push([{ type: 'roundSettled' }, unrelated]);
    expect(saved).not.toHaveBeenCalled(); feedback.push([receipt]); feedback.dispose();
    expect(vi.getTimerCount()).toBe(0); expect(host.children).toHaveLength(0);
  });
});
