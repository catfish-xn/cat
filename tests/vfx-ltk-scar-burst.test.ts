import { describe, expect, it } from 'vitest';
import type { DisplayCombatEvent } from '../src/presentation/combat-display';
import { createBatch1VfxEvents } from '../src/rendering/three-mode/vfx-ltk/batch1-events';
import { CUE_EXTRA_SKILLS } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import { mapSkillTimeline } from '../src/rendering/three-mode/vfx-ltk/timeline';

// Scar's big burst plays with his skill's damage, once, on his main target, not at a fixed time after his cast.
const damage = (eventSeq: number, tick: number, targetId: string, sourceKind = 'ability', delivery = 'ability-direct'): DisplayCombatEvent =>
  ({ type: 'packetDamage', tick, eventSeq, sourceId: 'sc', targetId, damageType: 'magic', sourceKind, delivery, raw: 50, actual: 50 } as unknown as DisplayCombatEvent);
const cast = (eventSeq: number, tick: number, targetIds: string[]) => ({ type: 'cast', sourceId: 'sc', eventSeq, tick, actionSeq: 1, completed: true,
  actualManaSpent: 60, refundedMana: 0, targetIds, completionCell: { col: 0, row: 0 } }) as DisplayCombatEvent;
const definitions: Record<string, string> = { sc: 'scar', f1: 'amumu', f2: 'amumu', f3: 'amumu' };
const bursts = (events: DisplayCombatEvent[]) => createBatch1VfxEvents(id => definitions[id]).batch(events)
  .map(p => p.extra.filter(x => x.skill === 'scar-burst').map(x => x.targets));

describe("Scar's burst follows his damage", () => {
  it('once per damage tick, on the cast\'s first target (the nearest struck), whatever order the packets come in', () =>
    // The rules emit a tick's packets by target id, not by distance: f2 is his nearest enemy here.
    expect(bursts([cast(1, 5, ['f2', 'f1', 'f3']), damage(2, 5, 'f1'), damage(3, 5, 'f2'), damage(4, 5, 'f3')])).toEqual([[], [['f2']], [], []]));
  it('falls back to the first enemy struck when no cast names one', () =>
    expect(bursts([damage(1, 5, 'f3'), damage(2, 5, 'f1')])).toEqual([[['f3']], []]));
  it('his attacks and other damage plan none', () =>
    expect(bursts([damage(1, 6, 'f1', 'attack', 'basic-attack'), damage(2, 7, 'f1', 'ability', 'ability-periodic')])).toEqual([[], []]));
  it('the burst sits on the target\'s ground, at the damage itself (no delay), for its own time', () => {
    expect(CUE_EXTRA_SKILLS['scar-burst']!.map(c => [c.system, c.event, c.delay, c.bone, c.ownLife])).toEqual([['9f028364', 'hit', 0, 'BUFFBONE_GLB_GROUND_LOC', true]]);
    expect(mapSkillTimeline(CUE_EXTRA_SKILLS['scar-burst']!, 'sc', ['f2']).spawns.map(s => s.delay)).toEqual([0]);
  });
});
