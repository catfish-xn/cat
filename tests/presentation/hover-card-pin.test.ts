/** Native Chromium DOM (the repository has no jsdom): trait rows open their card on click or tap and keep it pinned. */
import { afterAll, beforeAll, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import { build } from 'esbuild';
import { existsSync } from 'node:fs';
let browser: Browser, page: Page;
beforeAll(async () => {
  const result = await build({ stdin: { contents: `export { attachHoverCards, HoverCard } from './src/presentation/hover-card';`, resolveDir: process.cwd() },
    bundle: true, write: false, format: 'iife', globalName: 'Hover' });
  browser = await chromium.launch({ headless: true, ...(existsSync('/usr/bin/google-chrome') ? { channel: 'chrome' } : {}), args: ['--no-sandbox'] });
  page = await browser.newPage({ viewport: { width: 800, height: 600 }, hasTouch: true });
  await page.setContent(`<style>.row{display:block;width:200px;height:40px}</style><section id="scope"><span class="row" id="a" data-k="a" tabindex="0">A</span>
    <span class="row" id="b" data-k="b">B</span></section><div id="else" style="position:fixed;left:500px;top:400px;width:100px;height:100px"></div>`);
  await page.addScriptTag({ content: result.outputFiles[0].text });
  await page.evaluate(() => {
    const { attachHoverCards, HoverCard } = (window as any).Hover, card = new HoverCard('trait-card', 'hover:trait');
    const scope = document.getElementById('scope')!;
    (window as any).pinned = attachHoverCards(scope, card, '.row', (anchor: HTMLElement) => ({ key: anchor.dataset.k, build: () => Object.assign(document.createElement('p'), { textContent: anchor.dataset.k }) }), { pin: true });
    (window as any).shown = () => { const root = document.getElementById('trait-card')!; return root.hidden ? null : root.dataset.key; };
  });
});
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
