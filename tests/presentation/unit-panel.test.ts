/** Native Chromium DOM: the repository uses DOM recorders rather than a jsdom dependency.
 * Use the real DOM here to verify node identity, focus, native pointer dispatch and bar styles. */
import { afterAll, beforeAll, expect, it } from 'vitest';
import type { Browser, Page } from 'playwright';
import { testBrowser } from '../fixtures/shared-browser';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
let browser: Browser, page: Page;
// Bundling, browser launch and page setup are separate hooks so each stays within the default hook limit on slow CI runners.
let bundle = '';
beforeAll(async () => {
  const result = await build({ stdin: { contents: `export * from './src/presentation/unit-panel';
    export * from './src/presentation/unit-panel-loader';
    export {attachUnitCards,unitCardBody} from './src/presentation/unit-card';
    export {loadTooltipText} from './src/presentation/tooltip-text-loader';
    export {UNIT_DEFINITIONS} from './src/simulation/units';`, resolveDir: process.cwd() },
    bundle: true, write: false, format: 'iife', globalName: 'Inspect', define: { 'import.meta.env.BASE_URL': '"./"' } });
  bundle = result.outputFiles[0].text;
});
beforeAll(async () => {
  browser = await testBrowser(); page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setContent('<div id="shop-dock" style="position:fixed;top:740px;height:160px"></div><ol class="online-seats" style="position:fixed;left:1100px;width:170px;height:500px"></ol>');
  await page.addStyleTag({ content: readFileSync('src/style.css', 'utf8') });
});
beforeAll(async () => {
  await page.addScriptTag({ content: bundle });
  await page.evaluate(async () => { await (window as any).Inspect.loadTooltipText(); });
});
afterAll(async () => { await browser?.close(); });
it.each([1, 2, 3])('renders rank %i with all ranks and current rank emphasis', async star => {
  const result = await page.evaluate(star => {
    const api = (window as any).Inspect;
    const body = api.buildUnitPanel({ id: 'lux', definitionId: 'lux', starLevel: star, team: 'player' });
    const ability = body.querySelector('.unit-card-ability');
    return { text: ability.textContent, bold: [...ability.querySelectorAll('b')].map((el: any) => el.textContent), stars: body.dataset.star, slots: body.querySelectorAll('[data-slot]').length };
  }, star);
  expect(result.text).toContain('360/540/900');
  expect(result.bold).toContain(String([360, 540, 900][star - 1]));
  expect(result.stars).toBe(String(star)); expect(result.slots).toBe(3);
});
it('renders four-star, neutral and simple anvil bodies', async () => {
  const result = await page.evaluate(() => {
    const api = (window as any).Inspect, data = (id: string, starLevel = 1) => ({ id, definitionId: id, starLevel, team: 'enemy' });
    const four = api.buildUnitPanel(data('lux', 4));
    const neutralId = Object.values(api.UNIT_DEFINITIONS).find((d: any) => d.unitKind === 'neutral') as any;
    const neutral = api.buildUnitPanel(data(neutralId.id));
    const anvilId = 'TFT_ArmoryKeyCompleted';
    const anvil = api.buildUnitPanel(data(anvilId));
    return { four: four.textContent, bold: four.querySelectorAll('.unit-card-ability b').length, neutral: neutral.querySelector('.neutral') !== null, anvil: anvil.classList.contains('unit-card-anvil'), bars: anvil.querySelectorAll('[data-bar]').length };
  });
  expect(result.four).toContain('★★★★'); expect(result.four).toContain('1260'); expect(result.bold).toBe(0);
  expect(result.neutral).toBe(true); expect(result.anvil).toBe(true); expect(result.bars).toBe(0);
});
it('updates live numbers and equipment in place and switches the planning label', async () => {
  const result = await page.evaluate(() => {
    const api = (window as any).Inspect, data = { id: 'lux', definitionId: 'lux', starLevel: 1, team: 'enemy' };
    const body = api.buildUnitPanel(data); document.body.append(body);
    const hp = body.querySelector('[data-value=hp]'), fill = body.querySelector('[data-fill=hp]'), attack = body.querySelector('[data-value=attack]'), slot = body.querySelector('[data-slot]');
    api.updateUnitPanel(body, { ...data, combat: { hp: 200, maxHp: 800, shield: 100, mana: 20, maxMana: 80, attackDamage: 99, abilityPower: 150, armor: 40, magicResist: 45, attackIntervalTicks: 10, attackRange: 4, baseCritChanceBps: 3000, baseCritMultiplierBps: 16000 } });
    const live = { hp: hp.textContent, width: fill.style.width, shield: body.querySelector('[data-fill=shield]').style.width, attack: attack.textContent, speed: body.querySelector('[data-value=speed]').textContent, label: body.querySelector('.inspect-stats-label').textContent, same: hp === body.querySelector('[data-value=hp]') && slot === body.querySelector('[data-slot]') };
    api.updateUnitPanel(body, data); const planning = body.querySelector('.inspect-stats-label').textContent; body.remove();
    return { live, planning, hook: api.planningBonusProjection(data) };
  });
  expect(result.live).toEqual({ hp: '200/800', width: '25%', shield: '12.5%', attack: '99', speed: '2.00', label: '实时属性', same: true });
  expect(result.planning).toBe('基础属性'); expect(result.hook).toBeNull();
});
it('pins only clicks, swaps units, closes on empty/Escape/button/removal and throttles refresh', async () => {
  const result = await page.evaluate(async () => {
    const api = (window as any).Inspect;
    let visible = true, drag = false;
    const data = (id: string) => ({ id, definitionId: id, starLevel: 1, team: 'player' });
    const controller = api.installUnitInspect((p: any) => p.x < 100 ? data('lux') : p.x < 200 ? data('irelia') : null,
      (id: string) => visible ? data(id) : null, () => drag);
    const event = (name: string, x: number) => window.dispatchEvent(new PointerEvent(name, { clientX: x, pointerId: 1, button: 0, isPrimary: true }));
    const click = async (x: number) => { event('pointerdown', x); event('pointerup', x); await new Promise(r => setTimeout(r, 10)); };
    const shown = () => !!document.querySelector('.unit-inspect:not([hidden])');
    event('pointerdown', 20); event('pointermove', 40); event('pointerup', 20); await new Promise(r => setTimeout(r, 10)); const moved = shown();
    event('pointerdown', 20); drag = true; controller.refresh(0); drag = false; event('pointerup', 20); await new Promise(r => setTimeout(r, 10)); const dragged = shown();
    await click(20); const first = document.querySelector('.unit-inspect [data-unit-def]')?.getAttribute('data-unit-def');
    const root = document.querySelector('.unit-inspect') as HTMLElement, rect = root.getBoundingClientRect();
    await click(120); const second = root.querySelector('[data-unit-def]')?.getAttribute('data-unit-def');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); const escape = shown();
    await click(20); (root.querySelector('button') as HTMLElement).click(); const close = shown();
    await click(20); await click(300); const empty = shown();
    await click(20); visible = false; controller.refresh(performance.now() + 50); const throttled = shown(); controller.refresh(performance.now() + 150); const removed = shown();
    controller.dispose();
    return { moved, dragged, first, second, escape, close, empty, throttled, removed, placement: rect.right <= 1092 && rect.bottom <= 732 };
  });
  expect(result).toMatchObject({ moved: false, dragged: false, first: 'lux', second: 'irelia', escape: false, close: false, empty: false, throttled: true, removed: false, placement: true });
});
it('places a narrow viewport sheet above the shop', async () => {
  await page.setViewportSize({ width: 600, height: 900 });
  const rect = await page.evaluate(async () => {
    const api = (window as any).Inspect, panel = await api.createUnitPanel();
    panel.pin(() => ({ id: 'lux', definitionId: 'lux', starLevel: 1, team: 'player' }));
    const rect = panel.root.getBoundingClientRect(), button = panel.root.querySelector('button').getBoundingClientRect();
    panel.dispose(); return { left: rect.left, right: rect.right, bottom: rect.bottom, target: button.width >= 44 && button.height >= 44 };
  });
  expect(rect.left).toBe(8); expect(rect.right).toBe(592); expect(rect.bottom).toBeLessThanOrEqual(732); expect(rect.target).toBe(true);
});

