/* Optional read-only observer, not part of the M7 gate or CI configuration.
 * M8_TOUCH_PROBE_OUT=artifacts/touch.json node --require=./scripts/probe-m7-native-touch.cjs
 *   scripts/verify-m7-presentation.cjs --url=http://127.0.0.1:4173 --out=artifacts/m7
 * Records trusted input capture/bubble timing while running the complete gate unchanged.
 */
const fs = require('node:fs'), path = require('node:path');
const { chromium } = require('playwright');
const output = process.env.M8_TOUCH_PROBE_OUT;
if (!output) throw new Error('M8_TOUCH_PROBE_OUT is required');

function observeInput() {
  const events = [], ids = new WeakMap(); let serial = 0;
  window.__M8_TOUCH_PROBE__ = events;
  for (const type of ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'click']) {
    for (const phase of ['capture', 'bubble']) window.addEventListener(type, event => {
      const name = event.target?.closest?.('[data-debug]')?.dataset.debug;
      if (!name?.startsWith('mobile:')) return;
      if (!ids.has(event)) ids.set(event, serial++);
      events.push({ id: ids.get(event), type, phase, name, at: performance.now(), trusted: event.isTrusted });
    }, phase === 'capture');
  }
}

const launch = chromium.launch.bind(chromium);
chromium.launch = async (...args) => {
  const browser = await launch(...args), contexts = new Set(), records = [];
  const newContext = browser.newContext.bind(browser), closeBrowser = browser.close.bind(browser);
  async function capture(context) {
    if (!contexts.delete(context)) return;
    for (const page of context.pages()) {
      const events = await page.evaluate(() => window.__M8_TOUCH_PROBE__ ?? []);
      const clicks = events.filter(e => e.type === 'click' && e.phase === 'capture');
      const index = clicks.findIndex(e => e.name === 'mobile:continue');
      const first = clicks[index], second = clicks[index + 1];
      const bubble = first && events.find(e => e.id === first.id && e.phase === 'bubble');
      records.push({ events, measurement: first && second && bubble ? {
        first, second, clickGapMs: second.at - first.at,
        firstHandlerMs: bubble.at - first.at, afterHandlerMs: second.at - bubble.at,
      } : null });
    }
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, JSON.stringify({ browser: browser.version(), records }, null, 2));
  }
  browser.newContext = async (...args) => {
    const context = await newContext(...args);
    if (args[0]?.hasTouch) {
      await context.addInitScript(observeInput); contexts.add(context);
      const close = context.close.bind(context);
      context.close = async (...args) => { await capture(context); return close(...args); };
    }
    return context;
  };
  browser.close = async (...args) => {
    try { for (const context of [...contexts]) await capture(context); }
    finally { await closeBrowser(...args); }
  };
  return browser;
};
