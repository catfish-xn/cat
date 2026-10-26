/** Production presenters in real Chromium; no emulated DOM or game commands. */
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import type { Browser, Page } from 'playwright';
import { testBrowser } from '../fixtures/shared-browser';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
let browser: Browser, page: Page, bundle: string;
beforeAll(async () => {
  const result = await build({ stdin: { resolveDir: process.cwd(), contents: `
    import { StrategyPanel } from './src/rendering/strategy-panel';
    import { InputRouter } from './src/rendering/input-router';
    import { previewRoundEconomy } from './src/simulation/economy-preview';
    import { economyIncomeText } from './src/rendering/online/economy-hint';
    import { createMatch } from './src/simulation/match';
    import { CarouselPanel, CarouselHoldingSlot } from './src/rendering/online/carousel-panel';
    import { PlayersSidebar } from './src/rendering/online/players-sidebar';
    import { StageTrack } from './src/rendering/online/stage-track';
    import { consumableShelf, orbLootSection } from './src/presentation/orb-loot';
    import { CONSUMABLE_DEFINITIONS } from './src/simulation/content/consumables';
    import { ITEM_DEFINITIONS } from './src/simulation/content/g2-3-item-registry';
    import { AUGMENT_DEFINITIONS } from './src/simulation/content/augments';
    import { ANOMALY_DEFINITIONS } from './src/simulation/content/anomalies';
    import { augmentDisplayName, augmentPlayerDescription, augmentEffectText } from './src/presentation/augment-display';
    import { anomalyPlayerDescription } from './src/presentation/g23-display';
    import { attachTextCards } from './src/presentation/text-card';
    import { attachItemPopover } from './src/presentation/item-codex';
    import { loadTooltipText } from './src/presentation/tooltip-text-loader';
    import { loadAugmentText } from './src/presentation/augment-text-loader';
    window.setup = async () => {
      await Promise.all([loadTooltipText(), loadAugmentText()]);
      const host = document.getElementById('host'), dock = document.getElementById('shop-dock');
      const base = createMatch(7), augment = Object.keys(AUGMENT_DEFINITIONS)[0], anomaly = Object.keys(ANOMALY_DEFINITIONS)[0];
      let state = { ...base, economyPreview:previewRoundEconomy(base), consumables:[{consumableId:'owned-tool',definitionId:'magnetic-remover'}], gold: 23, playerHp: 77, streak: {kind:'win',count:3}, augments:[{definitionId:augment}], anomalyBinding:{definitionId:anomaly,unitId:'none'} };
      const calls = window.calls = {pick:0,choose:0,sell:0,tool:0,scout:0};
      const router = new InputRouter();
      const actions = {state:()=>state, combat:()=>({view:null,runtime:null}), battleItems:()=>null, selectedUnit:()=>null,
        cancelGesture:()=>router.cancel(),highlight:()=>{},status:()=>{},unitAt:()=>undefined,choose:()=>calls.choose++};
      const panel = new StrategyPanel(actions, router, dock); panel.render();
      const item = Object.values(ITEM_DEFINITIONS).find(x=>x.kind==='component').id;
      window.ids = { item, augment, anomaly };
      window.expected = {income:state.economyPreview ? economyIncomeText('胜',state.economyPreview.ifWin) : '',augment:[augmentDisplayName(augment),augmentPlayerDescription(augment),augmentEffectText(augment)].filter(Boolean).join('\\n'),anomaly:anomalyPlayerDescription(anomaly),tool:CONSUMABLE_DEFINITIONS['magnetic-remover']};
      window.offer = (kind='forge') => { state = {...state,phase:'choice',pendingChoice:{kind,choiceId:'test-offer',eventId:'test',generation:0,offers:[item],returnPhase:'preparation'}}; panel.render(); };
      window.selection = () => ({ tool:panel.selectedConsumable, gesture:router.current });
      window.offerPool = () => { state = {...state,phase:'choice',pendingChoice:{kind:'forge',choiceId:'pool-choice',eventId:'pool',generation:0,offers:['pool'],returnPhase:'preparation',display:{offers:[{id:'pool',name:'测试奖池',description:'测试组合说明'}]}}}; panel.render(); };
      window.clearOffer = () => { state={...state,phase:'preparation',pendingChoice:null}; panel.render(); };
      const carousel = new CarouselPanel(host,()=>calls.pick++);
      const view = {id:'c', roundName:'2-4', slots:[{slot:0,definitionId:'vex',starLevel:2,items:[item],pickedBy:null}],releaseOrder:['s0'],releaseAtMs:{s0:0},deadlineMs:30000,elapsedMs:0,startedAt:performance.now(),eligible:true,pickedSlot:null,autoPicked:[],status:'open'};
      carousel.render(view,[], 's0',performance.now());
      const holding = new CarouselHoldingSlot(host,()=>calls.sell++); holding.render([{receiptId:'r',unitId:'held',definitionId:'vex'}],true);
      const stage = new StageTrack(); host.append(stage.root); stage.render(3);
      const sidebar = new PlayersSidebar(host,null,()=>calls.scout++);
      sidebar.render({phase:{kind:'preparation',round:3,roundName:'2-1',endsAt:null,serverNow:0},mySeatId:'s0',seats:[{seatId:'s0',name:'测试玩家',kind:'human',connected:false,controller:'takeover',hp:55,level:4,alive:true,publicBoard:[]}]});
      const tools = consumableShelf([{consumableId:'tool',definitionId:'magnetic-remover'}],null,b=>b.addEventListener('click',()=>calls.tool++));
      host.append(tools); const detachTools = attachTextCards(tools);
      const loot = orbLootSection({roundId:'1-2',revealedOrbs:[],revealedDrops:[{dropId:'drop',status:'granted',payload:{kind:'consumable',definitionId:'magnetic-remover',quantity:1}}]}, {sourceName:x=>x});
      host.append(loot); const detachLoot = attachTextCards(loot);
      window.dispose = () => {detachTools();detachLoot();panel.destroy();carousel.dispose();holding.dispose();sidebar.dispose();stage.dispose();};
    };
  ` }, bundle: true, write: false, format: 'iife', loader: { '.css': 'empty' } });
  bundle = result.outputFiles[0].text;
});
// Separate hook: bundling and browser launch each stay within the default hook limit on slow CI runners.
beforeAll(async () => {
  browser = await testBrowser();
  page = await browser.newPage({ viewport: { width: 1600, height: 1200 }, hasTouch: true });
  // install() alone keeps wall time flowing between CDP calls (including after runFor()).
  // Pause before mounting presenters so 449/450 ms describes the entire gesture, even under load.
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-01-02T00:00:00Z'));
});
beforeEach(async () => {
  await page.evaluate(() => (window as any).dispose?.());
  await page.setContent(`<style>${readFileSync('src/style.css', 'utf8')}
    /* Stable test layout; production bodies, scopes and event handlers are unchanged. */
    #host>*{position:relative!important;inset:auto!important;transform:none!important;margin:8px!important}
    body{display:block!important} #host{position:absolute;left:700px;top:0;width:650px} #strategy-root{position:relative;width:600px;height:350px;overflow:auto!important} #shop-dock{position:relative;width:600px}
    .carousel-panel{width:600px}.carousel-ring{height:220px}.carousel-slot{left:120px;top:100px;transform:none!important}
    #shop-dock .hud-hp{display:flex!important}
    .hover-card{pointer-events:none} .choice-overlay{position:fixed}
    </style><body data-online="true"><div id="strategy-root"></div><div id="shop-dock"></div><div id="host"></div></body>`);
  await page.addScriptTag({ content: bundle });
  await page.evaluate(() => (window as any).setup());
  await page.clock.runFor(1000);
});
afterAll(async () => { await page?.context().close(); await browser?.close(); });
const visible = () => page.locator('.hover-card:not([hidden])');
const clean = (text: string) => text.replace(/\n+/g, '\n');
async function hover(selector: string) {
  const target = page.locator(selector).first(); await target.scrollIntoViewIfNeeded(); await page.clock.runFor(20); await page.mouse.move(1590, 10); await target.hover();
  const id = await target.evaluate(node => node.closest('[aria-describedby]')?.getAttribute('aria-describedby'));
  if (!id) throw new Error(`Missing description for ${selector}`);
  return clean(await page.locator(`[id="${id}"]`).innerText());
}
async function hold(selector: string, duration = 450, move = 0) {
  // CDP touch input does not move the mouse. A cursor left over an offer by another test
  // can emit mouse pointerover after touchEnd and reopen an ordinary (unpinned) hover card.
  await page.mouse.move(1590, 10);
  const box = await page.locator(selector).first().boundingBox(); if (!box) throw new Error(selector);
  const client = await page.context().newCDPSession(page), x = box.x + box.width / 2, y = box.y + box.height / 2;
  const started = await page.evaluate(() => performance.now());
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  if (move) {
    // Touch moves reach the page asynchronously (frame-aligned); wait until the page has seen the pointermove
    // before advancing the fake clock, or a loaded runner can fire the 450 ms timer first.
    await page.evaluate(({ x, y }) => {
      (window as any).__moved = new Promise<void>(resolve => {
        const moved = (event: PointerEvent) => {
          if (event.pointerType !== 'touch' || Math.abs(event.clientX - x) > 0.01 || Math.abs(event.clientY - y) > 0.01) return;
          document.removeEventListener('pointermove', moved, true);
          // The production document capture handler was installed before this observer.
          queueMicrotask(resolve);
        };
        document.addEventListener('pointermove', moved, true);
      });
    }, { x: x + move, y });
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + move, y }] });
    await page.evaluate(() => (window as any).__moved);
  }
  await page.clock.runFor(duration);
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await client.detach();
  expect(await page.evaluate(() => performance.now()) - started).toBe(duration);
}
it('item offers in body modal and shop dock hover; long press pins without choosing, short tap chooses', async () => {
  await page.evaluate(() => (window as any).offer());
  const item = '.choice-overlay [data-item-def]';
  expect(await hover(item)).toContain('配方');
  await hold(item); expect(await page.evaluate(() => (window as any).calls.choose)).toBe(0);
  await page.mouse.move(1500, 1100); expect(await visible().count()).toBe(1);
  await page.keyboard.press('Escape'); await page.tap(item);
  expect(await page.evaluate(() => (window as any).calls.choose)).toBe(1);
  await page.evaluate(() => (window as any).clearOffer());
  await page.evaluate(() => (window as any).offer('armory'));
  expect(await hover('#shop-dock [data-item-def]')).toContain('装备');
  await page.evaluate(() => (window as any).clearOffer());
  await page.evaluate(() => (window as any).offer('component'));
  expect(await hover('.choice-overlay [data-item-def]')).toContain('配方');
  await page.evaluate(() => (window as any).dispose()); expect(await page.locator('.hover-card:not(#unit-card):not(#trait-card)').count()).toBe(0);
});
it('moving more than 8px, cancellation and short touches do not long-press', async () => {
  await page.evaluate(() => (window as any).offer());
  const offer = page.locator('.choice-overlay [data-item-def]');
  await offer.evaluate(node => {
    node.setAttribute('data-long-presses', '0');
    node.addEventListener('hover-long-press', () => node.setAttribute('data-long-presses', String(Number(node.getAttribute('data-long-presses')) + 1)));
  });
  await hold('.choice-overlay [data-item-def]', 449);
  expect(await offer.getAttribute('data-long-presses')).toBe('0');
  expect(await page.evaluate(() => (window as any).calls.choose)).toBe(1);
  await hold('.choice-overlay [data-item-def]', 450, 9);
  expect(await offer.getAttribute('data-long-presses')).toBe('0');
  expect(await page.evaluate(() => (window as any).calls.choose)).toBe(2);
  await page.mouse.move(1500, 1100); expect(await page.locator('#modal-item-popover:not([hidden])').count()).toBe(0);
});
it('carousel hero uses slot stars, item has its own card, holding unit includes its rule; picking stays intact', async () => {
  expect(await hover('.carousel-slot')).toContain('★★');
  await hold('.carousel-slot'); await page.mouse.move(1500, 1100);
  expect(await visible().innerText()).toContain('薇古丝'); expect(await page.evaluate(() => (window as any).calls.pick)).toBe(0);
  await page.keyboard.press('Escape'); expect(await hover('.carousel-item')).toContain('配方');
  await hold('.carousel-item'); expect(await page.evaluate(() => (window as any).calls.pick)).toBe(0);
  expect(await page.locator('[data-debug="hover:carousel"]:not([hidden])').count()).toBe(0);
  await page.keyboard.press('Escape');
  await page.tap('.carousel-slot'); expect(await page.evaluate(() => (window as any).calls.pick)).toBe(1);
  expect(await hover('.carousel-holding-name')).toContain('临时位：只保管，不参战');
  await page.click('.carousel-holding-name'); await page.mouse.move(1500, 1100); expect(await page.locator('[data-debug="hover:carousel"]:not([hidden])').count()).toBe(1);
  await page.keyboard.press('Escape'); await page.click('.carousel-holding-sell'); expect(await page.evaluate(() => (window as any).calls.sell)).toBe(1);
});
it('chosen augment and anomaly G cards use existing display text and pin on click/tap', async () => {
  const expected = await page.evaluate(() => (window as any).expected);
  expect(await hover('.augment-strip [data-augment]')).toBe(expected.augment);
  await page.click('.augment-strip [data-augment]'); await page.mouse.move(1500, 1100); expect(clean(await page.locator('[data-debug="hover:text"]:not([hidden])').innerText())).toBe(expected.augment);
  await page.keyboard.press('Escape'); await page.tap('.anomaly-chip'); expect(await page.locator('[data-debug="hover:text"]:not([hidden])').innerText()).toContain(expected.anomaly);
  expect(await page.locator('.augment-strip [title]').count()).toBe(0);
});
it('HUD G cards show current level/XP, population, HP, streak and gold; gold pins', async () => {
  for (const [selector, text] of [['.hud-gold','23'],['.hud-level','等级'],['.hud-xp-bar','经验'],['.hud-pop','人口'],['.hud-hp','77'],['.hud-gold','连胜 3']]) {
    expect(await hover(selector)).toContain(text);
  }
  await page.click('.hud-gold'); await page.mouse.move(1500, 1100); expect(await visible().innerText()).toContain('23');
  expect(await page.locator('.hud-xp-bar').getAttribute('title')).toBeNull();
  const income = await page.evaluate(() => (window as any).expected.income); expect(income).not.toBe(''); expect(await hover('.hud-gold')).toContain(income);
});
it('G cards cover consumable shelf/loot, stage entries and players; action rows use long press', async () => {
  const expected = await page.evaluate(() => (window as any).expected.tool);
  for (const selector of ['#host .consumable-card','.orb-entry']) { const text = await hover(selector); expect(text).toContain(expected.name); expect(text).toContain(expected.description); }
  await hold('#host .consumable-card'); expect(await page.evaluate(() => (window as any).calls.tool)).toBe(0);
  await page.keyboard.press('Escape'); await page.tap('#host .consumable-card'); expect(await page.evaluate(() => (window as any).calls.tool)).toBe(1);
  expect(await hover('.stage-round')).toBe(await page.locator('.stage-round').first().getAttribute('aria-label'));
  const row = await hover('.online-seat'); for (const text of ['测试玩家','生命 55','等级 4','真人断线，机器人临时接管']) expect(row).toContain(text);
  await hold('.online-seat'); expect(await page.evaluate(() => (window as any).calls.scout)).toBe(0);
});

it('a real consumable drag owner is released on long press; a short tap still selects the tool', async () => {
  const selector = '#strategy-root .consumable-card';
  await hover(selector); await hold(selector);
  expect(await page.evaluate(() => (window as any).selection())).toEqual({tool:null,gesture:null});
  await page.keyboard.press('Escape'); await page.tap(selector);
  expect(await page.evaluate(() => (window as any).selection().tool)).toBe('owned-tool');
});
it('a declared pool/bundle uses G text and never gets a concrete item identity', async () => {
  await page.evaluate(() => (window as any).offerPool());
  expect(await page.locator('.choice-overlay [data-item-def]').count()).toBe(0);
  expect(await hover('.choice-overlay [data-text-card]')).toBe('测试奖池\n测试组合说明');
});
