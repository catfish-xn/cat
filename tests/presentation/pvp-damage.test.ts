import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPvpDamageFeedback, pvpDamagePlans } from '../../src/presentation/pvp-damage';
import { countsG23SurvivorDamage } from '../../src/simulation/g2-3-summons';
import type { MatchState, RoundResult } from '../../src/simulation/match-types';
import type { FinishedBattle } from '../../src/rendering/online/remote-session';
import type { PlayerView } from '../../src/rendering/online/protocol';

const result = (changes: Partial<RoundResult> = {}): RoundResult => ({ round: 4, roundId: '2-1', roundKind: 'pvp', result: 'playerWin',
  damageDealt: 3, hpLost: 0, playerDamage: 99, ...changes } as RoundResult);
const battle = (round = 4): FinishedBattle => ({ round, roundId: '2-1', replay: { terminal: { units: [
  { id: 'p', definitionId: 'jinx', team: 'player', alive: true, cell: { col: 2, row: 3 }, damageDealt: 9999 },
  { id: 'dead', definitionId: 'vi', team: 'player', alive: false, cell: { col: 0, row: 0 } },
  { id: 'e', definitionId: 'vi', team: 'enemy', alive: true, cell: { col: 4, row: 1 } },
] } } } as FinishedBattle);
const state = (...roundResults: RoundResult[]) => ({ roundResults }) as unknown as MatchState;
const view = (opponentSeatId: string | null = 's1', round = 4, hp = 2) => ({ mySeatId: 's0', opponentSeatId,
  phase: { round }, seats: [{ seatId: 's0', hp: 80 }, { seatId: 's1', hp }, { seatId: 's2', hp: 60 }] }) as unknown as PlayerView;

