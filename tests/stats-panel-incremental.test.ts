import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createViewTally, tallyViewEvents, type CombatViewState, type DisplayCombatEvent } from '../src/presentation/combat-display';
import { createStatsPanel, type ReplayStatsView, type StatsPanel } from '../src/stats/stats-panel';

/** Only the DOM operations the component uses; all tally/cache/filter code runs unchanged. */
class Element {
  children: Element[] = []; parent: Element | null = null;
  dataset: Record<string, string> = {}; style: Record<string, string> = {};
  value = ''; className = ''; hidden = false; type = ''; scope = '';
  private text = ''; private listeners = new Map<string, () => void>();
  constructor(readonly tag: string) {}
  get textContent(): string { return this.text + this.children.map(child => child.textContent).join(''); }
  set textContent(text: string) { this.text = text; this.replaceChildren(); }
  get firstElementChild(): Element | null { return this.children[0] ?? null; }
  append(...children: Element[]): void { for (const child of children) { child.remove(); child.parent = this; this.children.push(child); } if (this.tag === 'select' && this.children.length && !this.value) this.value = this.children[0].value; }
  replaceChildren(...children: Element[]): void { for (const child of this.children) child.parent = null; this.children = []; this.append(...children); }
  remove(): void { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); this.parent = null; }
  setAttribute(): void {}
  addEventListener(type: string, listener: () => void): void { this.listeners.set(type, listener); }
  removeEventListener(type: string): void { this.listeners.delete(type); }
  change(value: string): void { this.value = value; this.listeners.get('change')?.(); }
  createTHead(): Element { const e = new Element('thead'); this.append(e); return e; }
  createTBody(): Element { const e = new Element('tbody'); this.append(e); return e; }
  insertRow(): Element { const e = new Element('tr'); this.append(e); return e; }
  insertCell(): Element { const e = new Element('td'); this.append(e); return e; }
  all(): Element[] { return [this, ...this.children.flatMap(child => child.all())]; }
  debug(value: string): Element { return this.all().find(e => e.dataset.debug === value)!; }
}
const damage = (tick: number, amount = tick): DisplayCombatEvent => ({ type: 'packetDamage', tick, eventSeq: tick,
  sourceId: 'a', targetId: 'b', damageType: (['physical', 'magic', 'true'] as const)[tick % 3], hit: true, hpDamage: amount, absorbed: 2, critical: false, killingPacket: false });
const heal = (tick: number): DisplayCombatEvent => ({ type: 'heal', tick, eventSeq: tick, targetId: 'a', actual: 3, shares: [{ sourceId: 'b', actual: 3 }] });
const unit = (id: string) => ({ id, definitionId: id === 'a' ? 'corki' : 'loris', team: 'player', starLevel: 1, cell: { col: 0, row: 0 }, hp: 100, maxHp: 100, mana: 0, maxMana: 100,
  shield: 0, alive: true, targetId: null, attackDamage: 40, abilityPower: 100, armor: 20, magicResist: 20, attackRange: 1, attackIntervalTicks: 20 });
const view = (events: DisplayCombatEvent[], changes: Partial<ReplayStatsView> = {}): ReplayStatsView => ({ stats: null, runId: 'run-1',
  combat: { combatId: 'battle-1', tick: 0, units: [unit('a'), unit('b')] } as CombatViewState, events, selectedUnitId: 'a', ...changes });
const snapshot = (host: Element) => ({ table: host.debug('m6-stats-table').textContent, detail: host.debug('m6-stats-details').textContent,
  lines: host.all().find(e => e.tag === 'ol')!.children.map(e => e.textContent), range: host.all().find(e => e.tag === 'ol')!.parent!.children[1].textContent });

