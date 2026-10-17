import { expect, it } from 'vitest';
import { battle } from '../match-helpers';
import { restoreMatch, serializeMatch } from '../../src/simulation/serialization';

// G-C01 from codex/save-consistency-audit (546d0868), narrowed to the requested
// delayed-damage regression. The original acceptance assertion is now rejection.
it('rejects an invented Maddie delayed attack belonging to another champion', () => {
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
  for (const input of [bad, JSON.stringify(bad)]) expect(() => restoreMatch(input)).toThrow('task binding facts');
});
