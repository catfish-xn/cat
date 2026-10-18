// 截图：node tools/screenshot.mjs <输出目录>（需先 npm run build，并能找到 playwright）
import { createServer } from 'vite';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH ?? 'playwright');
const out = process.argv[2] ?? 'shots';
await mkdir(out, { recursive: true });
const server = await createServer({ server: { port: 5199 }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('console', (m) => { if (m.type() === 'error') console.log('console:', m.text()); });
page.on('pageerror', (e) => console.log('pageerror:', e.message));
for (const shot of (process.argv[3] ?? 'idle,attack,cast,impact,death,ui').split(',')) {
  const q = shot === 'ui' ? '' : `?shot=${shot}${process.env.EXTRA ?? ''}`;
  await page.goto(`http://localhost:5199/${q}`);
  await page.waitForSelector('body[data-ready="1"]', { timeout: 60000 });
  await page.waitForTimeout(shot === 'ui' ? 3000 : 1500);
  await page.screenshot({ timeout: 180000, path: `${out}/${shot}.png` });
  console.log('saved', shot);
}
await browser.close();
await server.close();
