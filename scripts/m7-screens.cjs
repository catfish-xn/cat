/*
 * M7 five-viewport walkthrough: screenshots plus CSS bounds of key controls.
 * Usage: node scripts/m7-screens.cjs --url=http://127.0.0.1:5173 --out=artifacts/m7-screens/base
 * Plays a public fixed-seed-42 game through normal UI controls only.
 */
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const arg = (name, fallback) => (process.argv.find(value => value.startsWith(`--${name}=`)) ?? `=${fallback}`).split('=').slice(1).join('=');
const url = arg('url', 'http://127.0.0.1:5173');
const out = arg('out', 'artifacts/m7-screens/current');
const only = arg('viewports', '');
const VIEWPORTS = [
  { name: 'desktop-1440x1000', width: 1440, height: 1000, mobile: false },
  { name: 'desktop-1440x600', width: 1440, height: 600, mobile: false },
  { name: 'phone-390x844', width: 390, height: 844, mobile: true },
  { name: 'phone-844x390', width: 844, height: 390, mobile: true },
  { name: 'phone-360x640', width: 360, height: 640, mobile: true },
].filter(viewport => !only || only.split(',').includes(viewport.name));

async function measure(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const targets = [...document.querySelectorAll('button, input, select, summary')]
      .filter(node => { const r = node.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !node.closest('[hidden]'); })
      .map(node => { const r = node.getBoundingClientRect(); return { label: (node.dataset.debug || node.getAttribute('aria-label') || node.textContent || '').trim().slice(0, 40), width: Math.round(r.width * 10) / 10, height: Math.round(r.height * 10) / 10 }; });
    const small = targets.filter(target => target.width < 44 || target.height < 44);
    const canvas = document.querySelector('canvas')?.getBoundingClientRect();
    const fonts = [...document.querySelectorAll('#panels-root *')].filter(node => node.childNodes.length && [...node.childNodes].some(child => child.nodeType === 3 && child.textContent.trim()))
      .map(node => parseFloat(getComputedStyle(node).fontSize)).filter(Boolean);
    const snap = window.__CAT_DEBUG__?.read();
    const token = snap?.tokens?.find(value => value.visible);
    return {
      scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth, horizontalOverflow: Math.max(0, doc.scrollWidth - doc.clientWidth),
      canvas: canvas && { x: canvas.x, y: canvas.y, width: canvas.width, height: canvas.height },
      pieceDiameterCSS: canvas && snap ? Math.round(54 * canvas.width / 480 * 10) / 10 : null,
      minPanelFontPx: fonts.length ? Math.min(...fonts) : null,
      smallTargets: small, targetCount: targets.length, phase: snap?.state.phase, round: snap?.state.round, tokenSample: token ?? null,
    };
  });
}

async function phase(page) { return page.evaluate(() => window.__CAT_DEBUG__?.read().state.phase); }

async function chooseUntilPreparation(page, shots) {
  for (let i = 0; i < 6; i++) {
    const current = await phase(page);
    if (current !== 'choice') return;
    await page.waitForSelector('.choice-overlay:not([hidden]) [data-debug^="choice:"], .choice-overlay:not([hidden]) [data-debug^="anomaly-target:"]');
    if (shots && i === 0) await shots('choice');
    await page.locator('.choice-overlay [data-debug^="choice:"], .choice-overlay [data-debug^="anomaly-target:"]').first().click();
    await page.waitForFunction(() => !document.querySelector('[data-debug="choice-dismissal-shield"]'));
  }
}

async function run(browser, viewport) {
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, isMobile: viewport.mobile, hasTouch: viewport.mobile, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  const started = Date.now();
  await page.goto(url);
  await page.waitForFunction(() => { const button = document.querySelector('[data-debug="m6-fixed-start"]'); return button && !button.disabled; });
  const interactiveMs = Date.now() - started;
  const dir = path.join(out, viewport.name); fs.mkdirSync(dir, { recursive: true });
  const report = { viewport, interactiveMs, steps: {} };
  const shots = async name => {
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(dir, `${name}.png`), fullPage: false });
    if (name === 'preparation' || name === 'startup') await page.screenshot({ path: path.join(dir, `${name}-full.png`), fullPage: true });
    report.steps[name] = await measure(page);
  };
  await shots('startup');
  await page.fill('[data-debug="m6-seed-input"]', '42');
  await page.locator('[data-debug="m6-fixed-start"]').click();
  await page.waitForFunction(() => window.__CAT_DEBUG__?.read().m6?.mode === 'active');
  await chooseUntilPreparation(page, shots);
  await shots('preparation');
  await page.locator('[data-debug="mobile:start-combat"]').click();
  await page.waitForFunction(() => window.__CAT_DEBUG__.read().state.combat?.tick > 60);
  await shots('combat');
  await page.waitForFunction(() => window.__CAT_DEBUG__.read().state.phase !== 'combat', null, { timeout: 90000 });
  await shots('settlement');
  await chooseUntilPreparation(page, null);
  const replay = page.locator('#replay-root select');
  if (await replay.count()) {
    await page.waitForFunction(() => document.querySelector('#replay-root select')?.options.length > 1 && !document.querySelector('#replay-root select').disabled, null, { timeout: 15000 }).catch(() => {});
    if (await replay.evaluate(node => node.options.length > 1 && !node.disabled)) {
      await replay.selectOption({ index: 1 });
      await page.waitForFunction(() => window.__CAT_DEBUG__.read().m6?.mode === 'replay', null, { timeout: 15000 });
      await page.waitForTimeout(1500);
      await shots('replay');
    }
  }
  report.errors = errors;
  fs.writeFileSync(path.join(dir, 'report.json'), JSON.stringify(report, null, 2));
  await context.close();
  return report;
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const reports = [];
  for (const viewport of VIEWPORTS) {
    try { reports.push(await run(browser, viewport)); console.log(`${viewport.name}: ok`); }
    catch (error) { reports.push({ viewport, failed: String(error) }); console.log(`${viewport.name}: FAILED ${error}`); }
  }
  await browser.close();
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify(reports.map(report => ({ viewport: report.viewport.name, failed: report.failed, interactiveMs: report.interactiveMs, errors: report.errors,
    steps: Object.fromEntries(Object.entries(report.steps ?? {}).map(([name, step]) => [name, { overflow: step.horizontalOverflow, piece: step.pieceDiameterCSS, minFont: step.minPanelFontPx, small: step.smallTargets.length, phase: step.phase }])) })), null, 2));
  if (reports.some(report => report.failed)) process.exitCode = 1;
})();
