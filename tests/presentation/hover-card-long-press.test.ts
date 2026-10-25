import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { chromium, type Browser, type Page, type CDPSession } from 'playwright';
import { build } from 'esbuild';
import { existsSync } from 'node:fs';
let browser: Browser, page: Page, client: CDPSession;
beforeAll(async () => {
  const result = await build({ stdin: { contents: `export { attachHoverCards, HoverCard } from './src/presentation/hover-card';`, resolveDir: process.cwd() }, bundle: true, write: false, format: 'iife', globalName: 'Hover' });
  browser = await chromium.launch({ headless: true, ...(existsSync('/usr/bin/google-chrome') ? { channel: 'chrome' } : {}), args: ['--no-sandbox'] });
  page = await browser.newPage({ hasTouch: true }); client = await page.context().newCDPSession(page);
  await page.setContent('<section id="scope"><button style="width:100px;height:100px" id="action">领取</button></section>');
  await page.addScriptTag({ content: result.outputFiles[0].text }); await page.clock.install();
});
beforeEach(async () => {
  await page.evaluate(() => {
    (window as any).detach?.(); (window as any).card?.dispose();
    document.getElementById('scope')!.innerHTML = '<button style="width:100px;height:100px" id="action">领取</button>';
    const api = (window as any).Hover, card = (window as any).card = new api.HoverCard('test-card', 'hover:long-press');
    (window as any).clicks = 0;
    document.getElementById('action')!.addEventListener('click', () => (window as any).clicks++);
    (window as any).detach = api.attachHoverCards(document.getElementById('scope'), card, '#action', () => ({key:'领取',build:()=>Object.assign(document.createElement('p'),{textContent:'领取说明'})}), {pin:true,longPress:true});
  });
});
afterAll(async () => { await browser?.close(); });
async function start() { await client.send('Input.dispatchTouchEvent', { type:'touchStart',touchPoints:[{x:40,y:40}] }); }
async function end(type: 'touchEnd' | 'touchCancel' = 'touchEnd') { await client.send('Input.dispatchTouchEvent', { type,touchPoints:[] }); }
const clicks = () => page.evaluate(() => (window as any).clicks);
async function leave() { await page.evaluate(() => (document.activeElement as HTMLElement)?.blur()); await page.mouse.move(600,400); }
const shown = () => page.evaluate(() => !(window as any).card.root.hidden);
it('450 ms consumes the following native click; a 449 ms tap still activates', async () => {
  await start(); await page.clock.runFor(450);
  expect(await page.locator('#action').evaluate(node => node.dispatchEvent(new MouseEvent('contextmenu', { bubbles:true, cancelable:true })))).toBe(false);
  await end(); await leave();
  expect(await clicks()).toBe(0); expect(await shown()).toBe(true);
  await page.keyboard.press('Escape');
  await start(); await page.clock.runFor(449); await end();
  expect(await clicks()).toBe(1); expect(await shown()).toBe(false);
});
it('8 px is allowed; movement beyond 8 px and pointercancel cancel the hold', async () => {
  await start(); await client.send('Input.dispatchTouchEvent', {type:'touchMove',touchPoints:[{x:48,y:40}]});
  await page.clock.runFor(450); await end(); await leave(); expect(await shown()).toBe(true); expect(await clicks()).toBe(0);
  await page.keyboard.press('Escape');
  await start(); await client.send('Input.dispatchTouchEvent', {type:'touchMove',touchPoints:[{x:49,y:40}]});
  await page.clock.runFor(450); await end(); await leave(); expect(await shown()).toBe(false);
  await start(); await page.clock.runFor(300); await end('touchCancel'); await page.clock.runFor(450); await leave(); expect(await shown()).toBe(false);
});
it('removal and disposal cannot open a pending long press', async () => {
  await start(); await page.evaluate(() => document.getElementById('action')!.remove());
  await page.clock.runFor(450); await end(); expect(await shown()).toBe(false);
  await page.evaluate(() => document.getElementById('scope')!.innerHTML = '<button id="action" style="width:100px;height:100px">领取</button>');
  await start(); await page.evaluate(() => (window as any).detach()); await page.clock.runFor(450); await end(); expect(await shown()).toBe(false);
});

it('a long press also consumes a click retargeted to the parent action', async () => {
  await page.evaluate(() => {
    (window as any).detach();
    document.getElementById('scope')!.innerHTML = '<button id="action" style="width:100px;height:100px"><span id="icon" style="display:block;width:16px;height:16px">装</span></button>';
    document.getElementById('action')!.addEventListener('click', () => (window as any).clicks++);
    const api = (window as any).Hover;
    (window as any).detach = api.attachHoverCards(document.getElementById('scope'), (window as any).card, '#icon', () => ({key:'装备',build:()=>Object.assign(document.createElement('p'),{textContent:'装备说明'})}), {pin:true,longPress:true});
  });
  const box = (await page.locator('#icon').boundingBox())!;
  await client.send('Input.dispatchTouchEvent', {type:'touchStart',touchPoints:[{x:box.x+8,y:box.y+8}]});
  await page.clock.runFor(450);
  expect(await page.locator('#action').evaluate(node => node.dispatchEvent(new MouseEvent('click', {bubbles:true,cancelable:true})))).toBe(false);
  await end('touchCancel'); expect(await clicks()).toBe(0);
});
