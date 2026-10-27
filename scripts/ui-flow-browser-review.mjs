// Real WebSocket rooms + production Vite client. Connect only to the supplied sandboxed Chrome.
// Test-only seat replacement follows tests/server/anvil-room-helpers.ts:seedSeat.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join, extname, sep } from 'node:path';
import { build } from 'esbuild';
import { createServer } from 'vite';

const require = createRequire(import.meta.url);
if (!process.env.CODEX_BROWSER_CLIENT) throw Error('Run through codex-browser exec; never launch Chrome here.');
const out = resolve(process.env.UI_FLOW_OUT ?? 'artifacts/ui-flow/final');
const assetRoot = process.env.UI_FLOW_ASSETS_ROOT ? resolve(process.env.UI_FLOW_ASSETS_ROOT) : null;
await mkdir(out, { recursive: true });
const bundle = join(out, 'test-server.mjs');
await build({ stdin: { contents: `
export {createGameServer} from './src/server/net/server';
export {ManualClock} from './src/server/room/clock';
export {TwoSidedBattleResolver} from './src/server/room/two-sided-resolver';
export {createOpeningEncounter} from './src/simulation/opening-encounter';
export {readG23Progress,writeG23Progress} from './src/simulation/g2-3-state';
export {openG23Choice} from './src/simulation/g2-3-runtime';
export {G23_JUNKER_PAID} from './src/simulation/g2-3-junker';
`, resolveDir: process.cwd() }, outfile: bundle, bundle: true, platform: 'node', format: 'esm', packages: 'external' });
const api = await import(bundle);
let forgeSeed = 1;
while (api.createOpeningEncounter(forgeSeed).selection.encounterId !== 'component-anvils') forgeSeed++;
const vite = await createServer({ server: { host: '127.0.0.1', port: 0 }, logLevel: 'error', plugins: assetRoot ? [{
  name: 'review-local-assets', configureServer(server) {
    server.middlewares.use('/__ui-flow-assets', async (req, res) => {
      try {
        const path = resolve(assetRoot, '.' + decodeURIComponent(new URL(req.url, 'http://local').pathname));
        if (!path.startsWith(assetRoot + sep)) { res.statusCode = 403; return res.end(); }
        res.setHeader('Content-Type', ({ '.json': 'application/json', '.png': 'image/png', '.glb': 'model/gltf-binary' })[extname(path)] ?? 'application/octet-stream');
        res.end(await readFile(path));
      } catch { res.statusCode = 404; res.end(); }
    });
  },
}] : [] });
await vite.listen();
const origin = `http://127.0.0.1:${vite.httpServer.address().port}`;
const browser = await require(process.env.CODEX_BROWSER_CLIENT).connect();
const results = [];
const sleep = ms => new Promise(r => setTimeout(r, ms));
let game, context;

function seedSeat(room, change) {
  const me = room.state.seats.find(s => s.kind === 'human');
  room.current = { ...room.state, seats: room.state.seats.map(s => s.seatId === me.seatId
    ? { ...s, match: change(s.match), seatRevision: s.seatRevision + 1 } : s) };
  room.replace({ ...room.state });
  return room.state.seats.find(s => s.seatId === me.seatId);
}

