import { expect, it, vi } from 'vitest';
vi.mock('phaser', () => ({ default: {} }));
import { UnitView } from '../src/presentation/unit-view';
import { createMatch, startMatchCombat } from '../src/simulation/match';
import { toCombatViewState } from '../src/presentation/combat-display';

it('redraws Titan badges from counter-only PvE frames while preserving the opening loadout', () => {
  const started = startMatchCombat(createMatch(42));
  if (!started.ok || !started.state.combat) throw Error('missing combat');
  const unit = toCombatViewState(started.state.combat).units[0];
  expect(unit.equipment).toBeUndefined();
  const graphic = new Proxy({}, { get: (_target, key) => key === 'visible' ? true : () => graphic });
  const drawItems = vi.fn();
  const view = Object.assign(Object.create(UnitView.prototype), {
    hp: graphic, mana: graphic, shield: graphic, shieldLabel: graphic, statusIcons: graphic,
    token: { y: 300 }, equipped: ['titans-resolve'], pendingEquipped: ['bf-sword'], drawItems,
  });
  const frames = [2, 7, 25].map(stacks => ({ ...unit, itemStacks: [{ instanceId: 'titan', definitionId: 'titans-resolve', stacks, maxStacks: 25 }] }));
  for (const frame of frames) {
    view.drawCombat(frame, null);
    expect(view.itemStacks).toEqual(frame.itemStacks);
    expect(view.equipped).toEqual(['titans-resolve']); expect(view.pendingEquipped).toEqual(['bf-sword']);
  }
  expect(drawItems).toHaveBeenCalledTimes(3);
  view.drawCombat(frames[2], null); expect(drawItems).toHaveBeenCalledTimes(3);
  view.drawCombat({ ...unit, itemStacks: [] }, null);
  expect(view.itemStacks).toEqual([]); expect(drawItems).toHaveBeenCalledTimes(4);
});
