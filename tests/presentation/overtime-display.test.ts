/**
 * v23 live fix: the combat overtime indicator. From the rules' overtime start (S13_COMBAT_RULES.overtimeStartTick,
 * 30 s) a running battle shows 加时 and the whole seconds left until the draw at maxTicks (45 s); before that, outside
 * combat, or without a running battle nothing changes. The online countdown strip (a DOM mount shown in 2D and 3D)
 * shows it while the phase has no deadline.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { overtimeIndicator } from '../../src/presentation/overtime-display';
import { S13_COMBAT_RULES } from '../../src/simulation/s13-rules';
import { PlayersSidebar } from '../../src/rendering/online/players-sidebar';
import type { PlayerView } from '../../src/rendering/online/protocol';

describe('overtimeIndicator', () => {
  it('starts at the rules\' overtime tick and counts the seconds to the draw', () => {
    const { overtimeStartTick, maxTicks, tickMs } = S13_COMBAT_RULES;
    expect(overtimeStartTick * tickMs).toBe(30_000);
    expect(maxTicks * tickMs).toBe(45_000);
    expect(overtimeIndicator(null)).toBeNull();
    expect(overtimeIndicator(undefined)).toBeNull();
    expect(overtimeIndicator(0)).toBeNull();
    expect(overtimeIndicator(overtimeStartTick - 1)).toBeNull();
    expect(overtimeIndicator(overtimeStartTick)).toEqual({ secondsLeft: 15, text: '加时 15' });
    expect(overtimeIndicator(overtimeStartTick + 1)).toEqual({ secondsLeft: 15, text: '加时 15' });
    expect(overtimeIndicator(overtimeStartTick + 20)).toEqual({ secondsLeft: 14, text: '加时 14' });
    expect(overtimeIndicator(maxTicks - 1)).toEqual({ secondsLeft: 1, text: '加时 1' });
    expect(overtimeIndicator(maxTicks)).toEqual({ secondsLeft: 0, text: '加时 0' });
  });
});

/** Just enough of the DOM for the sidebar's countdown strip. */
class FakeNode {
  textContent = ''; className = ''; id = ''; hidden = false; type = ''; tabIndex = 0; innerHTML = '';
  readonly dataset: Record<string, string> = {}; readonly children: FakeNode[] = []; readonly attributes = new Map<string, string>();
  private readonly classes = new Set<string>();
  readonly classList = { add: (name: string) => this.classes.add(name), remove: (name: string) => this.classes.delete(name),
    toggle: (name: string, on?: boolean) => { const want = on ?? !this.classes.has(name); if (want) this.classes.add(name); else this.classes.delete(name); return want; },
    contains: (name: string) => this.classes.has(name) };
  readonly style = { setProperty: () => {} };
  setAttribute(name: string, value: string) { this.attributes.set(name, value); }
  toggleAttribute(name: string, on: boolean) { if (on) this.attributes.set(name, ''); else this.attributes.delete(name); }
  append(...nodes: FakeNode[]) { this.children.push(...nodes); }
  replaceChildren(...nodes: FakeNode[]) { this.children.splice(0, this.children.length, ...nodes); }
  addEventListener() {}
  remove() {}
}
afterEach(() => vi.unstubAllGlobals());

describe('PlayersSidebar countdown: overtime indicator', () => {
  it('shows 加时 N in combat from 30 s on, keeps it across view pushes, and clears it once the battle stops', () => {
    vi.stubGlobal('document', { createElement: () => new FakeNode() });
    const host = new FakeNode(), countdown = new FakeNode();
    const sidebar = new PlayersSidebar(host as unknown as HTMLElement, countdown as unknown as HTMLElement);
    const timer = countdown.children.find(node => node.dataset.debug === 'online:timer')!;
    const view = (kind: 'combat' | 'preparation', endsAt: number | null) => ({ phase: { kind, round: 3, roundName: '2-1', endsAt, serverNow: 0 }, seats: [], mySeatId: 's0' }) as unknown as PlayerView;
    sidebar.render(view('combat', null));
    sidebar.tick(100);
    expect(timer.textContent).toBe('');
    sidebar.tick(S13_COMBAT_RULES.overtimeStartTick - 1);
    expect(timer.textContent).toBe('');
    expect(timer.classList.contains('overtime')).toBe(false);
    sidebar.tick(S13_COMBAT_RULES.overtimeStartTick);
    expect(timer.textContent).toBe('加时 15');
    expect(timer.classList.contains('overtime')).toBe(true);
    // A view push in the same battle keeps the indicator (no blank frame).
    sidebar.render(view('combat', null));
    expect(timer.textContent).toBe('加时 15');
    sidebar.tick(S13_COMBAT_RULES.maxTicks - 10);
    expect(timer.textContent).toBe('加时 1');
    // The battle finished (no running battle shown): nothing.
    sidebar.tick(null);
    expect(timer.textContent).toBe('');
    expect(timer.classList.contains('overtime')).toBe(false);
    // A phase with a deadline keeps its own countdown, whatever tick the last battle reached.
    sidebar.tick(S13_COMBAT_RULES.overtimeStartTick + 40);
    sidebar.render(view('preparation', 30_000));
    expect(timer.textContent).not.toContain('加时');
    expect(timer.classList.contains('overtime')).toBe(false);
  });
});
