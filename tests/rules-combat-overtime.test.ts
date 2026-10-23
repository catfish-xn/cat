import { createMatch } from '../src/simulation/match';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { describe, expect, it } from 'vitest';
import { overtimeStacks, overtimeBonusBps, overtimeReceivedBps, overtimeControlTicks, OVERTIME_MOVE_SPEED_BONUS_BPS, movementIntervalTicks } from '../src/simulation/combat-overtime';
import { S13_COMBAT_RULES } from '../src/simulation/s13-rules';
import { MAX_COMBAT_TICKS, COMBAT_TICK_MS, stepCombat, type CombatState, type CombatEvent } from '../src/simulation/combat';
import { resolveAbility } from '../src/simulation/combat-abilities';
import { EMPTY_RUNTIME, ensureMechanisms, interval, grantShield, applyStatus, origin, type S13Unit } from '../src/simulation/combat-s13-state';
import { commitMechanismHeal, executeMechanismEffect } from '../src/simulation/m8/s13-mechanisms';
import { flatAmount, asSource } from '../src/simulation/m8/s13-definitions';
import type { AbilityContext } from '../src/simulation/combat-s13-abilities';
import { makeHealRequest, resolveHeal } from '../src/simulation/m8/heal';
import { toLedgerEvents } from '../src/simulation/combat-ledger';
import { createCombatReplayRecorder, startCombatReplay } from '../src/simulation/combat-replay-view';
import { battle, unit } from './combat-helpers';

