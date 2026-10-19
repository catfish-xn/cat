/**
 * Dynamic regression for C19's reforger drag: the drag hint changing the status line must not shift the layout, a scroll
 * the browser makes on its own mid-drag (scroll anchoring after a layout shift) must not cancel a legal drop, and a
 * scroll the player asks for (mouse wheel) still cancels it.
 */
import { createChecks, launchBrowser, outDir, startVite, stopAll } from './harness.mjs';
import { showDragEndpoints } from './c19-drag-geometry.mjs';
import { writeFileSync } from 'node:fs';

const { check, finish } = createChecks(), OUT = outDir('mp-overtime-receipt/tool-microscroll');
const base = await startVite(5214), browser = await launchBrowser();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1400 } }), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/c19-tool-microscroll', route => route.fulfill({ contentType: 'text/html', body:
    '<!doctype html><html><head><link rel="stylesheet" href="/src/style.css"></head>'
    + '<body data-online="" data-online-mode="online-active"><div id="app"><div id="panels-root">'
    + '<div style="height:1000px" aria-label="earlier settlement content"></div><div id="strategy-root"></div></div>'
    + '<div id="board-frame"><div id="dock"></div></div></div></body></html>' }));
  await page.goto(`${base}c19-tool-microscroll`);
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
    panel.render(); document.querySelector('[data-debug="panel:items"]').click();
    window.fixture = { read: () => ({ bounds: panel.snapshot().bounds, calls: [...calls], status: document.querySelector('.panel-status')?.textContent,
      statusHeight: document.querySelector('.panel-status')?.getBoundingClientRect().height, scrollY }) };
    // Every height the status line takes while a drag rewrites it: idle, the drag hint and the drop preview.
    window.statusHeights = [];
    new MutationObserver(() => window.statusHeights.push(document.querySelector('.panel-status').getBoundingClientRect().height))
      .observe(document.querySelector('.panel-status'), { childList: true, characterData: true, subtree: true });
  });
  const source = 'consumable:consumable-5', target = 'equipment:holder-9:0';
  const read = () => page.evaluate(() => window.fixture.read());
  const expected = JSON.stringify([{ consumableId: 'consumable-5', target: { kind: 'item', itemId: 'item-3' } }]);
  // Starts a drag, moves halfway, runs `midway`, then finishes on the target as positioned after `midway`.
  const drag = async midway => {
    await showDragEndpoints(page, source, target);
    const start = await read(), from = start.bounds[source], to = start.bounds[target];
    await page.mouse.move(from.centerX, from.centerY); await page.mouse.down();
    await page.mouse.move((from.centerX + to.centerX) / 2, (from.centerY + to.centerY) / 2, { steps: 4 });
    await midway();
    await page.waitForTimeout(60);
    const now = (await read()).bounds[target];
    await page.mouse.move(now.centerX, now.centerY, { steps: 4 }); await page.waitForTimeout(60); await page.mouse.up();
    return start;
  };

  const idle = await read();
  // 1. A browser-made scroll mid-drag (as scroll anchoring does after a 0.28 px layout shift) keeps the drag.
  const before = await drag(() => page.evaluate(() => { const y = scrollY; window.scrollBy(0, -1); return y; }));
  const nudged = await read();
  check(before.scrollY > 0 && nudged.scrollY === before.scrollY - 1, `the page really scrolled by 1 px mid-drag (${before.scrollY} → ${nudged.scrollY})`);
  check(JSON.stringify(nudged.calls) === expected, `a layout-made scroll mid-drag still sends exactly one use to the allowed item (${JSON.stringify(nudged.calls)})`);
  const heights = await page.evaluate(() => window.statusHeights);
  check(heights.length >= 2 && heights.every(height => height === idle.statusHeight), `the status line keeps its height while the drag rewrites it (${idle.statusHeight} / ${heights.join(', ')})`);

  // 2. A scroll the player asks for mid-drag still ends the gesture: no command.
  await page.evaluate(() => { document.querySelector('.panel-status').textContent = ''; });
  await drag(async () => { await page.mouse.wheel(0, 40); await page.waitForTimeout(200); });
  const wheeled = await read();
  check(wheeled.calls.length === nudged.calls.length, `a wheel scroll mid-drag cancels it: no command (${wheeled.calls.length - nudged.calls.length} new)`);

  check(errors.length === 0, `no page errors (${errors.join(' | ')})`);
  writeFileSync(`${OUT}/report.json`, JSON.stringify({ idle, before, nudged, heights, wheeled, errors }, null, 2));
} finally {
  await browser.close().catch(() => {}); stopAll();
}
finish('C19 tool microscroll');
