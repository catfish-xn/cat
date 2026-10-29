import {openingEncounter} from './fixtures/m5/oracle.g2.cjs';
import {lootPlan as independentLootPlan} from './fixtures/orb-combo-oracle.cjs';
import { describe, expect, it } from 'vitest';
import * as api from '../src/simulation/match';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { stepCombat, type CombatState } from '../src/simulation/combat';
import { resolveAbility } from '../src/simulation/combat-abilities';
import { COMPILED_NEUTRAL_ENCOUNTERS } from '../src/simulation/neutral-encounter-compiler';
import { revealMatchLoot, grantDirectLoot } from '../src/simulation/loot-runtime';
import { applyStatusContribution } from '../src/simulation/m8/status';
import { effectIdentity } from '../src/simulation/m8/identity';
import { EMPTY_MECHANISMS } from '../src/simulation/m8/runtime-types';
import { planCatalogRoundEconomy } from '../src/simulation/opening-economy';
import { accepted } from './match-helpers';
import { publicNeutralPreparation, publicAuthoredPreparation } from './fixtures/m8-neutral-public-route';
// The v25 Herald route seed (tests/fixtures/m8-neutral-public-route.ts, re-picked with the v25 epoch).
const HERALD_ROUTE_SEED = 65;
import { MAX_COMBAT_TICKS } from '../src/simulation/combat-types';
import { unit } from './combat-helpers';
import { vi } from 'vitest';
// Temporarily 20 s for slow CI runners (user-approved 2026-10-20 04:22: "Ci 超时可以放宽时限，或者直接验收").
vi.setConfig({ testTimeout: 20_000 });

const rounds = ['1-2', '1-3', '1-4', '2-7', '3-7', '4-7', '5-7', '6-7'];
const plan = (s: api.MatchState) => s.m8.loot.frozen.rounds.find(p => p.encounterPlan.roundId === s.roundDefinitionId)!;
const currentIds = (s: api.MatchState) => new Set([...plan(s).encounterPlan.drops, ...plan(s).choices].map(d => d.dropId));
const restore = (s: api.MatchState) => { const restored = restoreMatch(serializeMatch(s)); expect(restored).toEqual(s); return restored; };

describe('B10 eight encounters: actual public Match outcomes', () => {
  it.each(rounds)('%s: zero kills forfeits every current reward and survives save/restore without regrant', roundId => {
    let state = publicNeutralPreparation(roundId);
    // Ordinary sell commands deliberately field an empty army. No HP/death/result injection.
    for (const u of state.preparation.units.filter(u => u.team === 'player')) state = accepted(api.sellUnit(state, u.id));
    state = restore(state);
    const receiptCount = state.m8.loot.receipts.length;
    const ids = currentIds(state), previous = state;
    state = accepted(api.startMatchCombat(state));
    while (state.phase === 'combat') state = api.stepMatch(state).state;
    expect(state.combat!.result).toBe('enemyWin');
    expect(state.combat!.neutralReceipts!.deaths).toEqual([]);
    expect(state.m8.loot.receipts).toHaveLength(receiptCount);
    expect(state.m8.loot.direct.filter(d => ids.has(d.dropId)).every(d => d.status === 'forfeited')).toBe(true);
    expect(state.m8.loot.choiceEligibility.filter(d => ids.has(d.dropId)).every(d => d.status === 'forfeited')).toBe(true);
    expect(state.pendingChoice).toBeNull();
    expect(state.playerHp).toBeLessThan(previous.playerHp);
    const resumed = restore(state);
    expect(api.stepMatch(resumed)).toEqual({ state: resumed, events: [] });
    expect(api.nextRound(resumed, resumed.round)).toEqual(api.nextRound(state, state.round));
    if (roundId === '6-7') expect(state.phase).toBe('gameOver');
  });

  it.each(rounds)('%s: normal public army wins and every defeated-source reward is earned once', roundId => {
    let state = accepted(api.startMatchCombat(publicNeutralPreparation(roundId)));
    const ids = currentIds(state);
    while (state.phase === 'combat') state = api.stepMatch(state).state;
    expect(state.combat!.result).toBe('playerWin');
    const enemies = state.combat!.units.filter(u => u.team === 'enemy');
    expect(state.combat!.neutralReceipts!.deaths.map(d => d.unitId).sort()).toEqual(enemies.map(u => u.id).sort());
    expect(state.m8.loot.earnedEvidence.filter(e => ids.has(e.dropId))).toHaveLength(ids.size);
    while (state.phase === 'choice') {
      const c = state.pendingChoice!;
      state = accepted(api.selectChoice(state, c.choiceId, c.generation, c.offers[0]));
    }
    restore(state);
    const receipts = state.m8.loot.receipts.filter(r => ids.has(r.dropId));
    expect(new Set(receipts.map(r => r.dropId)).size).toBe(receipts.length);
    expect(receipts.length + state.m8.loot.direct.filter(d => ids.has(d.dropId) && ['pending-capacity', 'retained-terminal'].includes(d.status)).length).toBe(ids.size);
    expect(api.stepMatch(state)).toEqual({ state, events: [] });
    if (roundId === '6-7') {
      expect(state.phase).toBe('gameOver');
      expect(state.seed).toBe(HERALD_ROUTE_SEED);
      expect(openingEncounter(state.seed)).toBe('none');
      expect(independentLootPlan(state.seed,38).rounds.at(-1)!.encounterPlan.encounterId).toBe('rift-herald-v1');
      // Use the fixture's current command-only route seed (v25: 65); payloads and their order
      // still come from the independent literal-table BigInt loot oracle, never the runtime plan.
      expect(receipts.map(r => r.payload)).toEqual(independentLootPlan(HERALD_ROUTE_SEED,38).rounds.at(-1)!.encounterPlan.drops.map(d=>d.payload));
    }
  });
});

