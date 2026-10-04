/* Trusted Chromium input; every operational expectation comes from the independent ledger. */
const assert = require('node:assert/strict');
const { expectedCommand, COST, expectedShop } = require('../tests/fixtures/m3/oracle.cjs');
module.exports = async function verifyDesktop({ page, read, click, assertHud, capture, report, ledgerStep, context, preview, initial }) {
  const evidence = report.desktop = { cycles: 0, steps: [], fixtures: [], noArtificialInputDelays: true, keydowns: [] };
  async function observeKeys(target) {
    await target.evaluate(() => {
      window.__m3DesktopKeys = [];
      window.__m3DesktopObserver = event => {
        if (['KeyD', 'KeyF', 'KeyE'].includes(event.code)) window.__m3DesktopKeys.push({ code: event.code, repeat: event.repeat,
          trusted: event.isTrusted, composing: event.isComposing, state: window.__CAT_DEBUG__.read().state });
      };
      window.addEventListener('keydown', window.__m3DesktopObserver);
    });
  }
  await observeKeys(page);
  async function hover(id) { const token = (await read()).tokens.find(t => t.id === id); assert(token, `hover ${id}`); await page.mouse.move(token.screenX, token.screenY); }
  async function dragTo(id, target, release = true) {
    await hover(id); await page.mouse.down();
    const snapshot = await read(), point = target.kind === 'bench' ? snapshot.layout.bench[target.slot] : snapshot.layout.hexes[`${target.cell.col},${target.cell.row}`];
    await page.mouse.move(point.x, point.y, { steps: 8 }); if (release) await page.mouse.up();
  }
  function assertView(snapshot) {
    assertHud(snapshot);
    assert.equal(snapshot.tokens.length, snapshot.state.preparation.units.length, 'no ghost or missing tokens');
    for (const unit of snapshot.state.preparation.units) {
      const token = snapshot.tokens.find(t => t.id === unit.id); assert(token?.visible);
      assert.equal(token.definitionId, unit.definitionId); assert.equal(token.starLabel, '★'.repeat(unit.starLevel));
      if (snapshot.draggingId === unit.id) continue;
      const point = unit.location.kind === 'bench' ? snapshot.layout.bench[unit.location.slot] : snapshot.layout.hexes[`${unit.location.cell.col},${unit.location.cell.row}`];
      assert(Math.abs(token.screenX - point.x) < 0.1 && Math.abs(token.screenY - point.y) < 0.1, `${unit.id}: exact placement`);
    }
  }
  async function step(name, command, input, code) {
    const before = (await read()).state, expected = expectedCommand(before, command);
    if (ledgerStep) await ledgerStep(name, command, input); else await input();
    const snapshot = await read(); assert.deepEqual(snapshot.state, expected.state, name); assertView(snapshot);
    if (code) {
      const event = await page.evaluate(() => window.__m3DesktopKeys.at(-1));
      assert.equal(event.code, code); assert(event.trusted); assert.deepEqual(event.state, expected.state, `${name}: commits in keydown dispatch`);
    }
    evidence.steps.push({ name, command, accepted: expected.ok, reason: expected.reason, state: snapshot.state }); return snapshot;
  }
  const key = (name, command, letter, down = false) => step(name, command, () => page.keyboard[down ? 'down' : 'press'](letter), `Key${letter.toUpperCase()}`);
  const deploy = (name, id, col, row = 6) => step(name, { type: 'deploy', id, target: { kind: 'board', cell: { col, row } } }, () => dragTo(id, { kind: 'board', cell: { col, row } }));
  const noop = (name, input) => step(name, { type: 'reject', reason: 'no-command' }, input);
  async function reset() { await click('debug-new-match'); assert.deepEqual((await read()).state, initial); assertView(await read()); }
  async function buy(slot, name) { const generation = (await read()).state.shop.generation; return step(name, { type: 'buy', slot, generation }, () => click(`buy-${slot}`)); }

  // These three cycles use only the uninterrupted growth match's earned balance.
  const atStart = await read(); assert(atStart.state.round >= 9 && atStart.state.gold >= 18);
  const board = atStart.state.preparation.units.filter(u => u.team === 'player' && u.location.kind === 'board');
  if (board.length >= atStart.state.level) {
    const occupied = new Set(atStart.state.preparation.units.filter(u => u.location.kind === 'bench').map(u => u.location.slot));
    const slot = Array.from({ length: 7 }, (_, i) => i).find(i => !occupied.has(i)); assert.notEqual(slot, undefined);
    const target = { kind: 'bench', slot };
    await step('earned-budget-free-one-population', { type: 'deploy', id: board.at(-1).id, target }, () => dragTo(board.at(-1).id, target));
  }
  for (let cycle = 1; cycle <= 3; cycle++) {
    await key(`earned-cycle-${cycle}-D`, { type: 'reroll' }, 'd');
    const state = (await read()).state;
    const slot = state.shop.slots.findIndex((offer, index) => offer.status === 'available' && COST[offer.definitionId] <= state.gold
      && expectedCommand(state, { type: 'buy', slot: index, generation: state.shop.generation }).events?.length === 0);
    assert(slot >= 0, 'naturally affordable nonmerging cycle purchase'); const id = `unit-${state.nextUnitSerial}`;
    await buy(slot, `earned-cycle-${cycle}-buy`); await deploy(`earned-cycle-${cycle}-deploy`, id, 6);
    await key(`earned-cycle-${cycle}-E`, { type: 'sell', id }, 'e');
    await key(`earned-cycle-${cycle}-repeat-E`, { type: 'reject', reason: 'no-target' }, 'e');
    await key(`earned-cycle-${cycle}-F`, { type: 'buyXp' }, 'f'); evidence.cycles++;
  }
  assert.equal((await read()).state.gold, atStart.state.gold - 18);
  await capture('desktop-earned-three-mixed-cycles');

  await reset();
  await click('unit:unit-1'); await hover('unit-2');
  await key('hover-over-another-selection', { type: 'sell', id: 'unit-2' }, 'e', true);
  assert.equal((await read()).selectedId, null);
  await key('held-E-cannot-sell-old-selection', { type: 'reject', reason: 'no-target' }, 'e', true); await page.keyboard.up('e');
  await click('unit:unit-1'); await hover('enemy-1');
  await key('enemy-hover-blocks-player-fallback', { type: 'sell', id: 'enemy-1' }, 'e'); assert.equal((await read()).selectedId, 'unit-1');
  await page.mouse.move(30, 30); await key('empty-hover-selection-fallback', { type: 'sell', id: 'unit-1' }, 'e');
  await step('E-during-drag', { type: 'sell', id: 'unit-3' }, async () => { await dragTo('unit-3', { kind: 'board', cell: { col: 6, row: 6 } }, false); assert.equal((await read()).draggingId, 'unit-3'); await page.keyboard.press('e'); }, 'KeyE');
  assert.equal((await read()).draggingId, null); await noop('late-release-after-E', () => page.mouse.up());
  for (const [letter, type, id] of [['d','reroll','unit-4'], ['f','buyXp','unit-5']]) {
    await step(`${letter}-during-drag`, { type }, async () => { await dragTo(id, { kind: 'board', cell: { col: 6, row: 6 } }, false); await page.keyboard.press(letter); }, `Key${letter.toUpperCase()}`);
    assert.equal((await read()).draggingId, null); await noop(`late-release-after-${letter}`, () => page.mouse.up());
  }

  for (const oldOnTop of [false, true]) {
    await reset(); await deploy('overlap-old-position', 'unit-1', 4, 4); await deploy('overlap-new-position', 'unit-4', 4, 5);
    if (oldOnTop) { await deploy('lift-old-token', 'unit-1', 5, 4); await deploy('restore-old-token-in-front', 'unit-1', 4, 4); }
    const s = await read(), a = s.tokens.find(t => t.id === 'unit-1'), b = s.tokens.find(t => t.id === 'unit-4');
    await page.mouse.click((a.screenX + b.screenX) / 2, (a.screenY + b.screenY) / 2);
    const id = oldOnTop ? 'unit-1' : 'unit-4'; assert.equal((await read()).selectedId, id, 'Phaser click overlap order');
    await key(`E-matches-click-${oldOnTop ? 'dragged-old' : 'new'}-token`, { type: 'sell', id }, 'e');
  }

  await reset(); await hover('unit-1');
  for (const modifier of ['Control', 'Meta', 'Alt']) for (const letter of ['d','f','e']) await noop(`ignore-${modifier}-${letter}`, () => page.keyboard.press(`${modifier}+${letter}`));
  for (const tag of ['input','textarea','select','div']) {
    await page.evaluate(tag => { const element = document.createElement(tag); element.id = 'm3-editable-fixture'; if (tag === 'div') element.contentEditable = 'true'; document.body.append(element); element.focus(); }, tag);
    await noop(`ignore-editable-${tag}`, () => page.keyboard.type('dedef'));
    await page.locator('#m3-editable-fixture').evaluate(element => element.remove());
  }
  // CDP commits real text composition, without synthetic DOM KeyboardEvents.
  const cdp = await context.newCDPSession(page);
  await noop('IME-composition-does-not-trigger-shortcuts', async () => { await cdp.send('Input.imeSetComposition', { text: 'df', selectionStart: 0, selectionEnd: 2 }); await cdp.send('Input.insertText', { text: 'df' }); });
  await cdp.detach();

  await reset(); await deploy('population-first', 'unit-1', 1); await deploy('population-second', 'unit-2', 2); await deploy('population-third', 'unit-3', 3);
  await step('population-cap-preview', { type: 'reject', reason: 'population-cap' }, async () => {
    await dragTo('unit-4', { kind: 'board', cell: { col: 4, row: 6 } }, false);
    assert((await read()).texts.some(t => t.startsWith('人口已满'))); await page.mouse.up();
  });
  await key('F-before-population-increase', { type: 'buyXp' }, 'f'); await key('F-unlocks-fourth-population', { type: 'buyXp' }, 'f');
  await deploy('fourth-population-after-F', 'unit-4', 4);
  await dragTo('unit-5', { kind: 'board', cell: { col: 5, row: 6 } }, false);
  await key('failed-F-preserves-drag', { type: 'buyXp' }, 'f'); assert.equal((await read()).draggingId, 'unit-5');
  await step('failed-F-release-cap-still-enforced', { type: 'deploy', id: 'unit-5', target: { kind: 'board', cell: { col: 5, row: 6 } } }, () => page.mouse.up());

  // Natural initial shop gives three sentinel offers. Test selection consumed by a
  // purchase, stable star rendering, immediate F/D, sale and stale mouse releases.
  await reset(); await deploy('upgrade-board-survivor', 'unit-1', 2); await click('unit:unit-4');
  await buy(0, 'third-card-clears-consumed-selection'); assert.equal((await read()).selectedId, null);
  assert.equal((await read()).tokens.find(t => t.id === 'unit-1').starLabel, '★★');
  await key('F-immediately-after-upgrade', { type: 'buyXp' }, 'f'); await key('D-immediately-after-upgrade', { type: 'reroll' }, 'd');
  await hover('unit-1'); await key('E-sells-retained-upgraded-unit', { type: 'sell', id: 'unit-1' }, 'e'); await noop('late-release-after-upgraded-sale', () => page.mouse.up());

  for (const letter of ['d','f']) for (const held of [true,false]) {
    await reset(); const type = letter === 'd' ? 'reroll' : 'buyXp', successes = letter === 'd' ? 5 : 2;
    for (let i = 0; i < successes + 30; i++) await key(`${letter}-${held ? 'held' : 'press'}-${i}`, { type }, letter, held);
    if (held) await page.keyboard.up(letter);
    await step(`${letter}-no-funds-buy-boundary`, { type: 'buy', slot: 4, generation: (await read()).state.shop.generation }, () => click('buy-4'));
  }
  await dragTo('unit-3', { kind: 'board', cell: { col: 6, row: 6 } }, false);
  await key('failed-D-preserves-valid-drag', { type: 'reroll' }, 'd'); assert.equal((await read()).draggingId, 'unit-3');
  await step('release-after-failed-D-still-deploys', { type: 'deploy', id: 'unit-3', target: { kind: 'board', cell: { col: 6, row: 6 } } }, () => page.mouse.up());
  await capture('desktop-repeat-resource-boundaries');
  const keys = await page.evaluate(() => { window.removeEventListener('keydown', window.__m3DesktopObserver); const result = window.__m3DesktopKeys; delete window.__m3DesktopObserver; delete window.__m3DesktopKeys; return result; });
  assert(keys.every(event => event.trusted));
  for (const code of ['KeyD','KeyF','KeyE']) assert(keys.some(event => event.code === code && event.repeat), `${code}: Chromium repeat observed`);
  evidence.keydowns.push(...keys);

  if (!preview) await verifyBoundaryFixtures({ context, url: page.url(), initial, evidence, assertHud });
  evidence.passed = true;
};

