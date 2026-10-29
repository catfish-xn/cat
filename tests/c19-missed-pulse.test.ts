import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolveTwoSidedBattle, startTwoSidedCombatWithEvents } from '../src/simulation/two-sided-battle';
import { stepCombat, type CombatState, type CombatEvent } from '../src/simulation/combat';
import { resolveAbility } from '../src/simulation/combat-abilities';
import { EMPTY_RUNTIME } from '../src/simulation/combat-s13-state';
import { ITEM_DEFINITIONS } from '../src/simulation/content';
import { EMPTY_MECHANISMS } from '../src/simulation/m8/runtime-types';
import { applyStatusContribution } from '../src/simulation/m8/status';
import { effectIdentity } from '../src/simulation/m8/identity';
import { advancePeriodicTask } from '../src/simulation/m8/periodic';
import type { PeriodicTask, StatusApplication } from '../src/simulation/m8/contracts';
import { battle, unit, freeze } from './combat-helpers';
import { source } from './fixtures/m8-contract-cases';
import { packets } from './helpers/replay2-views';

const fixture = () => JSON.parse(readFileSync(new URL('./fixtures/v25-online-rules-c19-seed-9-minimal.json', import.meta.url), 'utf8'));
const id = (seat: string, unitId: string) => JSON.stringify(['t2', seat, 'unit', unitId]);
function advance(state: CombatState, through: number) {
  const events: CombatEvent[] = [];
  while (state.tick < through && state.status === 'running') {
    const next = stepCombat(state); state = next.state; events.push(...next.events);
  }
  return { state, events };
}
const burnPackets = (events: readonly CombatEvent[]) => packets(events).filter(e => e.damageType === 'true');

// Real Sunfire program, limited to one application to isolate its full 200-tick
// burn lifetime from further refreshes. Neither dummy can attack, move or cast.
function isolated(holderId: string, mode: 'new-group' | 'new-source' | 'refresh', at = 40) {
  const sunfire = source('sunfire-cape', 'sunfire', holderId);
  const declaration = ITEM_DEFINITIONS['sunfire-cape'].combatProgram!.periodic![0];
  const task: PeriodicTask = { ...effectIdentity('standalone', sunfire, holderId),
    nextPulseAtTick: at, periodTicks: 40, endsAtTick: null, pulseOrdinal: 0, pulseLimit: 1, remainders: [],
    finalPulse: 'none', onSourceDeath: 'cancel', onTargetDeath: 'cancel',
    program: { ...declaration.program, definitionId: 'one-sunfire-application' } };
  const dummy = (name: string, team: 'player' | 'enemy', col: number) => unit(name, team, col, 3, {
    definitionId: 'neutral-stage-2', ability: resolveAbility('neutral-attack', 1), hp: 2015, maxHp: 2015,
    armor: 0, magicResist: 0, mana: 0, maxMana: 100_000, attackDamage: 0,
    cooldownTicks: 1000, moveCooldownTicks: 1000, statuses: [], shieldLayers: [], tasks: [], runtime: { ...EMPTY_RUNTIME },
  });
  const oldSource = mode === 'refresh' ? sunfire : source('old-burn', 'old', holderId);
  const oldBurn: StatusApplication = { kind: 'burn', magnitudeBps: mode === 'refresh' ? 100 : 50,
    activation: 'immediate', duration: { kind: 'ticks', ticks: 100 },
    stackPolicy: { kind: 'strongest-category', category: 'burn', retainSuppressed: true },
    polarity: 'harmful', removable: true, damageFilter: null, onEnd: null };
  const statuses = mode === 'new-group' ? [] : applyStatusContribution([], effectIdentity('standalone', oldSource, 'm-target'), oldBurn, 0).groups;
  const holder = { ...dummy(holderId, 'player', 1), mechanismDefinitions: { periodicTasks: [task], survivalTriggers: [], vamp: [] } };
  const target = { ...dummy('m-target', 'enemy', 2), mechanismState: { ...EMPTY_MECHANISMS, statuses } };
  return { state: battle([holder, target]), task };
}

