import { describe, expect, it } from 'vitest';
import { battle } from '../match-helpers';
import { restoreMatch, serializeMatch } from '../../src/simulation/serialization';
import { stepMatch } from '../../src/simulation/match';

// Audit characterizations: acceptance is a vulnerability observation, not the desired contract.
// All original states come from public create/choice/deploy/start/step commands.
describe('combat accumulator trust audit', () => {
  it('accepts an invented Maddie delayed attack belonging to another champion', () => {
    const legal = battle();
    expect(restoreMatch(serializeMatch(legal))).toEqual(legal);
    const bad = structuredClone(legal);
    const owner = bad.combat!.units.find(u => u.team === 'player' && u.definitionId !== 'maddie')!;
    const enemy = bad.combat!.units.find(u => u.team === 'enemy')!;
    expect(owner).toBeDefined();
    Object.assign(owner, { tasks: [...owner.tasks ?? [], {
      key: 'audit-invented-maddie', kind: 'maddie', source: {
        ownerId: owner.id, sourceKind: 'ability', definitionId: owner.ability.id,
        instanceId: owner.id, effectIndex: 0,
      }, executeAtTick: 1, targetId: enemy.id, amount: 1000000,
      ordinal: 0, total: 1, cancellable: false, actionSeq: 0,
    }] });
    for (const input of [bad, JSON.stringify(bad)]) expect(restoreMatch(input)).toEqual(bad);
    const normal = stepMatch(legal).state;
    const forged = stepMatch(restoreMatch(JSON.stringify(bad))).state;
    expect(forged.combat!.units.find(u => u.id === enemy.id)!.hp)
      .toBeLessThan(normal.combat!.units.find(u => u.id === enemy.id)!.hp);
  });

  it('accepts arbitrary processed and actionCounts keys without declared triggers', () => {
    const legal = battle();
    expect(restoreMatch(serializeMatch(legal))).toEqual(legal);
    const bad = structuredClone(legal), owner = bad.combat!.units.find(u => u.team === 'player')!;
    expect(owner.mechanismDefinitions!.eventTriggers ?? []).toEqual([]);
    Object.assign(owner, { triggerLedger: { runtimes: [], processed: { 'invented-event': 900000000 }, actionCounts: { 'invented-action': 900000000 } } });
    for (const input of [bad, JSON.stringify(bad)]) expect(restoreMatch(input)).toEqual(bad);
  });

  it('accepts an invented attack count within the tick cap without an attack fact', () => {
    let legal = battle();
    legal = stepMatch(legal).state;
    expect(restoreMatch(serializeMatch(legal))).toEqual(legal);
    const bad = structuredClone(legal), owner = bad.combat!.units.find(u => u.team === 'player')!;
    const before = owner.runtime!.attackCount;
    const after = before === 0 ? 1 : 0;
    Object.assign(owner.runtime!, { attackCount: after });
    expect(after + owner.runtime!.castCount).toBeLessThanOrEqual(bad.combat!.tick);
    for (const input of [bad, JSON.stringify(bad)]) expect(restoreMatch(input)).toEqual(bad);
  });
});

it('audit: unverified combat contributor and trigger-sequence records survive restore', () => {
  const legal = battle();
  expect(restoreMatch(serializeMatch(legal))).toEqual(legal);
  const bad = structuredClone(legal);
  Object.assign(bad.combat!, {
    damageContributors: { 'never-existed-victim': ['never-existed-holder'] },
    nextTriggerEventSeq: 900000000,
  });
  for (const input of [bad, JSON.stringify(bad)]) expect(restoreMatch(input)).toEqual(bad);
});

it('audit: ordinary shield absorbed/remaining accounts can be rebalanced without damage facts', () => {
  let legal = battle();
  let owner = legal.combat!.units.find(u => u.shieldLayers?.some(l => l.remaining > 0 && l.absorbed > 0));
  while (!owner && legal.phase === 'combat') {
    legal = stepMatch(legal).state;
    owner = legal.combat!.units.find(u => u.shieldLayers?.some(l => l.remaining > 0 && l.absorbed > 0));
  }
  expect(owner, 'public battle must reach an absorbed, still-live ordinary shield').toBeDefined();
  expect(restoreMatch(serializeMatch(legal))).toEqual(legal);
  const bad = structuredClone(legal), forgedOwner = bad.combat!.units.find(u => u.id === owner!.id)!;
  const layer = forgedOwner.shieldLayers!.find(l => l.remaining > 0 && l.absorbed > 0)!;
  expect(layer.m8Grant!.amount.resistsBps ?? 0).toBe(0);
  Object.assign(layer, { remaining: layer.remaining + 1, absorbed: layer.absorbed - 1 });
  Object.assign(layer.m8State!, { remaining: layer.m8State!.remaining + 1, absorbed: layer.m8State!.absorbed - 1 });
  Object.assign(forgedOwner, { shield: forgedOwner.shield + 1 });
  for (const input of [bad, JSON.stringify(bad)]) expect(restoreMatch(input)).toEqual(bad);
});
