/*
 * Measures time from navigation to the public "以固定种子开始" button being enabled,
 * against an already running production preview. Fresh context per sample.
 * Usage: node scripts/m7-interactive-time.cjs --url=http://127.0.0.1:4173 --samples=7
 */
const { chromium } = require('playwright');
const arg = (name, fallback) => (process.argv.find(value => value.startsWith(`--${name}=`)) ?? `=${fallback}`).split('=').slice(1).join('=');
(async () => {
  const url = arg('url', 'http://127.0.0.1:4173'), samples = Number(arg('samples', '7'));
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const times = [];
  for (let i = 0; i < samples; i++) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    const started = Date.now();
    await page.goto(url, { waitUntil: 'commit' });
    await page.waitForFunction(() => { const button = document.querySelector('[data-debug="m6-fixed-start"]'); return button && !button.disabled; });
    times.push(Date.now() - started);
    await context.close();
  }
  await browser.close();
  const sorted = [...times].sort((a, b) => a - b);
  console.log(JSON.stringify({ url, samples: times, median: sorted[Math.floor(sorted.length / 2)], max: sorted.at(-1) }));
})();
