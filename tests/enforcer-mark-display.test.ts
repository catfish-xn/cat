import { afterEach, expect, it, vi } from 'vitest';
import { statusIcons, drawStatusIcons } from '../src/presentation/status-icons';
import { annotate } from '../src/presentation/trait-display-text';
import { createUnitOverhead, DEFAULT_METER_COLORS } from '../src/rendering/three-mode/unit-overhead';
import type { DisplayUnit } from '../src/presentation/combat-display';
const unit = { id: 'target', alive: true, shield: 0, enforcerWanted: true } as DisplayUnit & { enforcerWanted: boolean };
afterEach(() => vi.unstubAllGlobals());
it('2D wanted mark comes only from the server field, has a drawn crosshair, disappears on death or unmarking', () => {
  expect(statusIcons(null, unit)).toEqual([{ kind: 'enforcer-wanted', harmful: true, badge: '缉' }]);
  const circle = vi.fn(), path = vi.fn();
  drawStatusIcons({ circle, path }, statusIcons(null, unit), 0, -53);
  expect(circle).toHaveBeenCalled(); expect(path).toHaveBeenCalled();
  expect(statusIcons(null, { ...unit, alive: false })).toEqual([]);
  expect(statusIcons(null, { ...unit, enforcerWanted: false })).toEqual([]);
});
it('3D places the wanted label above meters/items and clears it outside combat, on death and disposal', () => {
  const fillText = vi.fn();
  vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => ({ clearRect() {}, fillRect() {}, fillText }) }) });
  const overhead = createUnitOverhead({ colors: () => DEFAULT_METER_COLORS, itemTexture: async () => null });
  const meters = { hp: 100, maxHp: 100, mana: 0, maxMana: 100, shield: 0 };
  overhead.set('enemy', meters, [{ id: 'a', icon: null }], true);
  const mark = overhead.object.getObjectByName('render3d-enforcer-wanted')!;
  expect(mark.visible).toBe(true); expect(fillText).toHaveBeenCalledWith('通缉', 64, 31);
  expect(mark.position.y).toBeGreaterThan(overhead.object.getObjectByName('render3d-overhead-items')!.position.y + 13);
  overhead.set('enemy', meters, undefined, false); expect(mark.visible).toBe(false);
  overhead.set('enemy', undefined, undefined, true); expect(mark.visible).toBe(false);
  overhead.dispose(); expect(overhead.object.children).toHaveLength(0);
});
it('trait hover explains the marker and its on-death attack speed reward', () => {
  expect(annotate('enforcer', '')).toContain('通缉标记');
  expect(annotate('enforcer', '')).toContain('30%攻击速度');
});
