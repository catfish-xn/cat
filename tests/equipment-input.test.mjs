import { afterEach, describe, expect, it, vi } from 'vitest';
import { installEquipmentCommands, equipmentCommand, unitPoint, dragEquipment } from '../scripts/equipment-input.cjs';

afterEach(() => vi.unstubAllGlobals());

describe('equipment input support without the equipment tab', () => {
  it.each([false, true])('observes the existing Phaser game with hidden tab = %s', async hideTab => {
    const styles = [], window = {};
    vi.stubGlobal('window', window);
    vi.stubGlobal('document', { head: { append: style => styles.push(style) }, createElement: () => ({}) });
    const page = { addInitScript: (fn, arg) => fn(arg) };
    await installEquipmentCommands(page, { hideTab });
    class Game { constructor(config) { this.config = config; } }
    window.Phaser = { Game };
    const game = new window.Phaser.Game({ scene: 'BoardScene' });
    expect(game).toBeInstanceOf(Game);
    expect(game.config).toEqual({ scene: 'BoardScene' });
    expect(window.__EQUIPMENT_GAME__).toBe(game);
    expect(styles.length).toBe(Number(hideTab));
    if (hideTab) expect(styles[0].textContent).toContain('display: none');
  });

  it.each(['combine', 'equip'])('delegates %s to the unchanged application callback', async method => {
    const action = vi.fn(), snapshot = { state: { gold: 10 } };
    vi.stubGlobal('window', { __EQUIPMENT_GAME__: { scene: { getScenes: () => [
      { session: {}, strategyPanel: { actions: { [method]: action } } },
    ] } }, __CAT_DEBUG__: { read: () => snapshot } });
    const page = { evaluate: (fn, arg) => fn(arg) }, args = method === 'combine' ? ['a', 'b'] : ['a', 'unit-1', 2];
    expect(await equipmentCommand(page, method, ...args)).toBe(snapshot);
    expect(action).toHaveBeenCalledExactlyOnceWith(...args);
    await expect(equipmentCommand(page, 'replace-state')).rejects.toThrow('unsupported');
  });

  it('fails explicitly when commands were not installed before navigation', async () => {
    vi.stubGlobal('window', {});
    await expect(equipmentCommand({ evaluate: (fn, arg) => fn(arg) }, 'combine', 'a', 'b')).rejects.toThrow('before navigation');
  });

  it('maps replay owner IDs and bench tokens, rejecting a hidden destination', () => {
    const tokens = [{ id: 'pvp-1', owner: 'unit-1', visible: true, screenX: 700, screenY: 400 },
      { id: 'unit-2', visible: true, screenX: 500, screenY: 600 }, { id: 'dead', visible: false }];
    expect(unitPoint({ tokens }, 'unit-1')).toEqual({ x: 700, y: 400 });
    expect(unitPoint({ tokens }, 'unit-2')).toEqual({ x: 500, y: 600 });
    expect(() => unitPoint({ tokens }, 'dead')).toThrow('visible board/bench token');
  });

  it('uses a native inventory drag and rereads a moving replay token before release', async () => {
    const calls = [], tokens = [{ id: 'pvp-1', owner: 'unit-1', visible: true, screenX: 700, screenY: 400 }];
    let reads = 0;
    vi.stubGlobal('window', { __CAT_DEBUG__: { read: () => {
      reads++; return { tokens: tokens.map(token => ({ ...token, screenX: reads > 1 ? 710 : 700 })) };
    } } });
    vi.stubGlobal('document', { elementFromPoint: () => ({ tagName: 'CANVAS' }) });
    vi.stubGlobal('requestAnimationFrame', fn => fn());
    const page = {
      locator: selector => {
        expect(selector).toBe('[data-debug="item:item-1"]');
        return { scrollIntoViewIfNeeded: async () => {}, boundingBox: async () => ({ x: 90, y: 90, width: 20, height: 20 }) };
      }, evaluate: (fn, arg) => fn(arg), viewportSize: () => ({ width: 1440, height: 900 }),
      mouse: { move: async (...args) => calls.push(['move', ...args]), down: async () => calls.push(['down']), up: async () => calls.push(['up']) },
    };
    await dragEquipment(page, 'item-1', 'unit-1');
    expect(calls).toEqual([['move', 100, 100], ['down'], ['move', 700, 400, { steps: 10 }], ['move', 710, 400], ['up']]);
  });
});