it('refreshes battle totals, notes and equipment without rebuilding the pinned body', async () => {
  const result = await page.evaluate(async () => {
    const api = (window as any).Inspect, panel = await api.createUnitPanel();
    let data: any = { id: 'lux', definitionId: 'lux', starLevel: 1, team: 'player' };
    panel.pin(() => data);
    const body = panel.root.querySelector('.unit-card'), hp = body.querySelector('[data-value=hp]');
    const line = body.querySelector('.unit-card-battle'), text = line.lastElementChild;
    data = { ...data, items: ['bf-sword'], notes: ['终极英雄'], battle: { battle: { damageDealt: 123, damageTaken: 45, healingDone: 6, healingReceived: 7, kills: 1 }, match: null } };
    panel.refresh(performance.now() + 150);
    const result = { same: body === panel.root.querySelector('.unit-card') && hp === body.querySelector('[data-value=hp]') && text === line.lastElementChild,
      battle: line.textContent, visible: !line.hidden, note: body.querySelector('.unit-card-note').textContent };
    data = { ...data, battle: null }; panel.refresh(performance.now() + 300);
    const cleared = line.hidden && !line.hasAttribute('data-battle-dealt');
    panel.dispose(); return { ...result, cleared };
  });
  expect(result).toMatchObject({ same: true, visible: true, note: '终极英雄', cleared: true });
  expect(result.battle).toContain('123/45/6');
});

