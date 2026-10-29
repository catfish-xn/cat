import { expect, it } from 'vitest';
import { createRequire } from 'node:module';

const { transformPlan, validateTransforms } = createRequire(import.meta.url)('./fixtures/m5/h13-inventory-oracle.cjs');
const inventory = (id: string, definitionId: string) => ({ id, definitionId, location: { kind: 'inventory' } });
const choiceId = 'round:4-2:augment';
// Literal vector from cannon/99's public 4-2 -> 4-3 transition on 6c9f2a98.
// No production RNG, transform helper, or expected output generated from receipts.
function vector() {
 const inputs = [inventory('item-12', 'rod'), inventory('item-17', 'shojin'),
  inventory('item-18', 'last-whisper'), inventory('item-9', 'bloodthirster')];
 const held = { ...inventory('item-10', 'deathblade'), location: { kind: 'unit', unitId: 'unit-1', slot: 0 } };
 const special = inventory('item-19', 'TFT5_Item_SunfireCapeRadiant');
 const before = { seed: 99, round: 19, roundDefinitionId: '4-2', nextItemSerial: 20,
  augments: [{ definitionId: 'pandoras-items-iii', choiceId, acquiredRound: 19 }],
  items: [...inputs, held, special], resourceProvenance: { entries: [] }, augmentHistory: { facts: [] } };
 const outputs = ['rod', 'jeweled-gauntlet', 'blue-buff', 'last-whisper'].map((id, i) => inventory(`item-${20 + i}`, id));
 const expected = inputs.map((input, i) => ({ kind: 'augment-item-transform', choiceId,
  receiptId: JSON.stringify(['batch5-h13', choiceId, 20, input.id]), input, outputs: [outputs[i]] }));
 const resources = expected.map((fact, sequence) => ({ ...fact, sequence, roundId: '4-3' }));
 const facts = expected.map((fact, sequence) => ({ ...fact, sequence, roundId: '4-3', round: 20, seatId: 'solo', resourcePrefix: sequence }));
 facts.push({ kind: 'inventory-transform-entry', choiceId, itemIds: inputs.map(i => i.id),
  sequence: facts.length, roundId: '4-3', round: 20, seatId: 'solo', resourcePrefix: 4 } as never);
 const after = { ...before, round: 20, roundDefinitionId: '4-3', nextItemSerial: 24,
  items: [...outputs, held, special], resourceProvenance: { entries: resources }, augmentHistory: { facts } };
 return { before, after, command: { type: 'continue', round: 19 }, expected };
}

it('accounts for four new Pandora IDs even when the first roll keeps the same definition', () => {
 const { before, after, command, expected } = vector();
 expect(transformPlan(before, after, command)).toMatchObject({ expected, inputs: 4, outputs: 4 });
 expect(() => validateTransforms(before, after, command)).not.toThrow();
 expect(after.nextItemSerial - before.nextItemSerial).toBe(4);
});

it.each(['missing', 'duplicate', 'serial', 'draw', 'history', 'output', 'wrong-command'])(
 'rejects %s transform evidence without trusting paired receipts', kind => {
  const { before, after, command } = vector();
  if (kind === 'missing') after.resourceProvenance.entries.pop();
  if (kind === 'duplicate') after.resourceProvenance.entries.push(after.resourceProvenance.entries[0]);
  if (kind === 'serial') after.resourceProvenance.entries[0].outputs[0].id = 'item-99';
  if (kind === 'draw') after.resourceProvenance.entries[1].outputs[0].definitionId = 'deathcap';
  if (kind === 'history') after.augmentHistory.facts.pop();
  if (kind === 'output') after.items.shift();
  if (kind === 'wrong-command') command.type = 'reroll';
  expect(() => validateTransforms(before, after, command)).toThrow();
 });

it('does not reroll on acquisition and requires an entry marker even for an empty inventory', () => {
 const { before } = vector();
 expect(transformPlan(before, before, { type: 'select' })).toMatchObject({ expected: [], entries: [], inputs: 0, outputs: 0 });
 const empty = { ...before, items: [] }, after = { ...empty, round: 20, roundDefinitionId: '4-3' };
 expect(transformPlan(empty, after, { type: 'continue' })).toMatchObject({ expected: [],
  entries: [{ kind: 'inventory-transform-entry', choiceId, itemIds: [] }], inputs: 0, outputs: 0 });
 expect(() => validateTransforms(empty, after, { type: 'continue' })).toThrow(/entry coverage/);
});

it('counts Salvage Bin+ two-component outputs and preserves equipment slot order', () => {
 const before = { seed: 99, round: 20, nextItemSerial: 24,
  augments: [{ definitionId: 'salvage-bin-plus', choiceId, acquiredRound: 19 }],
  items: [
   { id: 'item-9', definitionId: 'deathblade', location: { kind: 'unit', unitId: 'unit-1', slot: 2 } },
   { id: 'item-10', definitionId: 'shojin', location: { kind: 'unit', unitId: 'unit-1', slot: 0 } },
  ] };
 const plan = transformPlan(before, before, { type: 'sell', id: 'unit-1' });
 expect([plan.inputs, plan.outputs]).toEqual([2, 4]);
 expect(plan.expected.map((f: { outputs: { id: string; definitionId: string }[] }) => f.outputs.map(i => [i.id, i.definitionId])))
  .toEqual([[['item-24', 'sword'], ['item-25', 'tear']], [['item-26', 'sword'], ['item-27', 'sword']]]);
});
