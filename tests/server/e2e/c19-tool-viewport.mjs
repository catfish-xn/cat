/** Fixed projection regression for C19's real tool drag, with the equipped item below the viewport. */
import { installEquipmentCommands, createChecks, launchBrowser, outDir, startVite, stopAll } from './harness.mjs';
import { showDragEndpoints } from './c19-drag-geometry.mjs';
import { writeFileSync } from 'node:fs';

const { check, finish } = createChecks(), OUT = outDir('mp-overtime-receipt/tool-viewport');
const base = await startVite(5213), browser = await launchBrowser();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 2200 } }), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/c19-tool-viewport', route => route.fulfill({ contentType: 'text/html', body:
    '<!doctype html><html><head><link rel="stylesheet" href="/src/style.css"></head>'
    + '<body data-online="" data-online-mode="online-active"><div id="app"><div id="panels-root">'
    + '<div style="height:1000px" aria-label="earlier settlement content"></div><div id="strategy-root"></div></div>'
    + '<div id="board-frame"><div id="dock"></div></div></div></body></html>' }));
  await installEquipmentCommands(page);
  await page.goto(`${base}c19-tool-viewport`);
  await page.evaluate(async () => {
    const [{ StrategyPanel }, { InputRouter }, { createMatch }] = await Promise.all([
      import('/src/rendering/strategy-panel.ts'), import('/src/rendering/input-router.ts'), import('/src/simulation/match.ts')]);
    const base = createMatch(42), noop = () => {}, router = new InputRouter();
    // A fixed authoritative target projection: nine board units and one bench holder, one ordinary completed item.
    const state = { ...base, phase: 'settlement', pendingChoice: null, level: 9,
      m8: { ...base.m8, preparation: { ...base.m8.preparation, enemies: [] } },
      preparation: { ...base.preparation, units: Array.from({ length: 10 }, (_, index) => ({
        id: `holder-${index}`, definitionId: 'kogmaw', team: 'player', starLevel: 1,
        location: index === 9 ? { kind: 'bench', slot: 0 } : { kind: 'board', cell: { col: index % 7, row: 4 + Math.floor(index / 7) } } })) },
      items: [{ id: 'item-3', definitionId: 'giant-slayer', location: { kind: 'unit', unitId: 'holder-9', slot: 0 } }],
      consumables: [{ consumableId: 'consumable-5', definitionId: 'completed-reforger' }],
      consumableTargets: [{ consumableId: 'consumable-5', targets: [{ target: { kind: 'item', itemId: 'item-3' }, allowed: true, affectedItemIds: ['item-3'] }] }] };
    const calls = []; let panel;
    panel = new StrategyPanel({ state: () => state, combat: () => ({ view: null, runtime: null }), battleItems: () => null,
      shopLock: noop, selectedUnit: () => null, selectUnit: noop, combine: noop, equip: noop,
      useConsumable: (consumableId, target) => calls.push({ consumableId, target }),
      choose: noop, target: noop, rerollAnomaly: noop, buy: noop, deploy: noop, control: noop,
      unitAt: () => undefined, cancelGesture: () => { router.cancel(); panel.cancel(); },
      status: text => panel.status(text), help: noop, highlight: noop }, router, document.querySelector('#dock'));
    panel.render();
    // The source must scroll with the document, outside the sticky board frame.
    const dock = document.querySelector('#dock'); document.body.append(dock);
    dock.style.cssText = 'position:absolute;left:500px;top:1200px;width:300px';
    // Fixed bench-token hit surface: geometry regression, independent of the removed equipment panel.
    const token = document.createElement('button'); token.dataset.debug = 'unit:holder-9'; token.dataset.unitId = 'holder-9';
    token.textContent = 'holder-9'; token.style.cssText = 'position:absolute;left:900px;top:2400px;width:64px;height:64px';
    document.body.append(token);
    const bounds = () => { const result = panel.snapshot(), box = token.getBoundingClientRect();
      return { ...result.bounds, 'unit:holder-9': { x: box.x, y: box.y, width: box.width, height: box.height, centerX: box.x + box.width / 2, centerY: box.y + box.height / 2 } }; };
    window.fixture = { read: () => ({ bounds: bounds(), calls: [...calls], status: document.querySelector('.panel-status')?.textContent }) };
  });
  const source = 'consumable:consumable-5', target = 'unit:holder-9';
  const read = () => page.evaluate(() => window.fixture.read());
  const drag = async snapshot => {
    const from = snapshot.bounds[source], to = snapshot.bounds[target];
    await page.mouse.move(from.centerX, from.centerY); await page.mouse.down();
    await page.mouse.move(to.centerX, to.centerY, { steps: 8 }); await page.waitForTimeout(60); await page.mouse.up();
  };
  const before = await read();
  check(before.bounds[source].centerY < 2200 && before.bounds[target].centerY > 2200, 'source is visible; the nonzero target rectangle is below the original C19 viewport');
  await drag(before);
  const missed = await read();
  check(missed.calls.length === 0 && missed.status.includes('消耗品未使用'), 'the original unscrolled mouse drop sends no command');
  await showDragEndpoints(page, source, target);
  const positioned = await read();
  await drag(positioned);
  const after = await read();
  check(JSON.stringify(after.calls) === JSON.stringify([{ consumableId: 'consumable-5', target: { kind: 'item', itemId: 'item-3' } }]), 'scrolling and rereading sends exactly one use of the same tool to the same allowed item');
  check(errors.length === 0, `no page errors (${errors.join(' | ')})`);
  writeFileSync(`${OUT}/report.json`, JSON.stringify({ before, missed, positioned, after, errors }, null, 2));
  await page.screenshot({ path: `${OUT}/visible-endpoints.png` });
} finally {
  await browser.close().catch(() => {}); stopAll();
}
finish('C19 tool viewport');
