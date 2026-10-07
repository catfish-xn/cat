import { describe, expect, it } from 'vitest';
import { createMatch, selectChoice, combineItems, equipItem, deployMatchUnit, startMatchCombat, stepMatch } from '../src/simulation/match';
import { serializeMatch, restoreMatch } from '../src/simulation/serialization';
import { BattleHistory, validateBattleRecord } from '../src/replay';
import type { CombatEvent } from '../src/simulation/combat';
import { accepted, battle } from './match-helpers';
import { validateShield, grantShieldState, endShield } from '../src/simulation/m8/shield';
import { type S13Unit } from '../src/simulation/combat-s13-state';
import { type AbilityContext } from '../src/simulation/combat-s13-abilities';
import { commitMechanismHeal } from '../src/simulation/m8/s13-mechanisms';
import { amount, source } from './fixtures/m8-contract-cases';
import { effectIdentity } from '../src/simulation/m8/identity';
import type { Effect } from '../src/simulation/m8/contracts';

describe('B3 audit independent lifecycle and identity expectations', () => {
  it('R1 real dragon claw: tick39 canonical save→restore→tick40 complete events equal and continued archive validates', () => {
    let state = createMatch(42);
    while (state.phase === 'choice') {
      const c = state.pendingChoice!;
      state = accepted(selectChoice(state, c.choiceId, c.generation, c.kind === 'component' ? 'cloak' : c.offers.find(id => id !== 'placebo' && id !== 'glass-cannon-i')!));
    }
    const cloaks = state.items.filter(i => i.definitionId === 'cloak');
    state = accepted(combineItems(state, cloaks[0].id, cloaks[1].id));
    state = accepted(equipItem(state, state.items.find(i => i.definitionId === 'dragons-claw')!.id, 'unit-1', 0));
    for (const [i, id] of ['unit-1','unit-2','unit-3'].entries()) state = accepted(deployMatchUnit(state, id, { kind: 'board', cell: { col: 1 + 2 * i, row: 4 } }));
    const history = new BattleHistory('audit-r1');
    const observe = (next: ReturnType<typeof stepMatch>, reason: 'command' | 'tick') => {
      history.observe({ before: state, after: next.state, events: next.events.filter((e): e is CombatEvent => e.domain === 'combat'), reason }); state = next.state;
    };
    const start = startMatchCombat(state); if (!start.ok) throw Error(start.reason);
    observe(start, 'command');
    while (state.combat!.tick < 39) observe(stepMatch(state), 'tick');
    expect(state.combat!.units.find(u => u.id === 'unit-1')).toMatchObject({ hp: 699, maxHp: 763 });
    const restored = restoreMatch(serializeMatch(state)), direct = stepMatch(state), continued = stepMatch(restored);
    // floor(763×250/10000)=19; 699+19=718. Identity must survive key sorting.
    expect(continued.events).toEqual(direct.events);
    expect(continued.state).toEqual(direct.state);
    expect(continued.events.find(e => e.type === 'heal' && e.unitId === 'unit-1')).toMatchObject({ requested: 19, actual: 19, hp: 718 });
    const resumed = new BattleHistory('audit-r1', [], history.capturePrefix());
    resumed.observe({ before: restored, after: continued.state, events: continued.events.filter((e): e is CombatEvent => e.domain === 'combat'), reason: 'tick' });
    expect(validateBattleRecord(resumed.capturePrefix()!).terminal).toEqual(continued.state.combat);
  });
  it('R1 fallback direct heals also ignore Source property insertion order', () => {
    const started = battle(), units = structuredClone(started.combat!.units) as S13Unit[];
    const target = units[0]; target.hp = target.maxHp - 50;
    const origin = { ownerId: target.id, sourceKind: 'ability' as const, definitionId: target.ability.id, instanceId: target.id, effectIndex: 0 };
    const reordered = Object.fromEntries(Object.entries(origin).reverse()) as typeof origin;
    const run = (source: typeof origin) => {
      const ctx: AbilityContext = { tick: 1, combatId: 'round-1', board: started.combat!.board, units: structuredClone(units), events: [], packets: [], heals: [], draw: () => 0 };
      const entry = { source, targetId: target.id, amount: 19 }; ctx.heals.push(entry); commitMechanismHeal(ctx, entry); return ctx.events;
    };
    expect(run(origin)).toEqual(run(reordered));
    expect(run(origin)[0]).toMatchObject({ requested: 19, actual: 19, overheal: 0 });
  });
  it('R2 real tick104 active shield rejects a consumed reward with positive remaining', () => {
    let state = battle(); while (state.combat!.tick < 104) state = stepMatch(state).state;
    const active = state.combat!.units.flatMap(u => u.shieldLayers ?? []).find(l => l.m8State?.decay.kind === 'linear-initial-grant' && l.remaining > 0)!;
    expect(active).toMatchObject({ remaining: 400, expiresAtTick: 164 });
    expect(restoreMatch(serializeMatch(state))).toEqual(state);
    const invalid = JSON.parse(serializeMatch(state));
    invalid.combat.units.flatMap((u: any) => u.shieldLayers).find((l: any) => l.key === active.key).m8State.endRewardConsumed = true;
    expect(() => restoreMatch(invalid)).toThrow(/shield/i);
  });
  it('R2 restore distinguishes pending zero, consumed zero and invalid reason/task combinations', () => {
    let state = battle(); while (state.combat!.tick < 104) state = stepMatch(state).state;
    const pending = JSON.parse(serializeMatch(state));
    const holder = pending.combat.units.find((u: any) => u.shieldLayers.some((l: any) => l.m8State.decay.kind === 'linear-initial-grant'));
    const layer = holder.shieldLayers.find((l: any) => l.m8State.decay.kind === 'linear-initial-grant');
    layer.remaining = layer.m8State.remaining = 0;
    layer.absorbed = layer.m8State.absorbed = 400;
    layer.endedReason = 'depleted'; holder.shield = 0; holder.shieldExpiresAtTick = null;
    expect(() => restoreMatch(pending)).not.toThrow();
    expect(stepMatch(restoreMatch(pending)).events.filter(e => e.type === 'packetDamage' && e.source.ownerId === holder.id)).toHaveLength(1);
    const consumed = structuredClone(pending), consumedHolder = consumed.combat.units.find((u: any) => u.id === holder.id);
    consumedHolder.shieldLayers.find((l: any) => l.key === layer.key).m8State.endRewardConsumed = true;
    consumedHolder.tasks = consumedHolder.tasks.filter((t: any) => t.shieldEndKey !== layer.key);
    expect(() => restoreMatch(consumed)).not.toThrow();
    expect(stepMatch(restoreMatch(consumed)).events.filter(e => e.type === 'packetDamage' && e.source.ownerId === holder.id)).toEqual([]);
    const missingTask = structuredClone(pending); missingTask.combat.units.find((u: any) => u.id === holder.id).tasks = [];
    expect(() => restoreMatch(missingTask)).toThrow(/shield/i);
    const consumedWithTask = structuredClone(pending); consumedWithTask.combat.units.find((u: any) => u.id === holder.id).shieldLayers[0].m8State.endRewardConsumed = true;
    expect(() => restoreMatch(consumedWithTask)).toThrow(/shield/i);
    const noReason = structuredClone(pending); delete noReason.combat.units.find((u: any) => u.id === holder.id).shieldLayers[0].endedReason;
    expect(() => restoreMatch(noReason)).toThrow(/shield/i);
    // An initial zero grant has nothing to absorb, but still owns its one pending end task.
    const zeroGrant = structuredClone(noReason), zeroHolder = zeroGrant.combat.units.find((u: any) => u.id === holder.id);
    const zeroLayer = zeroHolder.shieldLayers.find((l: any) => l.key === layer.key);
    zeroLayer.granted = zeroLayer.absorbed = zeroLayer.m8State.granted = zeroLayer.m8State.absorbed = zeroLayer.m8Grant.amount.flat = 0;
    zeroLayer.m8State.decay.basisGranted = 0;
    expect(() => restoreMatch(zeroGrant)).not.toThrow();
    expect(stepMatch(restoreMatch(zeroGrant)).events.filter(e => e.type === 'packetDamage' && e.source.ownerId === holder.id)).toHaveLength(1);
  });
  it('R2 shield conservation allows active, zero pending and consumed zero but rejects consumed positive', () => {
    const grant: Extract<Effect, { kind: 'grant-shield' }> = { kind: 'grant-shield', amount: amount(400), durationTicks: 60, decay: { kind: 'none' }, onEnd: [], endTiming: 'post-damage', endTargeting: { kind: 'fixed', targetIds: ['u1'], ifMissing: 'skip' }, endEffects: [] };
    const active = grantShieldState(effectIdentity('c1', source(), 'u1'), 400, grant, 104);
    const pending = { ...active, remaining: 0, absorbed: 400 };
    const consumed = endShield(pending, 'depleted', grant, true).layer;
    for (const layer of [active, pending, consumed]) expect(() => validateShield(layer, 104, 'c1')).not.toThrow();
    expect(() => validateShield({ ...active, endRewardConsumed: true }, 104, 'c1')).toThrow();
  });
});