describe('SR-C19-01 same-tick burn attachment', () => {
  it('reduced seed-9 compiled input finishes with one pulse per live 20-tick interval', () => {
    const input = freeze(fixture()), result = resolveTwoSidedBattle(input, 5000);
    expect(result.terminal).toMatchObject({ status: 'finished', tick: 346, result: 'enemyWin' });
    const pulses = burnPackets(result.events);
    // Both first applications are at 40. v22 (AD star factor, mana): Ezreal dies at 164: 60..160 = 6.
    // Garen dies at 346: 60..340 = 15, despite a new source joining at 200.
    for (const [unitId, deathTick, count] of [['unit-42', 164, 6], ['unit-48', 346, 15]] as const) {
      const target = id('s3', unitId);
      expect(result.events.find(e => e.type === 'death' && e.unitId === target)?.tick).toBe(deathTick);
      const paid = pulses.filter(e => e.unitId === target);
      expect(paid.map(e => e.tick)).toEqual(Array.from({ length: count }, (_, i) => 60 + i * 20));
      expect(paid).toHaveLength(Math.floor((deathTick - 40) / 20));
    }
    expect(pulses.filter(e => e.unitId === id('s3', 'unit-48')).reduce((sum, e) => sum + e.raw, 0)).toBe(302); // Garen Emissary adds 12% HP: 2016 × 1% = 20.16 per pulse; 15 pulses, each burn group carries its 0.16 remainder
    // so the 7th pulse of each group pays 21 (180 for item-21, 340 for item-12 from 220): 15 × 20 + 2
    // v22: the second Sunfire source reaches Garen at 200 (was 160) and keeps the group phase.
    const at200 = advance(startTwoSidedCombatWithEvents(input).state, 200).state;
    const target = at200.units.find(u => u.id === id('s3', 'unit-48'))!;
    expect(target.mechanismState!.periodicTasks.find(t => t.source.ownerId === id('s4', 'unit-15')))
      .toMatchObject({ nextPulseAtTick: 220, pulseOrdinal: 0, periodTicks: 20, endsAtTick: 400 });
    expect(target.mechanismState!.statuses.find(g => g.kind === 'burn')!.nextPulseAtTick).toBe(220);
    expect(advance(startTwoSidedCombatWithEvents(input).state, 199).state.units.find(u => u.id === id('s3', 'unit-48'))!
      .mechanismState!.periodicTasks.some(t => t.source.ownerId === id('s4', 'unit-15'))).toBe(false);
  });

  for (const holderId of ['a-holder', 'z-holder']) {
    it.each(['new-group', 'new-source', 'refresh'] as const)('%s at a due tick, holder ' + holderId, mode => {
      const start = isolated(holderId, mode), at40 = advance(start.state, 40);
      const target = at40.state.units.find(u => u.id === 'm-target')!;
      const task = target.mechanismState!.periodicTasks.find(t => t.source.instanceId === 'sunfire')!;
      expect(task).toMatchObject({ nextPulseAtTick: 60, periodTicks: 20, endsAtTick: 240,
        pulseOrdinal: mode === 'refresh' ? 2 : 0, finalPulse: 'before-expiry' });
      const before = burnPackets(at40.events);
      expect(before.map(e => e.tick)).toEqual(mode === 'new-group' ? [] : [20, 40]);
      if (mode === 'new-source') expect(before.map(e => e.source.instanceId)).toEqual(['old', 'old']);
      if (mode === 'refresh') expect(task.remainders).toMatchObject([{ numerator: 3000, denominator: 10000 }]);
      const rest = advance(at40.state, 260), paid = burnPackets(rest.events);
      // 200 ticks / 20 = 10 payments, including the expiry-tick payment, never at application.
      expect(paid.map(e => e.tick)).toEqual(Array.from({ length: 10 }, (_, i) => 60 + 20 * i));
      expect(paid.every(e => e.source.instanceId === 'sunfire')).toBe(true);
      const all = [...before, ...paid].filter(e => e.source.instanceId === 'sunfire');
      expect(all.reduce((sum, e) => sum + e.raw, 0)).toBe(Math.floor(2015 * 100 * all.length / 10000));
      expect(rest.state.units.find(u => u.id === 'm-target')!.mechanismState!.periodicTasks).toEqual([]);
    });
    it('preserves an existing off-tick group phase, holder ' + holderId, () => {
      const at41 = advance(isolated(holderId, 'new-source', 41).state, 41);
      const task = at41.state.units.find(u => u.id === 'm-target')!.mechanismState!.periodicTasks.find(t => t.source.instanceId === 'sunfire')!;
      expect(task).toMatchObject({ nextPulseAtTick: 60, pulseOrdinal: 0, endsAtTick: 241 });
      expect(burnPackets(advance(at41.state, 61).events).map(e => e.tick)).toEqual([60]);
    });
  }

  it('still rejects a genuinely missed pulse without backfilling or mutating the task', () => {
    const task = freeze(isolated('z-holder', 'new-group').task);
    expect(() => advancePeriodicTask(task, 41)).toThrow('Missed periodic pulse; never backfill');
    expect(task).toMatchObject({ nextPulseAtTick: 40, pulseOrdinal: 0 });
  });
});
