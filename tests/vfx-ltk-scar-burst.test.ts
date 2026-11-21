import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DisplayCombatEvent } from '../src/presentation/combat-display';
import { createBatch1VfxEvents } from '../src/rendering/three-mode/vfx-ltk/batch1-events';
import { CUE_EXTRA_SKILLS } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import { mapSkillTimeline } from '../src/rendering/three-mode/vfx-ltk/timeline';
import { stepCombat, type CombatEvent, type CombatState, type CombatUnit } from '../src/simulation/combat';
import { resolveAbility } from '../src/simulation/combat-abilities';
import { EMPTY_RUNTIME } from '../src/simulation/combat-s13-state';
import { battle, unit } from './combat-helpers';
import { packets } from './helpers/replay2-views';

// Scar's big burst plays with his skill's damage, once, on his main target, not at a fixed time after his cast.
const damage = (eventSeq: number, tick: number, targetId: string, sourceKind = 'ability', delivery = 'ability-direct'): DisplayCombatEvent =>
  ({ type: 'packetDamage', tick, eventSeq, sourceId: 'sc', targetId, damageType: 'magic', sourceKind, delivery, raw: 50, actual: 50 } as unknown as DisplayCombatEvent);
const cast = (eventSeq: number, tick: number, targetIds: string[]) => ({ type: 'cast', sourceId: 'sc', eventSeq, tick, actionSeq: 1, completed: true,
  actualManaSpent: 60, refundedMana: 0, targetIds, completionCell: { col: 0, row: 0 } }) as DisplayCombatEvent;
const definitions: Record<string, string> = { sc: 'scar', f1: 'amumu', f2: 'amumu', f3: 'amumu' };
const bursts = (events: DisplayCombatEvent[]) => createBatch1VfxEvents(id => definitions[id]).batch(events)
  .map(p => p.extra.filter(x => x.skill === 'scar-burst').map(x => x.targets));

afterEach(() => vi.restoreAllMocks());

describe("Scar's burst follows his damage", () => {
  it('once per damage tick, on the cast\'s first target (the nearest struck), whatever order the packets come in', () =>
    // The rules emit a tick's packets by target id, not by distance: f2 is his nearest enemy here.
    expect(bursts([cast(1, 5, ['f2', 'f1', 'f3']), damage(2, 5, 'f1'), damage(3, 5, 'f2'), damage(4, 5, 'f3')])).toEqual([[], [['f2']], [], []]));
  it('without a same-tick cast naming a struck enemy it warns (dev) and falls back to the first struck, never silently', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(bursts([damage(1, 5, 'f3'), damage(2, 5, 'f1')])).toEqual([[['f3']], []]);
    expect(warn.mock.calls.some(([message]) => String(message).includes('scar-burst'))).toBe(true);
  });
  it('no warning when the cast names the target', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    bursts([cast(1, 5, ['f2']), damage(2, 5, 'f2')]);
    expect(warn.mock.calls.some(([message]) => String(message).includes('scar-burst'))).toBe(false);
  });
  it('his attacks and other damage plan none', () =>
    expect(bursts([damage(1, 6, 'f1', 'attack', 'basic-attack'), damage(2, 7, 'f1', 'ability', 'ability-periodic')])).toEqual([[], []]));
  it('the burst sits on the target\'s ground, at the damage itself (no delay), for its own time', () => {
    expect(CUE_EXTRA_SKILLS['scar-burst']!.map(c => [c.system, c.event, c.delay, c.bone, c.ownLife])).toEqual([['9f028364', 'hit', 0, 'BUFFBONE_GLB_GROUND_LOC', true]]);
    expect(mapSkillTimeline(CUE_EXTRA_SKILLS['scar-burst']!, 'sc', ['f2']).spawns.map(s => s.delay)).toEqual([0]);
  });
});

// The premise the main-target lookup stands on: the rules deal his skill's damage on the cast tick, so his cast (which names
// the main target first) arrives with it. A rules change that lands it later (rules timing alignment) fails here, and the
// lookup in batch1-events.ts has to take the main target from that cast some other way.
describe("rules premise: Scar's skill damage lands on his cast tick", () => {
  const hero: CombatUnit = unit('p', 'player', 1, 3, { definitionId: 'scar', ability: resolveAbility('scar-ability', 1), hp: 3000, maxHp: 5000, armor: 0, magicResist: 0,
    mana: 100, maxMana: 100, attackDamage: 100, attackRange: 1, abilityPower: 100, baseAttackSpeedBps: 10000,
    runtime: { ...EMPTY_RUNTIME }, statuses: [], shieldLayers: [], tasks: [], mechanics: [] });
  const dummy = (id: string, col: number, row = 3): CombatUnit => unit(id, 'enemy', col, row, { definitionId: 'neutral-stage-2', ability: resolveAbility('neutral-attack', 1),
    hp: 100000, maxHp: 100000, mana: 0, maxMana: 1, attackDamage: 0, cooldownTicks: 1000, moveCooldownTicks: 1000, runtime: { ...EMPTY_RUNTIME }, statuses: [], shieldLayers: [], tasks: [] });
  it('the cast and every ability hit come in the same step, and the cast names the struck enemies', () => {
    let state: CombatState = battle([hero, dummy('e', 2), dummy('f', 1, 2), dummy('g', 2, 2)], { rngState: 42 });
    const steps: CombatEvent[][] = [];
    for (let n = 0; n < 40 && state.status === 'running'; n++) { const r = stepCombat(state); state = r.state; steps.push([...r.events]); }
    const castStep = steps.findIndex(events => events.some(e => e.type === 'cast'));
    expect(castStep).toBeGreaterThanOrEqual(0);
    const hitsIn = (events: readonly CombatEvent[]) => packets(events).filter(x => x.source.ownerId === 'p' && x.source.sourceKind === 'ability');
    const struck = hitsIn(steps[castStep]!).map(x => x.unitId);
    expect(struck.length).toBeGreaterThan(0);
    expect(steps.slice(castStep + 1).flatMap(hitsIn)).toEqual([]);
    const castEvent = steps[castStep]!.find(e => e.type === 'cast') as unknown as { receipt: { targetIds: string[] } };
    expect(struck.every(id => castEvent.receipt.targetIds.includes(id))).toBe(true);
  });
});