/** Minimal DOM recorder: selectors/tree operations only; CSS/real Chromium are separate visual verification. */
class Node {
  className = ''; textContent = ''; parentNode: Node | null = null;
  dataset: Record<string, string> = {}; children: Node[] = [];
  style = { animationDelay: '', values: new Map<string, string>(), setProperty(key: string, value: string) { this.values.set(key, value); } };
  classList = { add: vi.fn() };
  get lastChild(): Node | null { return this.children.at(-1) ?? null; }
  append(...nodes: Node[]) { for (const node of nodes) { node.remove(); node.parentNode = this; this.children.push(node); } }
  prepend(node: Node) { this.insertBefore(node, this.children[0] ?? null); }
  insertBefore(node: Node, before: Node | null) { node.remove(); node.parentNode = this; const at = before ? this.children.indexOf(before) : this.children.length; this.children.splice(at, 0, node); }
  remove() { if (this.parentNode) this.parentNode.children.splice(this.parentNode.children.indexOf(this), 1); this.parentNode = null; }
  querySelector(selector: string): Node | undefined { return this.querySelectorAll(selector)[0]; }
  querySelectorAll(selector: string): Node[] {
    return this.children.flatMap(node => [
      ...(selector === '[data-pvp-damage]' ? node.dataset.pvpDamage ? [node] : [] : node.className.split(' ').includes(selector.slice(1)) ? [node] : []),
      ...node.querySelectorAll(selector),
    ]);
  }
}
function setup() {
  vi.useFakeTimers(); vi.spyOn(performance, 'now').mockReturnValue(0);
  vi.stubGlobal('document', { createElement: () => new Node() });
  const root = new Node(), publish = vi.fn();
  const rebuild = () => {
    root.children = [];
    for (const id of ['s0', 's1', 's2']) {
      const row = new Node(); row.className = 'online-seat'; row.dataset.debug = `online:seat:${id}`;
      const bar = new Node(); bar.className = 'seat-bar'; const foot = new Node(); foot.className = 'seat-foot';
      row.append(bar, foot); root.append(row);
    }
  };
  rebuild();
  return { root, publish, rebuild, fx: createPvpDamageFeedback(root as unknown as HTMLElement, publish) };
}
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('authoritative PvP damage presentation', () => {
  it('uses actual overkill/Mel-capped damageDealt and terminal survivors, never unit damage or playerDamage', () => {
    expect(pvpDamagePlans(result(), battle())).toEqual([{ key: 'round:4:2-1', target: 'opponent', damage: 3, sources: [{ col: 2, row: 3 }] }]);
    expect(pvpDamagePlans(result({ result: 'enemyWin', hpLost: 1, damageDealt: 0 }), battle())).toEqual([
      { key: 'round:4:2-1', target: 'me', damage: 1, sources: [{ col: 4, row: 1 }] },
    ]);
    expect(pvpDamagePlans(result(), battle(3))[0]!.sources).toEqual([]);
  });
  it('suppresses mirror/zero/missing/invalid damage and PvE/supply; never invents a loss', () => {
    for (const damageDealt of [0, undefined, -1, NaN, Infinity, 1.5]) expect(pvpDamagePlans(result({ damageDealt }), battle())).toEqual([]);
    for (const roundKind of ['pve', 'supply'] as const) expect(pvpDamagePlans(result({ roundKind, hpLost: 5 }), battle())).toEqual([]);
  });
  it('keeps both authoritative losses on a draw, including mutual elimination without any source', () => {
    const empty = battle();
    const ended = { ...empty, replay: { ...empty.replay, terminal: { ...empty.replay.terminal, units: [] } } };
    expect(pvpDamagePlans(result({ result: 'draw', damageDealt: 5, hpLost: 2 }), ended)).toEqual([
      { key: 'round:4:2-1', target: 'opponent', damage: 5, sources: [] },
      { key: 'round:4:2-1', target: 'me', damage: 2, sources: [] },
    ]);
    expect(pvpDamagePlans(result({ result: 'draw', damageDealt: 0, hpLost: 2 }), ended)).toEqual([
      { key: 'round:4:2-1', target: 'me', damage: 2, sources: [] },
    ]);
  });
  it('keeps the total but never uses initial/foreign replay units as terminal sources', () => {
    const recorded = battle();
    for (const missing of [null, battle(3), { ...recorded, roundId: '2-2' },
      { ...recorded, replay: { ...recorded.replay, stream: { revision: 1, fromTick: 0, ended: false } } }]) {
      expect(pvpDamagePlans(result(), missing)).toEqual([
        { key: 'round:4:2-1', target: 'opponent', damage: 3, sources: [] },
      ]);
    }
    expect(pvpDamagePlans(result(), { ...recorded, replay: { ...recorded.replay,
      stream: { revision: 1, fromTick: 0, ended: true } } })[0]!.sources).toEqual([{ col: 2, row: 3 }]);
  });
  it.each([
    { definitionId: 'g23-forge' }, { definitionId: 'g23-barrel' }, { definitionId: 'v20-silco-minion' },
    { definitionId: 'g23-sion' }, { definitionId: 'b5-voidling' },
    { definitionId: 'trainer-golem' }, { definitionId: 'carry-golem' },
    { definitionId: 's13-wolf', anomalySummon: { kind: 'wolf' } },
    { definitionId: 's13-mini', anomalySummon: { kind: 'mini' } },
    { definitionId: 's13-crab', anomalySummon: { kind: 'crab' } },
    { definitionId: 'g24-voidspawn', itemSummon: { kind: 'voidspawn' } },
  ])('excludes $definitionId on both sides consistently with player-damage rules', origin => {
    const recorded = battle(), terminal = recorded.replay.terminal;
    expect(countsG23SurvivorDamage({ ...origin, alive: true })).toBe(false);
    expect(countsG23SurvivorDamage({ definitionId: 'jinx', alive: true })).toBe(true);
    // Send only compact replay fields: the origin flags must not be needed by the UI.
    const units = [origin.definitionId, 'jinx']
      .map((definitionId, col) => ({ ...terminal.units[0]!, id: `p${col}`, definitionId, cell: { col, row: 3 } }));
    const replay = { ...recorded.replay, terminal: { ...terminal, units: [...units,
      ...units.map(unit => ({ ...unit, id: `e${unit.id}`, team: 'enemy' as const, cell: { ...unit.cell, row: 1 } }))] } };
    const plans = pvpDamagePlans(result({ result: 'draw', hpLost: 2 }), { ...recorded, replay });
    expect(plans.map(plan => plan.damage)).toEqual([3, 2]);
    expect(plans.map(plan => plan.sources)).toEqual([
      [{ col: 1, row: 3 }], [{ col: 1, row: 1 }],
    ]);
  });
  it('paints and publishes both sides of a draw exactly once', () => {
    const { fx, root, publish } = setup();
    fx.state(state(), null); fx.view(view());
    const draw = result({ result: 'draw', damageDealt: 5, hpLost: 2 });
    fx.state(state(draw), null); fx.state(state(draw), null);
    expect(root.querySelectorAll('.seat-damage').map(node => node.textContent)).toEqual(['-2', '-5']);
    expect(root.querySelectorAll('.seat-lost').map(node => node.style.values.get('--lost-from'))).toEqual(['82%', '7%']);
    expect(publish.mock.calls.map(([hit]) => [hit.target, hit.damage, hit.sources])).toEqual([
      ['opponent', 5, []], ['me', 2, []],
    ]);
    fx.dispose(); expect(vi.getTimerCount()).toBe(0);
  });
  it('paints the just-fought opponent, preserves exact -N across row rebuilds, and never replays a duplicate state', () => {
    const { fx, root, publish, rebuild } = setup();
    fx.state(state(), null); fx.view(view()); fx.state(state(result()), battle());
    const chip = root.querySelector('.seat-damage')!;
    expect(chip.textContent).toBe('-3'); expect(chip.parentNode?.parentNode?.dataset.debug).toBe('online:seat:s1');
    expect(root.querySelector('.seat-lost')!.style.values.get('--lost-from')).toBe('5%');
    expect(root.querySelector('.seat-lost')!.style.values.get('--lost-to')).toBe('2%');
    rebuild(); fx.view(view('s2', 5)); fx.state(state(result()), battle());
    expect(root.querySelector('.seat-damage')!.textContent).toBe('-3'); expect(publish).toHaveBeenCalledOnce();
    expect(root.querySelector('.seat-damage')!.parentNode?.parentNode?.dataset.debug).toBe('online:seat:s1');
    vi.advanceTimersByTime(2600); expect(root.querySelectorAll('[data-pvp-damage]')).toHaveLength(0);
    fx.dispose(); expect(vi.getTimerCount()).toBe(0);
  });
  it('handles state-before-view, seeds a reconnect without historical feedback and ignores stale results', () => {
    const { fx, publish } = setup();
    fx.state(state(result({ round: 3 })), battle(3)); expect(publish).not.toHaveBeenCalled();
    fx.state(state(result()), battle()); expect(publish).not.toHaveBeenCalled();
    fx.view(view()); expect(publish).toHaveBeenCalledOnce();
    fx.state(state(result({ round: 3 })), battle(3)); fx.state(state(result()), battle()); expect(publish).toHaveBeenCalledOnce();
    fx.dispose(); fx.state(state(result({ round: 5 })), battle(5)); fx.view(view()); expect(publish).toHaveBeenCalledOnce();
  });
  it('reset cancels timers and pending feedback before a new match', () => {
    const { fx, root, publish } = setup();
    fx.state(state(), null); fx.state(state(result()), battle()); fx.reset(); fx.view(view());
    expect(publish).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
    fx.state(state(), null); fx.state(state(result()), battle()); expect(publish).toHaveBeenCalledOnce();
    fx.dispose(); expect(root.querySelectorAll('[data-pvp-damage]')).toHaveLength(0); expect(vi.getTimerCount()).toBe(0);
  });
  it('scopes deduplication to a match so another match on the same mounted 3D board plays the same round again', () => {
    const { fx, publish } = setup();
    fx.view(view()); fx.state(state(), null); fx.state(state(result()), battle());
    const first = publish.mock.calls[0]![0].key;
    fx.reset(); fx.view(view()); fx.state(state(), null); fx.state(state(result()), battle());
    expect(publish).toHaveBeenCalledTimes(2); expect(publish.mock.calls[1]![0].key).not.toBe(first);
    fx.dispose();
  });
});
