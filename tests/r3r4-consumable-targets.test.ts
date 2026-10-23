import { describe, expect, it } from 'vitest';
import { CONSUMABLE_DEFINITIONS, toPrivateSeatView } from '../src/server-entry';
import { legal } from '../src/simulation/bot/preflight';
import { execute } from './t7-helpers';
import type { ClientCommand } from '../src/server/protocol';
import { RULES_GAP_MANIFEST } from '../src/simulation/content/rules-manifest';
import { digestContent } from '../src/simulation/content';
import { previewUseConsumable } from '../src/simulation/consumables';
import { equipItem, nextRound, startMatchCombat, useConsumable } from '../src/simulation/match';
import type { MatchState } from '../src/simulation/match-types';
import { publicConsumables, accepted, finish } from './fixtures/r3r4-public';

function prepared(phase: MatchState['phase']) {
  // Restore the v15 public recipe seed: independent bonus draws preserve its
  // original gloves; seed 72 was selected while bonuses still shifted loot RNG.
  let state = publicConsumables(162);
  const parent = state.items.find(item => item.definitionId === 'thiefs-gloves')!;
  const holder = state.preparation.units.find(unit => unit.team === 'player')!;
  state = accepted(equipItem(state, parent.id, holder.id, 0));
  if (phase !== 'settlement') state = accepted(nextRound(state, state.round));
  if (phase === 'choice') state = accepted(nextRound(finish(state), state.round));
  if (phase === 'combat') state = accepted(startMatchCombat(state));
  expect(state.phase).toBe(phase);
  return { state, holder, parent };
}

describe('SR-C18 authority-projected consumable targets', () => {
  it.each(['preparation', 'combat', 'choice', 'settlement'] as const)('%s: exact authority reasons, ownership and detached read-only output', phase => {
    const { state, holder, parent } = prepared(phase);
    const before = JSON.stringify(state);
    const view = toPrivateSeatView(state), again = toPrivateSeatView(state);
    expect(again).toEqual(view); expect(again).not.toBe(view);
    expect(Object.isFrozen(view.consumableTargets)).toBe(true);
    for (const row of view.consumableTargets) {
      const candidates = [
        ...state.preparation.units.filter(u => u.team === 'player').map(u => ({ kind: 'unit', unitId: u.id })),
        ...view.items.map(i => ({ kind: 'item', itemId: i.id })),
      ];
      expect(row.targets.map(t => t.target)).toEqual(candidates);
      for (const shown of row.targets) {
        const actual = previewUseConsumable(state, row.consumableId, shown.target);
        expect(shown).toEqual(actual.ok
          ? { target: shown.target, allowed: true, affectedItemIds: actual.affectedItemIds }
          : { target: shown.target, allowed: false, reason: actual.reason });
        expect(Object.isFrozen(shown.target)).toBe(true);
        if (shown.allowed) expect(Object.isFrozen(shown.affectedItemIds)).toBe(true);
      }
    }
    const remover = state.consumables.find(c => c.definitionId === 'magnetic-remover')!;
    const reforger = state.consumables.find(c => c.definitionId === 'reforger')!;
    expect(previewUseConsumable(state, remover.consumableId, { kind: 'unit', unitId: 'missing' })).toEqual({ ok: false, reason: 'unknown-unit' });
    expect(previewUseConsumable(state, reforger.consumableId, { kind: 'item', itemId: 'missing' })).toEqual({ ok: false, reason: 'invalid-consumable-target' });
    const terminal = toPrivateSeatView({ ...state, phase: 'gameOver', combat: null });
    expect(terminal.consumableTargets.every(row => row.targets.every(t => !t.allowed && t.reason === 'wrong-phase'))).toBe(true);
    const row = view.consumableTargets.find(c => c.consumableId === remover.consumableId)!;
    expect(row.targets).toContainEqual({ target: { kind: 'unit', unitId: holder.id }, allowed: true, affectedItemIds: [parent.id] });
    expect(row.targets.some(t => !t.allowed && t.reason === 'invalid-consumable-target')).toBe(true);
    expect(row.targets.some(t => !t.allowed && t.reason === 'no-removable-items')).toBe(true);
    // Temporary children and enemies are deliberately not candidates; execution still rejects them.
    const child = state.temporaryEquipment.find(t => t.parentItemInstanceId === parent.id)!;
    expect(child).toBeDefined();
    expect(previewUseConsumable(state, reforger.consumableId, { kind: 'item', itemId: child.temporaryId }))
      .toEqual({ ok: false, reason: 'invalid-consumable-target' });
    const enemy = state.preparation.units.find(u => u.team === 'enemy')!;
    expect(enemy).toBeDefined();
    expect(previewUseConsumable(state, remover.consumableId, { kind: 'unit', unitId: enemy.id }))
      .toEqual({ ok: false, reason: 'invalid-consumable-target' });
    expect(JSON.stringify(view.consumableTargets)).not.toContain(child.temporaryId);
    expect(row.targets.some(t => t.target.kind === 'unit' && t.target.unitId === enemy.id)).toBe(false);
    expect(JSON.stringify(state)).toBe(before); // includes every RNG, serial, receipt and revision
    const command: ClientCommand = { type: 'useConsumable', consumableId: remover.consumableId, target: { kind: 'unit', unitId: holder.id } };
    expect(legal(state, command)).toBe(false); // Current bots deliberately do not use tools.
    expect(JSON.stringify(state)).toBe(before);
    const result = execute(state, command);
    expect(result).toEqual(useConsumable(state, remover.consumableId, command.target));
    const spent = accepted(result);
    expect(toPrivateSeatView(spent).consumableTargets.some(t => t.consumableId === remover.consumableId)).toBe(false);
    expect(previewUseConsumable(spent, remover.consumableId, { kind: 'unit', unitId: holder.id }))
      .toEqual({ ok: false, reason: 'unknown-consumable' });
    expect(toPrivateSeatView(state)).toEqual(view);
  }, 30000);
  it('exports five frozen content definitions with UI text and target kind', () => {
    expect(Object.keys(CONSUMABLE_DEFINITIONS)).toEqual(['magnetic-remover', 'masterwork-upgrade', 'reforger', 'TFT_Consumable_ChampionDuplicator_III', 'TFT_Consumable_NeekosHelp']);
    expect(RULES_GAP_MANIFEST.consumables.definitions).toBe(CONSUMABLE_DEFINITIONS);
    const changed = structuredClone(RULES_GAP_MANIFEST);
    Object.assign(changed.consumables.definitions['magnetic-remover'], { description: 'changed' });
    expect(digestContent(changed)).not.toBe(digestContent(RULES_GAP_MANIFEST));
    for (const [id, definition] of Object.entries(CONSUMABLE_DEFINITIONS)) {
      expect(definition.id).toBe(id); expect(definition.targetKind).toBe(definition.target);
      expect(definition.name.length).toBeGreaterThan(0); expect(definition.description.length).toBeGreaterThan(0);
      expect(Object.isFrozen(definition)).toBe(true);
    }
  });
});