/** Explicit engine boundary fixture, not a playable/restore-valid Match save.
 * Real compiled enemies and real stepCombat emit deaths/results; a durable zero-damage
 * dummy isolates timeout; burn vectors start each enemy at 100 HP (the neutral burn
 * cap) to isolate simultaneous lethal pulses. The loot adapter consumes those
 * actual stamped death events; no death receipt or result is authored by this test.
 */
function boundary(roundId: string, burning: boolean, partial = false) {
  // The compiled authored encounter needs a crab-free opening: seed 42's crabs carry these sources in v22.
  const state = publicAuthoredPreparation(roundId);
  const started = accepted(api.startMatchCombat(state)).combat!;
  const compiled = COMPILED_NEUTRAL_ENCOUNTERS.find(e => e.roundId === roundId)!;
  const dummy = unit('b10-boundary', 'player', 3, 7, { hp: partial ? 100 : 1_000_000_000, maxHp: partial ? 100 : 1_000_000_000,
    attackDamage: 0, mana: 0, maxMana: 0, ability: resolveAbility('neutral-attack', 1),
    cooldownTicks: 10000, moveCooldownTicks: 10000, mechanismState: { ...EMPTY_MECHANISMS } });
  const enemies = structuredClone(compiled.units).map((original, index) => {
    const enemy = partial ? { ...original, cooldownTicks: 40 } : original;
    if (!burning) return enemy;
    if (partial && index > 0) return enemy;
    const source = { ownerId: dummy.id, sourceKind: 'item' as const, definitionId: 'b10-boundary-burn', instanceId: 'boundary-burn', effectIndex: 0, parentItemInstanceId: null };
    const groups = applyStatusContribution([], effectIdentity(started.combatId!, source, enemy.id), {
      kind: 'burn', magnitudeBps: 10000, activation: 'immediate', duration: { kind: 'ticks', ticks: 40 },
      stackPolicy: { kind: 'strongest-category', category: 'burn', retainSuppressed: true },
      polarity: 'harmful', removable: true, damageFilter: null, onEnd: null,
    }, 0).groups;
    return { ...enemy, hp: 100, mechanismState: { ...EMPTY_MECHANISMS, statuses: groups } };
  });
  const combat: CombatState = { ...started, units: [dummy, ...enemies], openingDefinitions: structuredClone(compiled.openingDefinitions),
    nextEventSeq: 0, nextActionSeq: 0, tick: 0, status: 'running', result: null, neutralReceipts: { deaths: [], controls: [] } };
  return { state, combat };
}

