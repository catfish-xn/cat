/** Native Chromium DOM (the repository has no jsdom): trait rows open their card on click or tap and keep it pinned. */
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from 'vitest';
import type { Browser, BrowserContext, Page } from 'playwright';
import { testBrowser } from '../fixtures/shared-browser';
import { build } from 'esbuild';
let browser: Browser, context: BrowserContext | undefined, page: Page, bundle: string;
// Compilation and the shared-browser connection have independent default hook budgets.
beforeAll(async () => {
  const result = await build({ stdin: { contents: `export { attachHoverCards, HoverCard } from './src/presentation/hover-card';`, resolveDir: process.cwd() },
    bundle: true, write: false, format: 'iife', globalName: 'Hover' });
  bundle = result.outputFiles[0].text;
});
beforeAll(async () => { browser = await testBrowser(); });
// A removed row, a pinned card or the last mouse position must never reach another case.
beforeEach(async () => {
  context = await browser.newContext({ viewport: { width: 800, height: 600 }, hasTouch: true });
  page = await context.newPage();
  await page.setContent(`<style>.row{display:block;width:200px;height:40px}</style><section id="scope"><span class="row" id="a" data-k="a" tabindex="0">A</span>
    <span class="row" id="b" data-k="b">B</span></section><div id="else" style="position:fixed;left:500px;top:400px;width:100px;height:100px"></div>`);
});
beforeEach(async () => {
  await page.addScriptTag({ content: bundle });
  await page.evaluate(() => {
    const { attachHoverCards, HoverCard } = (window as any).Hover, card = new HoverCard('trait-card', 'hover:trait');
    const scope = document.getElementById('scope')!;
    (window as any).pinned = attachHoverCards(scope, card, '.row', (anchor: HTMLElement) => ({ key: anchor.dataset.k, build: () => Object.assign(document.createElement('p'), { textContent: anchor.dataset.k }) }), { pin: true });
    (window as any).shown = () => { const root = document.getElementById('trait-card')!; return root.hidden ? null : root.dataset.key; };
  });
});
afterEach(async () => { await context?.close(); context = undefined; });
afterAll(async () => { await browser?.close(); });
const shown = () => page.evaluate(() => (window as any).shown());

it('pins on click: hover and leaving keep it, pressing elsewhere, the same row or Escape closes', async () => {
  await page.mouse.move(100, 20); expect(await shown()).toBe('a');
  await page.click('#a'); await page.mouse.move(600, 450); expect(await shown()).toBe('a');
  await page.mouse.move(100, 60); expect(await shown()).toBe('a');
  await page.click('#b'); expect(await shown()).toBe('b');
  await page.click('#b'); expect(await shown()).toBeNull();
  await page.click('#a'); await page.mouse.click(600, 450); expect(await shown()).toBeNull();
  await page.click('#a'); await page.keyboard.press('Escape'); expect(await shown()).toBeNull();
});
it('opens on tap, where touch never hovers', async () => {
  await page.tap('#b'); expect(await shown()).toBe('b');
  await page.tap('#else'); expect(await shown()).toBeNull();
});
it('closes when the pinned row is removed (a panel rebuild)', async () => {
  await page.click('#a'); await page.mouse.move(600, 450); expect(await shown()).toBe('a');
  await page.evaluate(() => document.getElementById('a')!.remove());
  await page.waitForFunction(() => (window as any).shown() === null);
});
