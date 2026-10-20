/* Test support for the persistent item bench. No production hook or state injection.
 * Phaser already exports itself on window; observe game construction so dev AND
 * production preview can call the application's existing combine/equip callbacks.
 * Native drag tests do not use these command callbacks.
 */
const assert = require('node:assert/strict');

async function installEquipmentCommands(page, { hideTab = process.env.EQUIPMENT_TAB === 'hidden' } = {}) {
  await page.addInitScript(({ hideTab }) => {
    if (hideTab) {
      const hide = () => {
        const style = document.createElement('style');
        style.textContent = '[data-debug="panel:items"] { display: none !important; }';
        document.head.append(style);
      };
      if (document.head) hide(); else document.addEventListener('DOMContentLoaded', hide, { once: true });
    }
    let phaser;
    Object.defineProperty(window, 'Phaser', {
      configurable: true,
      get: () => phaser,
      set(value) {
        phaser = value;
        const Game = value.Game;
        value.Game = new Proxy(Game, {
          construct(target, args, newTarget) {
            const game = Reflect.construct(target, args, newTarget);
            window.__EQUIPMENT_GAME__ = game;
            return game;
          },
        });
      },
    });
  }, { hideTab });
}

async function equipmentCommand(page, method, ...args) {
  assert(['combine', 'equip'].includes(method), `unsupported equipment command: ${method}`);
  return page.evaluate(({ method, args }) => {
    const scene = window.__EQUIPMENT_GAME__?.scene.getScenes(true).find(scene => scene.session && scene.strategyPanel);
    if (!scene) throw new Error('equipment command observer was not installed before navigation');
    // The same callbacks that the panel uses: RemoteSession sends an intent;
    // MatchSession commits the public Match command. BoardScene handles refresh,
    // receipt tracking, history and feedback in both cases.
    scene.strategyPanel.actions[method](...args);
    return window.__CAT_DEBUG__.read();
  }, { method, args });
}

function unitPoint(snapshot, unitId) {
  const token = snapshot.tokens.find(token => token.visible && (token.owner ?? token.id) === unitId);
  assert(token, `visible board/bench token for ${unitId}`);
  return { x: token.screenX, y: token.screenY };
}

async function dragEquipment(page, itemId, unitId) {
  const source = page.locator(`[data-debug="item:${itemId}"]`);
  await source.scrollIntoViewIfNeeded();
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
  const snapshot = await page.evaluate(() => window.__CAT_DEBUG__.read());
  const from = await source.boundingBox(), to = unitPoint(snapshot, unitId), viewport = page.viewportSize();
  assert(from && from.width > 0 && from.height > 0, `visible inventory item ${itemId}`);
  assert(to.x >= 0 && to.y >= 0 && to.x < viewport.width && to.y < viewport.height, `unit ${unitId} is on screen`);
  assert.equal(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName, to), 'CANVAS', 'drop hits the board');
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 10 });
  // Replay tokens can move between the initial read and release.
  const standing = unitPoint(await page.evaluate(() => window.__CAT_DEBUG__.read()), unitId);
  await page.mouse.move(standing.x, standing.y);
  await page.mouse.up();
  return { unitId, x: standing.x, y: standing.y };
}

module.exports = { installEquipmentCommands, equipmentCommand, dragEquipment, unitPoint };