try {
  for (const mode of (process.env.UI_FLOW_MODE ? [process.env.UI_FLOW_MODE] : ['2d', '3d'])) {
    for (const viewport of (process.env.UI_FLOW_VIEWPORT === 'desktop' ? [{ width: 1440, height: 1000 }] : process.env.UI_FLOW_VIEWPORT === 'phone' ? [{ width: 390, height: 844 }] : [{ width: 1440, height: 1000 }, { width: 390, height: 844 }])) {
      const tag = `${mode}-${viewport.width}`;
      const clock = new api.ManualClock();
      game = await api.createGameServer({ port: 0, host: '127.0.0.1', clock, seed: forgeSeed,
        resolver: new api.TwoSidedBattleResolver(), timings: { preparationMs: 120000, settlementMs: 6000 },
        bots: { stepMs: 300 }, limits: { maxMessagesPerWindow: 10000 } });
      context = await browser.newContext({ viewport, ...(viewport.width === 390 ? { isMobile: true, hasTouch: true } : {}) });
      const page = await context.newPage();
      const commands = [], receipts = [], activations = [];
      page.on('websocket', socket => {
        socket.on('framesent', ({ payload }) => {
          const message = JSON.parse(String(payload));
          if (message.type === 'command') commands.push({ commandId: message.commandId, seatRevision: message.seatRevision, command: message.command });
        });
        socket.on('framereceived', ({ payload }) => {
          const message = JSON.parse(String(payload));
          if (message.type === 'receipt' && commands.some(command => command.commandId === message.commandId)) receipts.push(message);
        });
      });
      const activate = async selector => {
        const button = page.locator(selector);
        await button.scrollIntoViewIfNeeded();
        // Record a real exposed hit point: existing floating gold can cover a choice toggle's centre.
        const position = await button.evaluate(node => {
          const b = node.getBoundingClientRect();
          for (const y of [0.5, 0.8, 0.2]) for (const x of [0.5, 0.2, 0.8]) {
            if (node.contains(document.elementFromPoint(b.x + b.width * x, b.y + b.height * y))) return { x: b.width * x, y: b.height * y };
          }
          return null;
        });
        assert.ok(position, `${tag}: ${selector} has an exposed hit target`);
        activations.push({ selector, position, input: viewport.width === 390 ? 'touch' : 'mouse' });
        if (viewport.width === 390) await button.tap({ position }); else await button.click({ position });
      };
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      const ws = `ws://127.0.0.1:${game.port}`;
      await page.goto(`${origin}/?mode=online&server=ws&ws=${encodeURIComponent(ws)}&render=${mode}&debug3d${assetRoot ? '&assets3d=' + encodeURIComponent(origin + '/__ui-flow-assets/') : ''}`);
      await page.locator('[data-debug="online:join"]').click();
      await page.locator('[data-debug="online:start"]').click();
      await page.waitForFunction(() => window.__CAT_DEBUG__?.read().m6?.mode === 'active');
      await page.evaluate(async () => {
        const { BoardScene } = await import('/src/rendering/BoardScene.ts');
        const original = BoardScene.prototype.debugSnapshot;
        BoardScene.prototype.debugSnapshot = function () { window.__reviewScene = this; return original.call(this); };
        window.__CAT_DEBUG__.read();
      });
      const closeOpening = page.locator('[data-debug="opening:close"]');
      if (await closeOpening.isVisible()) await closeOpening.click();
      await page.evaluate(() => document.querySelector('.opening-card-close')?.click());
      if (mode === '3d') await page.waitForFunction(expected => document.querySelector('.render3d-layer')?.dataset.state === expected, assetRoot ? 'assets' : 'placeholder');
      const sample = { tag, viewport, mode, seed: forgeSeed, assetRoot, screenshots: [], checks: [], errors, commands, receipts, activations };
      results.push(sample);
      const check = (flow, name, pass, detail) => sample.checks.push({ flow, name, pass: Boolean(pass), ...(detail === undefined ? {} : { detail }) });
      const shot = async name => { const path = join(out, `${tag}-${name}.png`); await page.screenshot({ path }); sample.screenshots.push(path); };
      await shot('start');
      console.log('START', tag, game.room.state.seats.map(s => ({ id: s.seatId, kind: s.kind, controller: s.controller })), await page.locator('.opening-card').count());
      if (mode === '3d') {
        const blank = await page.evaluate(() => {
          const canvas = document.querySelector('.render3d-canvas'), rail = document.querySelector('#panels-root').getBoundingClientRect();
          window.__railCanvasInput = [];
          canvas.addEventListener('pointerdown', event => window.__railCanvasInput.push({ trusted: event.isTrusted, type: event.pointerType }));
          for (let y = rail.bottom - 4; y >= rail.top + 4; y -= 8) for (let x = rail.left + 4; x < rail.right - 4; x += 8) {
            if (document.elementFromPoint(x, y) === canvas) return { x, y, rail: { x: rail.x, y: rail.y, width: rail.width, height: rail.height } };
          }
          return null;
        });
        assert.ok(blank, `${tag}: find a blank area within the left rail`);
        if (viewport.width === 390) await page.touchscreen.tap(blank.x, blank.y); else await page.mouse.click(blank.x, blank.y);
        const input = await page.evaluate(() => window.__railCanvasInput);
        sample.leftRail = { blank, input };
        check('left-rail', 'blank-area input reaches the canvas', input.length === 1 && input[0].trusted && input[0].type === (viewport.width === 390 ? 'touch' : 'mouse'), sample.leftRail);
        const collapsed = await page.locator('body').getAttribute('data-online-left');
        await activate('[data-debug="online:left-toggle"]');
        check('left-rail', 'left-rail control handles input without passing it to canvas', await page.locator('body').getAttribute('data-online-left') !== collapsed
          && await page.evaluate(() => window.__railCanvasInput.length) === 1);
        await activate('[data-debug="online:left-toggle"]');
        assert.equal(await page.locator('body').getAttribute('data-online-left'), collapsed);
        await shot('left-rail-input');
      }
      const room = game.room;
      const me = room.state.seats.find(s => s.kind === 'human');
      const myMatch = () => room.state.seats.find(s => s.seatId === me.seatId).match;
      const normalGrid = await page.locator('#shop-dock').evaluate(node => ({
        areas: getComputedStyle(node).gridTemplateAreas, rows: getComputedStyle(node).gridTemplateRows,
      }));
      const anvil = me.match.preparation.units.find(u => u.definitionId === 'TFT_ArmoryKeyComponent');
      assert.ok(anvil);
      check('room', 'one human and seven active bot controllers', room.state.seats.filter(s => s.controller === 'bot').length === 7);
      sample.assets = await page.evaluate(async () => {
        const { anvilIconUrl } = await import('/src/presentation/anvil-display.ts');
        return ['Component', 'Completed'].map(k => ({ id: 'TFT_ArmoryKey' + k, icon: anvilIconUrl('TFT_ArmoryKey' + k) }));
      });
      if (assetRoot) {
        await page.waitForFunction(async () => (await import('/src/presentation/anvil-display.ts')).anvilIconUrl('TFT_ArmoryKeyComponent')?.includes('__ui-flow-assets'));
        // Optional completed skin is a display precondition only; restore it before real selling/choice commands.
        const before = room.state.seats.find(s => s.seatId === me.seatId).match;
        seedSeat(room, match => ({ ...match, preparation: { ...match.preparation, units: match.preparation.units.map(u => u.definitionId === 'TFT_ArmoryKeyComponent' && u.id !== anvil.id ? { ...u, definitionId: 'TFT_ArmoryKeyCompleted' } : u) } }));
        await page.waitForFunction(() => window.__CAT_DEBUG__.read().state.preparation.units.some(u => u.definitionId === 'TFT_ArmoryKeyCompleted'));
        if (mode === '3d') await page.waitForFunction(() => ['Component', 'Completed'].every(kind => {
          const piece = [...window.__render3d.pieces.values()].find(v => v.definitionId === 'TFT_ArmoryKey' + kind);
          return piece?.lease && !piece.lease.placeholder;
        }));
        else await page.waitForFunction(() => {
          const unit = window.__CAT_DEBUG__.read().state.preparation.units.find(u => u.definitionId === 'TFT_ArmoryKeyCompleted');
          return unit && window.__reviewScene.views.get(unit.id)?.portrait?.visible;
        });
        sample.assets = await page.evaluate(async () => {
          const { anvilIconUrl } = await import('/src/presentation/anvil-display.ts');
          return ['Component', 'Completed'].map(k => {
            const id = 'TFT_ArmoryKey' + k, piece = [...window.__render3d?.pieces.values() ?? []].find(v => v.definitionId === id);
            return { id, icon: anvilIconUrl(id), placeholder: piece?.lease?.placeholder, idle: piece?.mixer?.mixer?.time };
          });
        });
        check('assets', 'both original icons selected', sample.assets.every(a => a.icon?.includes('/anvils/icons/' + a.id)));
        if (mode === '3d') check('assets', 'both original GLBs loaded', sample.assets.every(a => a.placeholder === false));
        await shot('original-anvils');
        seedSeat(room, () => before);
        await page.waitForFunction(() => window.__CAT_DEBUG__.read().state.preparation.units.filter(u => u.definitionId === 'TFT_ArmoryKeyComponent').length === 2);
      } else check('assets', 'bundled component/completed fallback icons selected', sample.assets.every(a => !a.icon?.includes('__ui-flow-assets')));
      // Sell through the real scene command -> RemoteSession -> WsGameClient -> Room.
      await page.evaluate(id => window.__reviewScene.session.sell(id), anvil.id);
      await page.locator('[data-armory="anvil"] .shop-card').first().waitFor();
      if (assetRoot) await page.waitForFunction(() => { const img = document.querySelector('[data-debug="armory:icon"]'); return img?.complete && img.naturalWidth > 0; });
      sample.anvil = await page.evaluate(() => {
        const rect = n => { const r = n.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
        const clock = document.querySelector('[data-debug="armory:clock"]');
        const icon = document.querySelector('[data-debug="armory:icon"]');
        return { clock: clock?.textContent, clockRect: rect(clock), icon: icon ? { src: icon.src, width: icon.naturalWidth } : null, dock: rect(document.querySelector('#shop-dock')), row: rect(document.querySelector('[data-armory="anvil"] .touch-shop')),
          cards: [...document.querySelectorAll('[data-armory="anvil"] .shop-card')].map(n => ({ ...rect(n), overflow: n.scrollHeight - n.clientHeight })),
          hidden: ['mobile:buy-xp', 'mobile:reroll', 'shop-lock', 'mobile:sell'].map(id => ({ id, visible: !!document.querySelector(`[data-debug="${id}"]`)?.getClientRects().length })) };
      });
      const ac = sample.anvil.cards;
      check('anvil', 'four equal cards without clipping', ac.length === 4 && ac.every(c => Math.abs(c.width - ac[0].width) < 1 && c.overflow <= 1 && c.x >= 0 && c.x + c.width <= viewport.width + 1 && c.y + c.height <= Math.min(viewport.height, sample.anvil.dock.y + sample.anvil.dock.height) + 1));
      check('anvil', 'four cards fill the entire shop row', Math.abs(ac[0].x - sample.anvil.dock.x - 9) < 1 && Math.abs(ac[3].x + ac[3].width - sample.anvil.dock.x - sample.anvil.dock.width + 9) < 1);
      check('anvil', 'timer above cards', sample.anvil.clock === '剩余 30 秒' && sample.anvil.clockRect.y + sample.anvil.clockRect.height <= ac[0].y + 1);
      check('anvil', 'XP/reroll/lock/sell hidden', sample.anvil.hidden.every(b => !b.visible));
      if (assetRoot) check('assets', 'original shop-bar icon decoded', sample.anvil.icon?.src.includes('/anvils/icons/TFT_ArmoryKeyComponent.png') && sample.anvil.icon.width > 0);
      await shot('anvil-open');
      // Regression V: pending anvil survives view-shop; normal controls must regain separate grid cells.
      const beforeShopActions = myMatch(), choiceBeforeShop = beforeShopActions.pendingChoice;
      seedSeat(room, match => ({ ...match, gold: 50 }));
      await page.waitForFunction(() => window.__CAT_DEBUG__.read().state.gold === 50);
      await activate('[data-debug="shop-choice-away"]');
      const controlIds = ['mobile:buy-xp', 'mobile:reroll', 'mobile:sell', 'shop-lock'];
      sample.anvil.shopView = await page.evaluate(ids => {
        const dock = document.querySelector('#shop-dock'), style = getComputedStyle(dock);
        return { areas: style.gridTemplateAreas, rows: style.gridTemplateRows,
          populationVisible: !!dock.querySelector('.hud-pop').getClientRects().length,
          controls: ids.map(id => {
            const button = dock.querySelector(`[data-debug="${id}"]`), b = button.getBoundingClientRect();
            return { id, x: b.x, y: b.y, width: b.width, height: b.height,
              target: document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2)?.closest('button')?.dataset.debug };
          }) };
      }, controlIds);
      const shopView = sample.anvil.shopView;
      check('anvil-shop', 'normal shop grid and population restored while choice pending', shopView.areas === normalGrid.areas && shopView.rows === normalGrid.rows && shopView.populationVisible);
      const controlsSeparate = shopView.controls.every((a, i, boxes) => boxes.slice(i + 1).every(b =>
        a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y));
      check('anvil-shop', 'four controls have non-overlapping bounding boxes and correct hit targets', controlsSeparate && shopView.controls.every(b =>
        b.width >= 44 && b.height >= 44 && b.x >= 0 && b.y >= 0 && b.x + b.width <= viewport.width + 1 && b.y + b.height <= viewport.height + 1 && b.target === b.id), shopView.controls);
      await shot('anvil-view-shop');
      assert.ok(controlsSeparate, `${tag}: shop controls overlap: ${JSON.stringify(shopView.controls)}`);
      // Only affordability is seeded; all four actual DOM taps/clicks go through the online client and server.
      const xpBefore = { level: myMatch().level, xp: myMatch().xp, gold: myMatch().gold };
      await activate('[data-debug="mobile:buy-xp"]');
      await page.waitForFunction(before => {
        const state = window.__CAT_DEBUG__.read().state;
        return state.level !== before.level || state.xp !== before.xp;
      }, xpBefore);
      check('anvil-shop', 'XP tap confirmed by server', myMatch().gold < xpBefore.gold && (myMatch().level !== xpBefore.level || myMatch().xp > xpBefore.xp));
      const generation = myMatch().shop.generation;
      await activate('[data-debug="mobile:reroll"]');
      await page.waitForFunction(before => window.__CAT_DEBUG__.read().state.shop.generation > before, generation);
      check('anvil-shop', 'reroll tap confirmed by server', myMatch().shop.generation > generation);
      const locked = myMatch().shop.locked;
      await activate('[data-debug="shop-lock"]');
      await page.waitForFunction(before => window.__CAT_DEBUG__.read().state.shop.locked !== before, locked);
      check('anvil-shop', 'lock tap confirmed by server', myMatch().shop.locked === !locked);
      const unitIds = myMatch().preparation.units.map(u => u.id);
      const buySlot = myMatch().shop.slots.findIndex(s => s.status === 'available' && !myMatch().preparation.units.some(u => u.definitionId === s.definitionId));
      assert.ok(buySlot >= 0, 'A distinct shop unit is available for the sell-button regression');
      await activate(`[data-debug="mobile:buy-${buySlot}"]`);
      await page.waitForFunction(ids => window.__CAT_DEBUG__.read().state.preparation.units.some(u => !ids.includes(u.id)), unitIds);
      const bought = myMatch().preparation.units.find(u => !unitIds.includes(u.id));
      // Select the newly purchased sale target without moving the board camera or answering the pending choice.
      await page.evaluate(id => { window.__reviewScene.selectedId = id; }, bought.id);
      await activate('[data-debug="mobile:sell"]');
      await page.waitForFunction(id => !window.__CAT_DEBUG__.read().state.preparation.units.some(u => u.id === id), bought.id);
      check('anvil-shop', 'sell tap confirmed by server', !myMatch().preparation.units.some(u => u.id === bought.id));
      await activate('[data-debug="shop-choice-back"]');
      const backCards = page.locator('[data-armory="anvil"] .shop-card');
      await backCards.first().waitFor();
      assert.deepEqual(myMatch().pendingChoice, choiceBeforeShop);
      assert.deepEqual(myMatch().choiceDeadline, beforeShopActions.choiceDeadline);
      const backClock = await page.locator('[data-debug="armory:clock"]').boundingBox(), backFirst = await backCards.first().boundingBox();
      check('anvil-shop', 'back preserves choice/deadline and restores four cards above hidden controls', await backCards.count() === 4
        && backClock.y + backClock.height <= backFirst.y + 1
        && (await Promise.all(controlIds.map(id => page.locator(`[data-debug="${id}"]`).isVisible()))).every(visible => !visible));
      await shot('anvil-back-to-choice');
      // Reset only the affordability/progression fixture; retain the live shared-pool binding after buy/sell.
      seedSeat(room, match => ({ ...match, gold: beforeShopActions.gold, level: beforeShopActions.level, xp: beforeShopActions.xp }));
      await page.waitForFunction(gold => window.__CAT_DEBUG__.read().state.gold === gold, beforeShopActions.gold);
      await activate('[data-armory="anvil"] .shop-card:nth-child(2)');
      await page.waitForFunction(() => !window.__CAT_DEBUG__.read().state.pendingChoice);
      check('anvil', 'pick restores all five shop slots', await page.locator('.shop-card[data-debug^="mobile:buy-"]').count() === 5);
      await shot('anvil-picked');
      const second = room.state.seats.find(s => s.seatId === me.seatId).match.preparation.units.find(u => u.definitionId === 'TFT_ArmoryKeyComponent');
      await page.evaluate(id => window.__reviewScene.session.sell(id), second.id);
      await page.locator('[data-armory="anvil"] .shop-card').first().waitFor();
      const pending = room.state.seats.find(s => s.seatId === me.seatId).match.pendingChoice;
      // Advance the server's actual deadline, never answer from the client.
      clock.advance(30000); await sleep(100);
      await page.waitForFunction(() => !window.__CAT_DEBUG__.read().state.pendingChoice);
      sample.anvil.timeout = room.state.seats.find(s => s.seatId === me.seatId).match.seatMechanics.receipts.find(r => r.kind === 'choice' && r.receiptId === pending.choiceId);
      assert.equal(sample.anvil.timeout.optionId, pending.offers[0]); assert.equal(sample.anvil.timeout.timedOut, true);
      check('anvil', 'server timeout selects first offer and restores shop', sample.anvil.timeout.optionId === pending.offers[0] && await page.locator('.shop-card[data-debug^="mobile:buy-"]').count() === 5);
      await shot('anvil-timeout');
      // Same rules helper that opens Rumble's real menu; only its eligibility precondition is seeded.
      const beforeRumble = room.state.seats.find(s => s.seatId === me.seatId).match;
      seedSeat(room, match => {
        const unit = { id: 'review-rumble', definitionId: 'rumble', team: 'player', starLevel: 1, location: { kind: 'board', cell: { col: 3, row: 6 } } };
        const prepared = { ...match, gold: 50, preparation: { ...match.preparation, units: [...match.preparation.units.filter(u => u.team !== 'player'), unit] } };
        return api.openG23Choice(api.writeG23Progress(prepared, { ...api.readG23Progress(prepared), junkerRounds: 3 })).state;
      });
      await page.locator('[data-choice-source="armory"] .shop-card').first().waitFor();
      sample.rumble = await page.evaluate(() => {
        const row = document.querySelector('[data-choice-source="armory"] .touch-shop'), r = row.getBoundingClientRect();
        const dock = document.querySelector('#shop-dock').getBoundingClientRect();
        return { row: { x: r.x, y: r.y, width: r.width, height: r.height }, dock: { x: dock.x, y: dock.y, width: dock.width, height: dock.height },
          cards: [...row.children].map(n => { const b = n.getBoundingClientRect(); return { x: b.x, y: b.y, width: b.width, height: b.height, overflow: n.scrollHeight - n.clientHeight, text: n.textContent }; }) };
      });
      const rc = sample.rumble.cards, rr = sample.rumble.row;
      check('rumble', 'three centred equal cards', rc.length === 3 && rc.every(c => Math.abs(c.width - rc[0].width) < 1) && Math.abs(rc[0].x - rr.x) < 1 && Math.abs(rc[2].x + rc[2].width - rr.x - rr.width) < 1);
      check('rumble', 'cards fit panel and viewport', rc.every(c => c.overflow <= 1 && c.y >= sample.rumble.dock.y && c.y + c.height <= Math.min(viewport.height, sample.rumble.dock.y + sample.rumble.dock.height) + 1));
      await shot('rumble');
      sample.rumbleVariants = [];
      // Rumble also has a two-offer menu after four paid upgrades, and a one-offer three-star menu.
      for (const count of [2, 1]) {
        seedSeat(room, match => {
          const prepared = { ...match, phase: 'preparation', pendingChoice: null,
            preparation: { ...match.preparation, units: match.preparation.units.map(u => u.id === 'review-rumble' ? { ...u, starLevel: count === 1 ? 3 : 1 } : u) } };
          const purchases = count === 2 ? api.G23_JUNKER_PAID.slice(0, 4).map((upgrade, i) => ({ id: `g23:junker:${i + 1}`, round: match.round, unitId: 'review-rumble', upgrade, cost: 5 })) : [];
          return api.openG23Choice(api.writeG23Progress(prepared, { ...api.readG23Progress(prepared), junkerRounds: count === 2 ? 15 : 3, junkerPurchases: purchases })).state;
        });
        await page.waitForFunction(count => window.__CAT_DEBUG__.read().state.pendingChoice?.offers.length === count, count);
        const layout = await page.evaluate(() => {
          const row = document.querySelector('[data-choice-source="armory"] .touch-shop'), r = row.getBoundingClientRect();
          return { row: { x: r.x, right: r.right }, cards: [...row.children].map(n => { const b = n.getBoundingClientRect(); return { x: b.x, right: b.right, bottom: b.bottom, width: b.width, overflow: n.scrollHeight - n.clientHeight }; }) };
        });
        sample.rumbleVariants.push({ count, ...layout });
        check('rumble', `${count}-offer menu centred without clipped cards`, layout.cards.length === count && Math.abs(layout.cards[0].x - layout.row.x) < 1 && Math.abs(layout.cards.at(-1).right - layout.row.right) < 1 && layout.cards.every(c => Math.abs(c.width - layout.cards[0].width) < 1 && c.overflow <= 1 && c.bottom <= viewport.height + 1));
        await shot(`rumble-${count}`);
      }
      seedSeat(room, () => beforeRumble);
      await page.waitForFunction(() => !window.__CAT_DEBUG__.read().state.pendingChoice);
      const holder = seedSeat(room, match => {
        const player = match.preparation.units.find(u => u.team === 'player');
        const item = { id: `item-${match.nextItemSerial}`, definitionId: 'titans-resolve', location: { kind: 'unit', unitId: player.id, slot: 0 } };
        return { ...match, nextItemSerial: match.nextItemSerial + 1, items: [...match.items.filter(i => i.location.kind !== 'unit'), item] };
      });
      clock.advance(room.state.deadlineAt - clock.now());
      for (let i = 0; room.state.phase !== 'battle' && i < 2000; i++) { clock.runNext(); await sleep(0); }
      assert.equal(room.state.phase, 'battle', JSON.stringify(room.state.fault));
      await page.waitForFunction(() => window.__CAT_DEBUG__.read().combatView?.units.some(u => u.team === 'player' && u.itemStacks?.some(i => i.stacks > 0)));
      // Freeze browser wall time after the real replay arrived, then advance it deterministically.
      await page.clock.install(); await page.clock.pauseAt(new Date(Date.now() + 1000));
      await page.clock.runFor(200);
      const id = holder.match.preparation.units.find(u => u.team === 'player').id;
      const point = await page.evaluate(async id => {
        const { boardFeedScreenBox } = await import('/src/rendering/board-feed.ts');
        const b = boardFeedScreenBox(id);
        if (b) return { x: (b.left + b.right) / 2, y: (b.top + b.bottom) / 2 };
        const token = window.__CAT_DEBUG__.read().tokens.find(t => t.id === id);
        return { x: token.screenX, y: token.screenY };
      }, id);
      sample.titanPoint = await page.evaluate(point => ({ ...point, target: document.elementFromPoint(point.x, point.y)?.outerHTML.slice(0, 500) }), point);
      console.log('TITAN_POINT', JSON.stringify(sample.titanPoint));
      await page.mouse.move(point.x, point.y); await page.clock.runFor(150);
      const hoverBefore = await page.locator('#unit-card').textContent();
      await shot('titan-hover-before');
      await page.clock.runFor(1200);
      const hoverAfter = await page.locator('#unit-card').textContent();
      sample.hover = { before: hoverBefore, after: hoverAfter };
      check('titan', 'hover receives and refreshes authoritative counters', hoverBefore.includes('层数') && hoverAfter.includes('层数') && hoverBefore !== hoverAfter);
      await shot('titan-hover-after');
      if (viewport.width === 390) await page.touchscreen.tap(point.x, point.y); else await page.mouse.click(point.x, point.y);
      await page.locator('.unit-inspect:not([hidden])').waitFor();
      const titanSample = async () => page.evaluate(id => {
        const scene = window.__reviewScene;
        const unit = scene.session.combatView.units.find(u => u.id === id), view = scene.views.get(id);
        const badges = window.__render3d?.pieces.get(id)?.overhead.object.getObjectByName('render3d-item-stacks')?.children.map(v => v.userData);
        return { tick: scene.session.combatView.tick, combat: unit.itemStacks, panel: document.querySelector('.unit-inspect [data-debug="unit-card:item-stacks"]')?.textContent,
          equipmentSupplied: unit.equipment !== undefined, unit: view.itemStacks, labels: view.stackLabels.filter(l => l.visible).map(l => l.text), badges };
      }, id);
      sample.titan = [await titanSample()];
      await shot('titan-panel-before');
      await page.clock.runFor(1800);
      sample.titan.push(await titanSample());
      await shot('titan-panel-after');
      check('titan', 'on-unit badges match each replay frame', sample.titan.every(t => JSON.stringify(t.combat) === JSON.stringify(t.unit) && t.labels[0] === String(t.combat[0].stacks) && (mode !== '3d' || t.badges?.[0].stacks === t.combat[0].stacks)));
      check('titan', 'pinned panel matches changing replay counters', sample.titan.every(t => t.panel?.includes(`${t.combat[0].stacks}/${t.combat[0].maxStacks}`)) && sample.titan[1].combat[0].stacks > sample.titan[0].combat[0].stacks);
      check('titan', 'no replacement equipment in this PvE replay', sample.titan.every(t => !t.equipmentSupplied));
      check('runtime', 'no uncaught page errors', errors.length === 0, errors);
      console.log('RESULT', JSON.stringify(sample));
      await context.close(); context = null; await game.close(); game = null;
    }
  }
  assert.ok(results.every(s => s.checks.every(c => c.pass)), JSON.stringify(results.flatMap(s => s.checks.filter(c => !c.pass).map(c => ({ tag: s.tag, ...c })))));
} catch (error) {
  const page = context?.pages()[0];
  if (page) await page.screenshot({ path: join(out, 'failure.png') }).catch(() => {});
  throw error;
} finally {
  await writeFile(join(out, `${process.env.UI_FLOW_RUN ?? 'review'}-results.json`), JSON.stringify(results, null, 2) + '\n');
  await context?.close(); await game?.close(); await browser.close(); await vite.close();
}