function fighter(id = 'p'): S13Unit {
  return unit(id, id === 'p' ? 'player' : 'enemy', id === 'p' ? 1 : 2, 3, {
    definitionId: 'irelia', ability: resolveAbility('irelia-ability', 1),
    hp: 100000, maxHp: 100000, attackDamage: 100, attackRange: 6, baseAttackSpeedBps: 10000,
    mana: 0, maxMana: 100000, armor: 0, magicResist: 0, baseCritChanceBps: 0,
    runtime: { ...EMPTY_RUNTIME }, statuses: [], shieldLayers: [], tasks: [], mechanics: [],
  }) as S13Unit;
}
function context(target: S13Unit, tick: number): AbilityContext {
  return { board: battle([]).board, units: [target], tick, events: [], packets: [], heals: [],
    combatId: 'overtime-test', draw: () => { throw Error('No RNG allowed in these effect vectors'); } };
}
const boundary = [[599, 0], [600, 1], [619, 1], [620, 2], [899, 15], [900, 16]] as const;
describe('10-23 overtime independent integer vectors', () => {
  it.each(boundary)('tick %i has %i stacks', (tick, stacks) => {
    expect(overtimeStacks(tick)).toBe(stacks);
    expect(overtimeBonusBps(tick)).toBe(stacks * 1000);
  });
  it('uses a fixed 50 ms tick, 900 tick timeout and a +50% overtime movement bonus', () => {
    expect(COMBAT_TICK_MS).toBe(50); expect(MAX_COMBAT_TICKS).toBe(900);
    expect(S13_COMBAT_RULES.maxTicks).toBe(900); expect(OVERTIME_MOVE_SPEED_BONUS_BPS).toBe(5000);
    // ceil(5 / speed): 1.0 -> 5, 1.5 -> 4 (overtime or frenzy), 2.0 -> 3 (both); flat, not per stack.
    expect([599, 600, 899].map(t => movementIntervalTicks(false, t))).toEqual([5, 4, 4]);
    expect([599, 600, 899].map(t => movementIntervalTicks(true, t))).toEqual([4, 3, 3]);
    expect(overtimeStacks(2600)).toBe(101); // no offensive cap
  });
  it.each([[599, 100, 20], [600, 110, 19], [620, 120, 17], [720, 170, 12], [740, 180, 12], [899, 250, 8], [900, 260, 8]])(
    'tick %i: 100 AD hits for %i; 1.0 base AS uses %i ticks', (tick, damage, period) => {
      const p = fighter(), e = fighter('e'); e.cooldownTicks = 1000;
      const result = stepCombat(battle([p, e], { tick: tick - 1, maxTicks: MAX_COMBAT_TICKS }));
      const packets = result.events.filter(e => e.type === 'packetDamage');
      expect(packets.filter(e => e.outcome.context.source.ownerId === 'p').map(e => e.outcome.hpDamage)).toEqual([damage]);
      expect(interval(p, tick)).toBe(period);
      expect(result.state.units.find(u => u.id === 'p')!.cooldownTicks).toBe(period);
      expect(result.state.rngDraws).toBe(1); // one ordinary attack, no overtime RNG
    });
  it.each([[599, 10000, 101, 20], [600, 9000, 90, 18], [700, 4000, 40, 8], [720, 3000, 30, 6], [740, 3000, 30, 6], [900, 3000, 30, 6]])(
    'tick %i receives %i bps: 101 heal/shield -> %i, 20 control ticks -> %i', (tick, bps, received, duration) => {
      expect(overtimeReceivedBps(tick)).toBe(bps);
      const target = fighter(); target.hp = 1;
      const src = origin(target), ctx = context(target, tick);
      grantShield(target, src, 101, tick + 100, tick, ctx.events);
      expect(target.shield).toBe(received);
      commitMechanismHeal(ctx, { source: src, targetId: target.id, amount: 101 });
      expect(target.hp).toBe(1 + received);
      applyStatus(target, src, 'stun', 0, 20, tick, ctx.events);
      expect(target.statuses[0].startsAtTick).toBe(tick + 1);
      expect(target.statuses[0].expiresAtTick).toBe(tick + 1 + duration);
    });
  it('half-up duration rounding, minimum one tick, and existing control/shield are preserved', () => {
    expect(overtimeControlTicks(5, 600)).toBe(5); // 4.5 -> 5
    expect(overtimeControlTicks(4, 600)).toBe(4); // 3.6 -> 4
    expect(overtimeControlTicks(1, 720)).toBe(1); // 0.3 -> minimum 1
    expect(overtimeControlTicks(15, 720)).toBe(5); // 4.5 -> 5
    const target = fighter(), src = origin(target);
    applyStatus(target, src, 'stun', 0, 100, 599, []);
    const before = structuredClone(target.statuses);
    grantShield(target, src, 101, 800, 599, []);
    grantShield(target, src, 101, 850, 720, []);
    expect(target.shield).toBe(101); // max(old remaining=101, new=30)
    expect(target.statuses).toEqual(before);
    applyStatus(target, src, 'stun', 0, 20, 620, []);
    expect(target.statuses[0].expiresAtTick).toBe(700); // max(old end, 621+16)
  });
  it('frozen effect path applies shield/control once and leaves other debuff durations intact', () => {
    const target = fighter(), src = asSource(origin(target)), ctx = context(target, 720);
    ensureMechanisms(target, 720, ctx.combatId);
    executeMechanismEffect(ctx, target, src, target, { kind: 'grant-shield', amount: flatAmount(101), durationTicks: 40,
      decay: { kind: 'none' }, onEnd: [], endTiming: 'post-damage', endTargeting: { kind: 'fixed', targetIds: [], ifMissing: 'skip' }, endEffects: [] }, 1);
    expect(target.shield).toBe(30);
    const status = { activation: 'next-tick', kind: 'stun', magnitudeBps: 0, duration: { kind: 'ticks', ticks: 15 },
      stackPolicy: { kind: 'refresh-same-instance', magnitude: 'replace', phase: 'preserve' }, polarity: 'harmful', removable: true, damageFilter: null, onEnd: null } as const;
    executeMechanismEffect(ctx, target, src, target, { kind: 'apply-status', status }, 2);
    expect(target.statuses[0].expiresAtTick).toBe(726);
    applyStatus(target, { ...origin(target), effectIndex: 1 }, 'armorReduction', 2000, 20, 720, []);
    expect(target.statuses.find(s => s.kind === 'armorReduction')!.expiresAtTick).toBe(741);
  });
  it('tick 900 still gives elimination priority over timeout', () => {
    const p = fighter(), e = fighter('e'); e.hp = 260; e.cooldownTicks = 1000;
    const result = stepCombat(battle([p, e], { tick: 899, maxTicks: MAX_COMBAT_TICKS }));
    expect(result.state).toMatchObject({ tick: 900, status: 'finished', result: 'playerWin' });
    expect(result.events.at(-1)).toMatchObject({ type: 'combatFinished', reason: 'elimination' });
  });
  it('an existing control keeps its expiration when stepping across tick 600', () => {
    const p = fighter(), e = fighter('e');
    applyStatus(p, origin(e), 'stun', 0, 100, 599, []);
    const result = stepCombat(battle([p, e], { tick: 599, maxTicks: MAX_COMBAT_TICKS }));
    expect(result.state.units.find(u => u.id === 'p')!.statuses![0].expiresAtTick).toBe(700);
    expect(result.events.filter(e => e.type === 'attack' && e.attackerId === 'p')).toEqual([]);
  });
  it('healing combines wound then overtime with two floors and conserved source shares', () => {
    const target = fighter(); target.hp = 1;
    const request = makeHealRequest('h', target.id, 'direct', null, [{ source: asSource(origin(target)), numerator: 101, denominator: 1 }]);
    const result = resolveHeal(request, target, 3300, 600);
    expect(result).toMatchObject({ requested: 101, afterWound: 60, actual: 60, preventedByWound: 41 }); // floor(floor(101*.67)*.9)
    expect(result.shares.reduce((sum, s) => sum + s.actual, 0)).toBe(60);
  });
  it('full ticks, sliced JSON continuation and authoritative replay agree through the 45 second draw', () => {
    const initial: CombatState = battle([fighter(), fighter('e')], { maxTicks: MAX_COMBAT_TICKS, combatId: 'overtime-replay', nextEventSeq: 0, strategy: buildStrategySnapshot(createMatch(42)) });
    const run = (slice: number) => {
      let state = structuredClone(initial); const events: CombatEvent[] = [];
      const recorder = createCombatReplayRecorder(state, []);
      while (state.status === 'running') {
        for (let i = 0; i < slice && state.status === 'running'; i++) {
          const next = stepCombat(state); recorder.record(state, next); state = next.state; events.push(...next.events);
        }
        state = JSON.parse(JSON.stringify(state));
      }
      return { initial, terminal: state, events: toLedgerEvents(events), replay: recorder.finish(state) };
    };
    const full = run(900), sliced = run(7);
    expect(sliced).toEqual(full);
    expect(full.terminal).toMatchObject({ tick: 900, result: 'draw', status: 'finished' });
    expect(full.terminal.units.every(u => u.alive)).toBe(true);
    expect(full.events.at(-1)).toMatchObject({ type: 'combatFinished', tick: 900, result: 'draw', reason: 'timeout' });
    expect(stepCombat(full.terminal)).toEqual({ state: full.terminal, events: [] });
    const task = startCombatReplay(full); let replay = null;
    while (!replay) replay = task.advance(7);
    expect(replay).toEqual(full.replay);
  }, 20000);
});