describe('incremental online stats and event list', () => {
  const panels: StatsPanel[] = [];
  beforeEach(() => {
    vi.stubGlobal('document', { createElement: (tag: string) => new Element(tag) });
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  });
  afterEach(() => { panels.splice(0).forEach(panel => panel.dispose()); vi.unstubAllGlobals(); });
  function mount() { const host = new Element('div'), panel = createStatsPanel(host as unknown as HTMLElement, () => {}); panels.push(panel); return { host, panel }; }
  function full(next: ReplayStatsView, filter = 'all') {
    const { host, panel } = mount(); panel.render({ ...next, events: [...next.events] }); host.debug('m6-stats-filter').change(filter); const result = snapshot(host); panel.dispose(); return result;
  }

  it('appends one event at a time with the same totals/detail/list as a full scan, including the 80-line cap', () => {
    const events: DisplayCombatEvent[] = [], { host, panel } = mount();
    for (let i = 1; i <= 105; i++) {
      events.push(i % 4 === 0 ? heal(i) : damage(i)); const next = view(events);
      panel.render(next); expect(snapshot(host)).toEqual(full(next));
      // An unchanged render must neither recount nor duplicate lines.
      panel.render(next); expect(snapshot(host)).toEqual(full(next));
    }
    const result = snapshot(host); expect(result.lines).toHaveLength(80); expect(result.range).toContain('共 105 条');
    expect(result.lines[0]).toContain('第 26 tick'); expect(result.lines.at(-1)).toContain('第 105 tick');
    expect(events).toHaveLength(105);
  });

  it.each(['new battle', 'reconnect', 'seek backward', 'same-array rewind', 'same-array replacement', 'empty then resume'])('%s resets totals and event-list cursors', scenario => {
    const events = [damage(1, 11), heal(2), damage(3, 33)], { host, panel } = mount(); panel.render(view(events));
    let next = view(events);
    if (scenario === 'new battle') next = view([damage(1, 7)], { combat: { ...next.combat, combatId: 'battle-2' } });
    if (scenario === 'reconnect') next = view([damage(1, 99), heal(2), damage(3, 55)]); // same length, fresh log
    if (scenario === 'seek backward') next = view(events.slice(0, 1));
    if (scenario === 'same-array rewind') { events.length = 1; }
    if (scenario === 'same-array replacement') { events.splice(0, events.length, damage(1, 71), heal(2), damage(3, 5)); }
    if (scenario === 'empty then resume') { events.length = 0; panel.render(next); expect(snapshot(host)).toEqual(full(next)); events.push(heal(4)); }
    panel.render(next); expect(snapshot(host)).toEqual(full(next));
    (next.events as DisplayCombatEvent[]).push(damage(4, 17)); panel.render(next); expect(snapshot(host)).toEqual(full(next));
  });

  it('filter and selected-unit changes rebuild the list, then continue appending without losing older matching lines', () => {
    const events = [damage(1), heal(2)], { host, panel } = mount(); panel.render(view(events));
    host.debug('m6-stats-filter').change('heal'); expect(snapshot(host)).toEqual(full(view(events), 'heal'));
    events.push(damage(3), heal(4)); panel.render(view(events)); expect(snapshot(host)).toEqual(full(view(events), 'heal'));
    const next = view(events, { selectedUnitId: 'b' }); panel.render(next); expect(snapshot(host)).toEqual(full(next, 'heal'));
    host.debug('m6-stats-filter').change('damage'); expect(snapshot(host)).toEqual(full(next, 'damage'));
  });

  it('incremental tally has independent numeric expectations and returns detached sorted snapshots', () => {
    const events = [damage(1, 10), damage(2, 20), damage(3, 30), heal(4)], tally = createViewTally();
    for (let i = 0; i < events.length; i++) { tally.add(events.slice(0, i + 1), i); expect(tally.rows()).toEqual(tallyViewEvents(events.slice(0, i + 1))); }
    expect(tally.rows()).toEqual([
      { unitId: 'a', hpDamage: 60, physicalHpDamage: 30, magicHpDamage: 10, trueHpDamage: 20, shieldAbsorbed: 0, healingReceived: 3 },
      { unitId: 'b', hpDamage: 0, physicalHpDamage: 0, magicHpDamage: 0, trueHpDamage: 0, shieldAbsorbed: 6, healingReceived: 0 },
    ]);
    const snapshot = tally.rows(); snapshot[0].hpDamage = 999; expect(tally.rows()[0].hpDamage).toBe(60);
    tally.add(events, events.length); expect(tally.rows()[0].hpDamage).toBe(60);
  });
});