async function verifyBoundaryFixtures({ context, url, initial, evidence, assertHud }) {
  const makeUnit = (id, definitionId, starLevel, slot) => ({ id, definitionId, starLevel, team: 'player', location: { kind: 'bench', slot } });
  const enemies = initial.preparation.units.filter(u => u.team === 'enemy');
  const fullBench = [makeUnit('unit-1','sentinel',1,0), makeUnit('unit-2','sentinel',1,1), makeUnit('unit-3','ranger',1,2), makeUnit('unit-4','ranger',1,3), makeUnit('unit-5','mystic',1,4), makeUnit('unit-6','bulwark',1,5), makeUnit('unit-7','archer',1,6)];
  const cases = [
    { name: 'full-bench-upgrade', state: { ...initial, nextUnitSerial: 8, preparation: { ...initial.preparation, units: [...enemies,...fullBench] }, shop: { generation: 1, slots: [{status:'available',definitionId:'arcanist'},{status:'available',definitionId:'sentinel'},...initial.shop.slots.slice(2)] } } },
    { name: 'cascade-three-star', state: { ...initial, nextUnitSerial: 8, preparation: { ...initial.preparation, units: [...enemies,...[makeUnit('unit-1','sentinel',2,0),makeUnit('unit-2','sentinel',2,1),makeUnit('unit-3','sentinel',1,2),makeUnit('unit-4','sentinel',1,3)]] } } },
    { name: 'max-level', state: { ...initial, level: 9, xp: 0, ...expectedShop(initial.seed,1,9) } },
  ];
  for (const fixture of cases) {
    const page = await context.newPage(), errors = []; page.on('pageerror', error => errors.push(error.message)); page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.route('**/src/rendering/match-session.ts*', async route => {
      const response = await route.fetch(), source = await response.text();
      const body = source.replace('initial = createMatch()', `initial = ${JSON.stringify(fixture.state)}`); assert.notEqual(body, source);
      await route.fulfill({ response, body });
    });
    await page.goto(url); await page.waitForFunction(() => window.__CAT_DEBUG__?.read());
    const read = () => page.evaluate(() => window.__CAT_DEBUG__.read()); assert.deepEqual((await read()).state, fixture.state);
    const steps = [];
    const run = async (name, command, input) => { const expected = expectedCommand((await read()).state,command); await input();const snapshot=await read(); assert.deepEqual(snapshot.state,expected.state,name);assertHud(snapshot); steps.push({name,command,expected,state:snapshot.state});return snapshot; };
    const click = async name => {const b=(await read()).bounds[name];await page.mouse.click(b.centerX,b.centerY);};
    if (fixture.name === 'max-level') {
      for(let i=0;i<30;i++)await run(`max-level-F-${i}`,{type:'buyXp'},()=>page.keyboard.press('f'));
    } else if (fixture.name === 'full-bench-upgrade') {
      await run('full-bench-no-merge-reject',{type:'buy',slot:0,generation:1},()=>click('buy-0'));
      const before = await read(), dragged = before.tokens.find(t => t.id === 'unit-2'), destination = before.layout.hexes['6,6'];
      await page.mouse.move(dragged.screenX, dragged.screenY); await page.mouse.down(); await page.mouse.move(destination.x, destination.y, { steps: 8 });
      assert.equal((await read()).draggingId, 'unit-2');
      // A second real touch pointer buys while the mouse keeps a consumed card
      // lifted, exercising the late-release race without calling product commands.
      const cdp = await context.newCDPSession(page), bounds = (await read()).bounds['buy-1'];
      const s=await run('full-bench-third-card-consumes-dragged-unit',{type:'buy',slot:1,generation:1},async()=>{
        await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:bounds.centerX,y:bounds.centerY}]});
        await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      });
      await cdp.detach(); assert.equal(s.draggingId,null); assert.equal(s.selectedId,null);
      assert.equal(s.tokens.find(t=>t.id==='unit-1').starLabel,'★★');assert(!s.tokens.some(t=>['unit-2','unit-8'].includes(t.id)));
      await run('late-mouse-release-after-consumed-drag',{type:'reject',reason:'no-command'},()=>page.mouse.up());
      await run('purchased-slot-repeated',{type:'buy',slot:1,generation:1},()=>click('buy-1'));
    } else {
      const s=await run('one-purchase-cascades-to-three-star',{type:'buy',slot:0,generation:1},()=>click('buy-0'));
      assert.equal(s.tokens.find(t=>t.id==='unit-1').starLabel,'★★★');assert.equal(s.renderedUpgradeCount,2);
      const token=s.tokens.find(t=>t.id==='unit-1');await page.mouse.move(token.screenX,token.screenY);
      await run('immediate-three-star-sale',{type:'sell',id:'unit-1'},()=>page.keyboard.press('e'));
    }
    assert.deepEqual(errors,[]);evidence.fixtures.push({name:fixture.name,isolatedStartup:true,steps,errors});await page.close();
  }
  // Expose only the Phaser instance in this isolated bootstrap response. The
  // production observer remains read-only; no test command/state setter ships.
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  await page.route('**/src/main.ts*',async route=>{const response=await route.fetch(),source=await response.text();const body=source.replace('new Phaser.Game(', 'window.__m3LifecycleGame = new Phaser.Game(');assert.notEqual(body,source);await route.fulfill({response,body});});
  await page.goto(url);await page.waitForFunction(()=>window.__CAT_DEBUG__?.read());
  const before=await page.evaluate(()=>window.__CAT_DEBUG__.read().state);
  await page.evaluate(()=>{window.__m3PreviousDebug=window.__CAT_DEBUG__;window.__m3LifecycleGame.scene.getScene('Board').scene.restart();});
  await page.waitForFunction(()=>window.__CAT_DEBUG__?.read()&&window.__CAT_DEBUG__!==window.__m3PreviousDebug&&window.__m3LifecycleGame.scene.isActive('Board'));
  assert.deepEqual(await page.evaluate(()=>window.__CAT_DEBUG__.read().state),before);
  let expected=expectedCommand(before,{type:'reroll'}).state;await page.keyboard.press('d');assert.deepEqual(await page.evaluate(()=>window.__CAT_DEBUG__.read().state),expected);
  expected=expectedCommand(expected,{type:'buyXp'}).state;await page.keyboard.press('f');assert.deepEqual(await page.evaluate(()=>window.__CAT_DEBUG__.read().state),expected);
  assert.deepEqual(errors,[]);evidence.fixtures.push({name:'scene-restart-single-keydown',isolatedBootstrap:true,errors,state:expected});await page.close();
}