it('keeps shared mouse hover cards working and suppresses touch hover', async () => {
  const result = await page.evaluate(() => {
    const api = (window as any).Inspect, scope = document.createElement('div'), anchor = document.createElement('button');
    anchor.dataset.unitDef = 'lux'; scope.append(anchor); document.body.append(scope);
    const dispose = api.attachUnitCards(scope);
    const over = (pointerType: string) => anchor.dispatchEvent(new PointerEvent('pointerover', { pointerType, bubbles: true }));
    over('mouse'); const hovered = document.getElementById('unit-card')?.hidden === false;
    anchor.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch', bubbles: true }));
    over('touch'); const touchHidden = document.getElementById('unit-card')?.hidden;
    dispose(); scope.remove(); return { hovered, touchHidden };
  });
  expect(result).toEqual({ hovered: true, touchHidden: true });
});

it('refreshes independent Titan counters in the pinned panel and hover body, then clears them after combat', async () => {
  const result = await page.evaluate(async () => {
    const api = (window as any).Inspect, panel = await api.createUnitPanel();
    const stacks = (a: number, b: number) => [a, b].map((value, slot) => ({ instanceId: `titan-${slot}`, definitionId: 'titans-resolve', stacks: value, maxStacks: 25, slot }));
    let data: any = { id: 'steb', definitionId: 'steb', starLevel: 1, team: 'player', items: ['titans-resolve', 'titans-resolve'], combat: { itemStacks: stacks(1, 3), attackIntervalTicks: 20 } };
    panel.pin(() => data);
    const body = panel.root.querySelector('.unit-card'), line = body.querySelector('[data-debug="unit-card:item-stacks"]');
    const before = line?.textContent;
    data = { ...data, combat: { ...data.combat, itemStacks: stacks(7, 25) } };
    panel.refresh(performance.now() + 150);
    const after = line?.textContent, same = line === body.querySelector('[data-debug="unit-card:item-stacks"]');
    const hover = api.unitCardBody('steb', 1, null, '', [], data.combat.itemStacks).textContent;
    data = { ...data, combat: null }; panel.refresh(performance.now() + 300);
    const cleared = line?.hidden && line?.textContent === '';
    panel.dispose(); return { before, after, same, hover, cleared };
  });
  expect(result.before).toContain('1/25'); expect(result.before).toContain('3/25');
  expect(result.after).toContain('7/25'); expect(result.after).toContain('25/25');
  expect(result.hover).toContain(result.after); expect(result.same).toBe(true); expect(result.cleared).toBe(true);
});
