import { countsG23SurvivorDamage } from '../src/simulation/g2-3-summons';
import { existsSync, readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { AUGMENT_BATCH5_G4 } from '../src/simulation/content/augment-pool-batch5-g4';
import { augmentCandidates } from '../src/simulation/augment-offers';
import { castB5Voidcaller, spawnB5Voidlings, b5VoidlingHealth, type B5VoidcallerCounter, type B5VoidlingBirth } from '../src/simulation/augment-pool-batch5-g4';
import { stepCombat } from '../src/simulation/combat';
import { validateDynamicCombat } from '../src/simulation/g2-4b-gold-restore';
import { hexDistance } from '../src/simulation/board';
import { voidFixture } from './augment-pool-batch5-g4-helpers';
import { augmentPool, voidcallerModel, settlement, ROUNDS } from './fixtures/m5/oracle.g2.cjs';
import { rewardPlan } from './fixtures/m5/augment-rewards-oracle.cjs';
import { batch1GiftPlan } from '../src/simulation/augment-pool-grants';

const ARCHIVE = '/home/aiapps/workspace/augments-research-2026-10-23/data/augments-14.24.json';
it.skipIf(!existsSync(ARCHIVE))('B5-72 preserves every 14.24 numeric field', () => {
  const row = JSON.parse(readFileSync(ARCHIVE, 'utf8')).find((r: any) => r.apiName === 'TFT13_Augment_Visionary');
  expect(AUGMENT_BATCH5_G4.voidcaller.source.values).toEqual(row.effects);
});
it('B5-72 offers all three nodes, tailors only the later nodes, and independently excludes Built Different', () => {
  for (const node of ['2-1', '3-2', '4-2']) for (const fieldedTraits of [[], ['visionary']]) {
    const allowed = node === '2-1' || fieldedTraits.length > 0;
    expect(augmentCandidates('gold', [], [], null, { node, fieldedTraits, blocked: [] }).includes('voidcaller')).toBe(allowed);
    expect(augmentPool('gold', [], [], `round:${node}:augment`, fieldedTraits).includes('voidcaller')).toBe(allowed);
  }
  const owned = [{ definitionId: 'built-different', choiceId: 'other', acquiredRound: 4 }];
  expect(augmentCandidates('gold', owned)).not.toContain('voidcaller');
  expect(augmentPool('gold', owned)).not.toContain('voidcaller');
});
it('B5-72 gifts are independently derived, including both heroes with no production receipt input', () => {
  const { state } = voidFixture();
  expect(batch1GiftPlan(state).map(g => ({...g,source:'augment-pool-batch1',starLevel:g.starLevel??1}))).toEqual(rewardPlan(state, { ROUNDS }).gifts);
  expect(batch1GiftPlan(state).map(g => [g.kind, g.definitionId])).toEqual([['unit', 'rell'], ['unit', 'morgana']]);
});
it('B5-72 pools all Visionary costs, carries excess, births nearest to the triggering caster, and has a cumulative cap', () => {
  const { ctx, initial, rell, morgana, state } = voidFixture(), counters: B5VoidcallerCounter[] = [], births: B5VoidlingBirth[] = [];
  castB5Voidcaller(ctx, rell, 200, counters, births);
  expect(births).toHaveLength(0);
  castB5Voidcaller(ctx, morgana, 100, counters, births);
  expect(counters).toEqual([{ team: 'player', remainder: 25, summoned: 0 }]);
  expect(births[0].source.ownerId).toBe('morgana');
  expect(hexDistance(morgana.cell, births[0].unit.cell)).toBe(1);
  expect(births[0].unit).toMatchObject({ maxHp: 400, hp: 400, attackDamage: 60, attackRange: 1,
    baseAttackSpeedBps: 8000, attackIntervalTicks: 25, armor: 30, magicResist: 30, maxMana: 0, mana: 0 });
  expect(births[0].unit.runtime?.attackCount).toBe(0);
  expect(countsG23SurvivorDamage(births[0].unit)).toBe(false);
  const terminal={...initial.state,result:'enemyWin' as const,units:[{...rell,team:'enemy' as const},{...births[0].unit,team:'enemy' as const}]};
  expect(settlement(state,terminal,state.gold).survivingEnemyCount).toBe(1);
  expect(settlement(state,terminal,state.gold).playerDamage).toBe(3);
  spawnB5Voidlings(ctx, initial.state, births, counters);
  expect(counters).toEqual([{ team: 'player', remainder: 25, summoned: 1 }]);
  expect(ctx.events.filter(e => e.type === 'unitSpawned')).toHaveLength(1);
  births.length = 0;
  // Dying does not return a slot in the per-combat limit.
  const first = ctx.units.find(u => u.definitionId === 'b5-voidling')!; first.alive = false; first.hp = 0;
  castB5Voidcaller(ctx, rell, 2000, counters, births);
  const expected = voidcallerModel([200, 100, 2000]);
  spawnB5Voidlings(ctx, initial.state, births, counters);
  expect(counters[0]).toMatchObject(expected);
  expect(births).toHaveLength(4); expect(new Set(births.map(b => b.unit.id)).size).toBe(4);
  const other = { ...rell, mechanics: [] }; castB5Voidcaller(ctx, other, 999, counters, births);
  expect(counters[0]).toMatchObject(expected);
});
it('B5-72 keeps opposing teams independent even when their casts happen in the same tick',()=>{
  const {ctx,rell,morgana}=voidFixture(),counters:B5VoidcallerCounter[]=[],births:B5VoidlingBirth[]=[];
  const enemy={...morgana,id:'enemy-visionary',team:'enemy' as const,cell:{col:5,row:2}};
  castB5Voidcaller(ctx,rell,200,counters,births);castB5Voidcaller(ctx,enemy,100,counters,births);
  expect(counters).toEqual([{team:'player',remainder:200,summoned:0},{team:'enemy',remainder:100,summoned:0}]);
  castB5Voidcaller(ctx,enemy,175,counters,births);expect(births).toHaveLength(1);expect(births[0].unit.team).toBe('enemy');
  expect(counters[0]).toEqual({team:'player',remainder:200,summoned:0});
});
it('B5-72 ignores a full board without overlapping or consuming RNG and keeps stage 6+ at 600 HP', () => {
  const { ctx, rell } = voidFixture(), counters: B5VoidcallerCounter[] = [], births: B5VoidlingBirth[] = [];
  const template = ctx.units[0];
  ctx.units = Array.from({ length: 56 }, (_, i) => ({ ...template, id: `block-${i}`, cell: { col: i % 7, row: Math.floor(i / 7) } }));
  castB5Voidcaller(ctx, rell, 300, counters, births);
  expect(births).toEqual([]); expect(counters).toEqual([{ team: 'player', remainder: 25, summoned: 0 }]); expect(ctx.events).toEqual([]);
  expect(['2-1','3-1','4-1','5-1','6-1'].map(id => b5VoidlingHealth(ROUNDS.find((r: any) => r.roundId === id)!.ordinal))).toEqual([400,450,500,550,600]);
  expect(b5VoidlingHealth(ROUNDS.length + 1)).toBe(600);
});
it('B5-72 real combat costs produce a summon, and trusted-input replay rejects counters, body and roster tampering', () => {
  const { initial, basis, strategy } = voidFixture();
  // The stationary enemy is a long-lived numerical vector; this does not mint a Match asset.
  let combat = initial.state;
  let found = false;
  for (let i = 0; i < 600 && combat.status === 'running'; i++) {
    const next = stepCombat(combat); combat = next.state;
    if (combat.voidcaller?.some(c => c.summoned > 0)) { found = true; break; }
  }
  expect(found).toBe(true);
  for (const form of ['object', 'json'] as const) {
    const valid = form === 'object' ? structuredClone(combat) : JSON.parse(JSON.stringify(combat));
    expect(validateDynamicCombat(valid, basis, strategy, form === 'json')).toBe(true);
    for (const edit of [
      (x: any) => { x.voidcaller[0].remainder++; },
      (x: any) => { delete x.voidcaller; },
      (x: any) => { x.units.find((u: any) => u.definitionId === 'b5-voidling').maxHp++; },
      (x: any) => { x.units = x.units.filter((u: any) => u.definitionId !== 'b5-voidling'); },
    ]) {
      const bad = structuredClone(valid); edit(bad);
      expect(() => validateDynamicCombat(bad, basis, strategy, form === 'json')).toThrow();
    }
  }
});