describe('B10 eight encounters: explicitly isolated engine result boundaries', () => {
  it.each(rounds)('%s: lethal HP boundary uses stage base plus survivors, minimum one, for defeat and draw', roundId => {
    const baseDamage = ({'1-2':0,'1-3':0,'1-4':0,'2-7':2,'3-7':5,'4-7':8,'5-7':10,'6-7':12} as Record<string,number>)[roundId];
    const damage = Math.max(1, baseDamage);
    const input = { roundId, gold: 0, streak: { kind: null, count: 0 }, level: 1, xp: 0, hp: 3, enemySurvivors: 0 } as const;
    for (const result of ['enemyWin', 'draw'] as const) {
      const settled = planCatalogRoundEconomy({ ...input, result });
      expect([settled.baseDamage, settled.playerDamage, settled.hpLost, settled.hpAfter]).toEqual([baseDamage, damage, Math.min(3, damage), Math.max(0, 3-damage)]);
    }
    const won = planCatalogRoundEconomy({ ...input, result: 'playerWin' });
    expect([won.playerDamage, won.hpLost, won.hpAfter]).toEqual([0, 0, 3]);
  });

  it.each(rounds.slice(0, 6))('%s: partial kills followed by defeat grants only committed source rewards', roundId => {
    const fixture = boundary(roundId, true, true); let combat = fixture.combat;
    while (combat.status === 'running') combat = stepCombat(combat).state;
    expect(combat.result).toBe('enemyWin'); expect(combat.neutralReceipts!.deaths).toHaveLength(1);
    const killed = new Set(combat.neutralReceipts!.deaths.map(d => d.unitId));
    const slots = [...plan(fixture.state).encounterPlan.drops, ...plan(fixture.state).choices];
    const earned = slots.filter(s => killed.has(s.sourceUnitId!)).map(s => s.dropId).sort();
    const lost = slots.filter(s => !killed.has(s.sourceUnitId!)).map(s => s.dropId).sort();
    const revealed = revealMatchLoot(fixture.state, combat);
    expect(revealed.events.flatMap(e => e.type === 'lootRevealed' ? [e.dropId] : []).sort()).toEqual(earned);
    expect(revealed.events.flatMap(e => e.type === 'lootForfeited' ? [e.dropId] : []).sort()).toEqual(lost);
    const granted = grantDirectLoot({ ...revealed.state, phase: 'settlement', combat: { ...combat, status: 'finished', result: 'enemyWin' } }, false);
    const current = currentIds(fixture.state);
    expect(granted.state.m8.loot.receipts.filter(r => current.has(r.dropId)).every(r => earned.includes(r.dropId))).toBe(true);
    expect(grantDirectLoot(granted.state, false).events).toEqual([]);
  });

  it.each(rounds)('%s: full v22 45-second (MAX_COMBAT_TICKS) timeout draw grants no unearned loot', roundId => {
    const fixture = boundary(roundId, false); let combat = fixture.combat;
    while (combat.status === 'running') combat = stepCombat(combat).state;
    expect(combat.result).toBe('draw'); expect(combat.tick).toBe(MAX_COMBAT_TICKS); expect(MAX_COMBAT_TICKS).toBe(900);
    expect(combat.neutralReceipts!.deaths).toEqual([]);
    const result = revealMatchLoot(fixture.state, combat);
    expect(result.events.filter(e => e.type === 'lootRevealed')).toEqual([]);
    expect(result.events.filter(e => e.type === 'lootForfeited')).toHaveLength(currentIds(fixture.state).size);
    expect(grantDirectLoot({ ...result.state, phase: 'settlement', combat: { ...combat, status: 'finished', result: 'draw' } }, false).events).toEqual([]);
    expect(revealMatchLoot(result.state, combat)).toEqual({ state: result.state, events: [] });
  });

  it.each(rounds)('%s: all final neutral deaths in one tick reveal each source before finish', roundId => {
    const fixture = boundary(roundId, true); let combat = fixture.combat;
    let lastEvents: ReturnType<typeof stepCombat>['events'] = [];
    while (combat.status === 'running') { const result = stepCombat(combat); combat = result.state; lastEvents = result.events; }
    expect(combat.result).toBe('playerWin'); expect(combat.tick).toBe(20);
    expect(combat.neutralReceipts!.deaths).toHaveLength(combat.units.length - 1);
    expect(new Set(combat.neutralReceipts!.deaths.map(d => d.tick))).toEqual(new Set([20]));
    const finish = lastEvents.findIndex(e => e.type === 'combatFinished');
    expect(finish).toBeGreaterThan(Math.max(...lastEvents.map((e, i) => e.type === 'death' ? i : -1)));
    const revealed = revealMatchLoot(fixture.state, combat);
    expect(revealed.events.filter(e => e.type === 'lootRevealed')).toHaveLength(currentIds(fixture.state).size);
    expect(revealed.events.filter(e => e.type === 'lootForfeited')).toEqual([]);
    for (const earned of revealed.state.m8.loot.earnedEvidence.filter(e => currentIds(fixture.state).has(e.dropId)))
      expect(lastEvents.some(e => e.type === 'death' && e.eventSeq === earned.death.eventSeq && e.tick === earned.death.tick)).toBe(true);
    const granted = grantDirectLoot({ ...revealed.state, phase: 'settlement', combat: { ...combat, status: 'finished', result: 'playerWin' } }, roundId === '6-7');
    expect(grantDirectLoot(granted.state, roundId === '6-7').events).toEqual([]);
    expect(revealMatchLoot(granted.state, combat).events).toEqual([]);
  });
});
