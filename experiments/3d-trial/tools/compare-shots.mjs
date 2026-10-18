// After screenshot.mjs has populated shots/original and shots/compare-procedural.
import { createServer } from 'vite';
import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH ?? 'playwright');
const states = ['idle', 'move', 'attack', 'cast', 'death'];
const labels = { idle: '待机', move: '移动', attack: '普攻', cast: '施法', death: '死亡' };
const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>程序动画与原版动作对比</title><style>
body{margin:0;background:#0d1724;color:#fff;font:18px system-ui}h1{font-size:22px;margin:16px}section{padding:8px}h2{font-size:19px;margin:8px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:8px}figure{margin:0}img{width:100%;display:block}figcaption{padding:6px;background:#1d2c3d}</style>
<h1>同一 Map22 竞技场、同一镜头、同一取样时刻 · 14.24</h1>${states.map(s => `<section id="${s}"><h2>${labels[s]}</h2><div class="pair"><figure><figcaption>原程序动画（静态模型位移/旋转）</figcaption><img src="compare-procedural/${s}.png"></figure><figure><figcaption>WAD 原版骨骼与 ANM 动作</figcaption><img src="original/${s}.png"></figure></div></section>`).join('')}</html>`;
await writeFile('shots/comparison.html', html);
const server = await createServer({ server: { port: 5199, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:5199/shots/comparison.html');
  await page.evaluate(() => Promise.all([...document.images].map(i => i.decode())));
  await page.screenshot({ timeout: 180000, path: 'shots/comparison.png', fullPage: true });
  for (const state of states) await page.locator(`#${state}`).screenshot({ timeout: 180000, path: `shots/comparison-${state}.png` });
} finally { await browser.close(); await server.close(); }
console.log('Saved shots/comparison.html, comparison.png and five comparison-*.png');
