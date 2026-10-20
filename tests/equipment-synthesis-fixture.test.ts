import { expect, it } from 'vitest';
import { equipmentSynthesisFixture } from './fixtures/equipment-synthesis';
import { combineItems, equipItem } from '../src/simulation/match';
import { previewEquip, readUnitEquipment } from '../src/simulation/item-selectors';

it('builds an importable public-reward fixture and supports two sequential component drops', async () => {
  const { envelope, holderId, componentIds } = await equipmentSynthesisFixture();
  let state = envelope.match;
  expect(state.phase).toBe('preparation');
  expect(envelope.battles.length).toBeGreaterThan(0);
  expect(state.preparation.units.find(unit => unit.id === holderId)?.location).toEqual({ kind: 'board', cell: { col: 1, row: 4 } });
  expect(state.items.filter(item => componentIds.includes(item.id)).map(item => item.definitionId)).toEqual(expect.arrayContaining(['vest', 'belt']));
  for (const id of componentIds) {
    expect(state.resourceProvenance.entries.some(entry => entry.kind === 'item-acquired' && entry.itemId === id
      && (entry.source.kind === 'loot' || entry.source.kind === 'schedule'))).toBe(true);
  }
  // Check the no-events failure shape without adding inventory to the public fixture.
  const before = JSON.stringify(state), refused = combineItems(state, componentIds[0], componentIds[0]);
  expect(refused).toEqual({ ok: false, state, reason: 'same-item' });
  expect(refused.state).toBe(state);
  expect(JSON.stringify(state)).toBe(before);
  for (const [index, id] of componentIds.entries()) {
    const preview = previewEquip(state, id, holderId, 0);
    expect(preview.allowed).toBe(true);
    if (index === 1) expect(preview.allowed && preview.combination?.resultDefinitionId).toBe('sunfire-cape');
    const result = equipItem(state, id, holderId, 0);
    if (!result.ok) throw new Error(result.reason);
    state = result.state;
    if (index === 0) {
      expect(state.items.find(item => item.id === id)?.location).toEqual({ kind: 'unit', unitId: holderId, slot: 0 });
      expect(state.items.find(item => item.id === componentIds[1])?.location).toEqual({ kind: 'inventory' });
    }
  }
  const view = readUnitEquipment(state, holderId);
  if (!view) throw new Error('Synthesis holder equipment is missing');
  const slot = view.slots[0];
  const finished = state.items.find(item => item.id === slot.itemInstanceId);
  expect(finished).toMatchObject({
    definitionId: 'sunfire-cape', location: { kind: 'unit', unitId: holderId, slot: 0 },
  });
  expect(state.items.some(item => componentIds.includes(item.id))).toBe(false);
}, 60_000);
