import { describe, expect, it, vi } from 'vitest';
import type { DisplayCombatEvent } from '../src/presentation/combat-display';
import { createBatch2VfxBridge } from '../src/rendering/three-mode/vfx-ltk/batch2-bridge';
import { CUE_EXTRA_SKILLS, CUE_OVERRIDES } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import { realUnits, runRealCombat } from '../dev/castcmp/real-combat';

// Violet's combo hits play as their damage lands (the rules settle the jabs, then the uppercut, each on its own tick), not on
// one fixed moment after her cast.
function bridge(definitionOf: (id: string) => string = () => 'violet') {
  const play = vi.fn((..._args: unknown[]) => true);
  const host = { unit: (id: string) => ({ definitionId: definitionOf(id), form: 'front' as const, alive: true, starLevel: 2 }), board: () => null, play };
  return { b: createBatch2VfxBridge(host as never), play };
}
const cast = (tick: number): DisplayCombatEvent => ({ type: 'cast', eventSeq: tick, tick, sourceId: 'v', actionSeq: 1, targetIds: ['t'], completed: true,
  actualManaSpent: 0, refundedMana: 0, completionCell: { col: 0, row: 0 } } as DisplayCombatEvent);
const hit = (tick: number, over: Record<string, unknown> = {}): DisplayCombatEvent => ({ type: 'packetDamage', eventSeq: tick, tick, sourceId: 'v', targetId: 't',
  damageType: 'physical', sourceKind: 'ability', definitionId: 'violet-ability', delivery: 'ability-direct', hit: true, hpDamage: 50, absorbed: 0, critical: false,
  killingPacket: false, ...over } as DisplayCombatEvent);

describe('Violet\'s combo', () => {
  it('her cast draws none of it; each hit plays as its damage lands, the jabs first, then the uppercut', () => {
    const { b, play } = bridge();
    b.begin([cast(10)]); b.event(cast(10), true);
    expect(b.action('cast', 'v', ['t'], cast(10) as never)).toBe(true);
    expect(play).not.toHaveBeenCalled();
    // Not hers: an item's damage, another target, a basic attack, damage on the cast's own tick.
    for (const other of [hit(12, { sourceKind: 'item' }), hit(12, { targetId: 'x' }), hit(12, { delivery: 'basic-attack' }), hit(10)]) b.event(other, true);
    expect(play).not.toHaveBeenCalled();
    for (const t of [11, 15, 31]) b.event(hit(t), true);
    expect(play.mock.calls.map(c => (c[4] as { skill: string }).skill)).toEqual(['violet-jab', 'violet-jab', 'violet-uppercut']);
    expect(play.mock.calls.every(c => (c[4] as { delay?: number }).delay === undefined)).toBe(true);
    // The combo is spent: a later hit of hers plays nothing until her next cast.
    b.event(hit(40), true); expect(play).toHaveBeenCalledTimes(3);
  });
  it('hits seen in catch-up are counted but not played, so the uppercut stays the last hit', () => {
    const { b, play } = bridge();
    b.event(cast(10), false); b.event(hit(11), false); b.event(hit(15), false); b.event(hit(31), true);
    expect(play.mock.calls.map(c => (c[4] as { skill: string }).skill)).toEqual(['violet-uppercut']);
  });
  it('her list keeps only her basic attack\'s hit; the combo\'s systems live in its two branches', () => {
    expect(CUE_OVERRIDES.violet!.map(cue => cue.action)).toEqual(['attack']);
    expect(CUE_EXTRA_SKILLS['violet-jab']!.every(cue => cue.delay === 0)).toBe(true);
    expect(CUE_EXTRA_SKILLS['violet-uppercut']!.every(cue => cue.delay === 0)).toBe(true);
  });
  it('in a real combat her combo plays on the ticks its damage lands, jabs then uppercut', () => {
    const units = realUnits({ unit: 'violet', star: 2, form: null, foe: 'amumu', dist: 1, nfoes: 1, foestar: 2 } as never);
    const { b, play } = bridge(id => id === 'me' ? 'violet' : 'amumu');
    const ticks: number[] = []; let damage: number[] = [];
    runRealCombat(units, 40, (_s, shown) => { const events = shown as DisplayCombatEvent[]; b.begin(events);
      for (const e of events) { const before = play.mock.calls.length; b.event(e, true); if (play.mock.calls.length > before) ticks.push((e as { tick: number }).tick); } });
    const skills = play.mock.calls.map(c => (c[4] as { skill: string }).skill).filter(s => s.startsWith('violet-'));
    expect(skills.slice(0, 3)).toEqual(['violet-jab', 'violet-jab', 'violet-uppercut']);
    damage = ticks.slice(0, 3);
    expect(new Set(damage).size).toBe(3);
  });
});
