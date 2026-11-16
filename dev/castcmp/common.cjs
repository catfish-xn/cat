// Shared bits of the castcmp capture scripts: browser launch per OS, 30fps timeline, timing log.
const fs = require('fs');

// Windows (desktop GPU): headless Chrome on D3D11. Linux (no GPU): SwiftShader software GL.
// --gl gpu|swift overrides; --chrome <path> or CASTCMP_CHROME overrides the browser binary.
function launchOptions(opt) {
  const win = process.platform === 'win32';
  const gl = opt('gl') ?? (win ? 'gpu' : 'swift');
  const candidates = [opt('chrome'), process.env.CASTCMP_CHROME,
    ...(win ? ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe']
      : process.platform === 'darwin' ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'] : ['/usr/bin/google-chrome'])];
  const executablePath = candidates.find(p => p && fs.existsSync(p));
  const args = gl === 'gpu'
    ? ['--ignore-gpu-blocklist', '--enable-gpu', ...(win ? ['--use-angle=d3d11'] : [])]
    : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
  if (!win) args.unshift('--no-sandbox');
  return { gl, options: { headless: true, ...(executablePath ? { executablePath } : {}), args } };
}

// 30fps time points: round(i * 1000 / 30) for 0..ms.
function timeline(ms) {
  const out = [];
  for (let i = 0; ; i++) { const t = Math.floor(i * 1000 / 30 + 0.5); if (t > ms) break; out.push(t); }
  return out;
}

function timer() {
  const t0 = Date.now();
  return name => console.log('T', name, ((Date.now() - t0) / 1000).toFixed(1) + 's');
}

// --form: the renderer (placeholder-renderer.ts) draws the front form for 'melee' only and the back form for anything else,
// so a value outside the rules' UnitForm ('melee' | 'ranged', seat-mechanics/types.ts) silently recorded the back form
// (11-13: --form front on Elise and Jayce played their ranged systems).
const FORMS = ['melee', 'ranged'];
/** Why a --form value cannot be used, or null (undefined: no --form given). */
function formProblem(form) {
  return form === undefined || FORMS.includes(form) ? null : `--form must be ${FORMS.join(' or ')} (the renderer draws anything but melee as the ranged form), got ${form}`;
}

// Render state of a recording (Fable 11-15: unit renders were seen switching between two states across batches on GPU).
// Written as <out>/render-meta.json, with the reference frame (units standing, nothing cast yet) as ref-units.png and a
// fingerprint of its pixels: two recordings may be pixel-compared only when their reference frames match on the unit area.
// What is recorded: the WebGL renderer/vendor strings, context attributes, MSAA samples, drawing-buffer and canvas sizes,
// devicePixelRatio, and the order the asset server's files finished loading (a proxy for texture upload order).
// Before the reference frame: every champion's effect warm-up done (runtime.ts LTK_WARMING.pending 0) and the page's
// resource list unchanged for QUIET_MS of real time (Fable 11-16: a reference frame taken while textures were still
// loading one by one gave two recordings different load lists, so ref-pair flagged a difference that was only timing).
// Gives up after maxMs and says so; render-meta.json keeps what it saw (quiet.ok false = taken mid-load).
const QUIET_MS = 1500;
// skipWarming (v-capture --cold 1): a cold recording must not wait for the warm-up, only for the loads in flight.
async function waitQuiet(page, { maxMs = 30000, skipWarming = false } = {}) {
  const began = Date.now(); let last = -1, since = Date.now(), pending = null;
  while (Date.now() - began < maxMs) {
    const now = await page.evaluate(async () => {
      const runtime = await import('/src/rendering/three-mode/vfx-ltk/runtime.ts').catch(() => null);
      return { loads: performance.getEntriesByType('resource').length, pending: runtime?.LTK_WARMING?.pending ?? null };
    });
    pending = skipWarming ? null : now.pending;
    if (now.loads !== last) { last = now.loads; since = Date.now(); }
    if ((pending === null || pending === 0) && Date.now() - since >= QUIET_MS) return { ok: true, waitedMs: Date.now() - began, loads: last, pending };
    await page.waitForTimeout(250);
  }
  return { ok: false, waitedMs: Date.now() - began, loads: last, pending };
}

async function renderMeta(page, out, boxes, quiet = null) {
  const crypto = require('crypto'), path = require('path');
  const gl = await page.evaluate(() => {
    const canvases = [...document.querySelectorAll('canvas')].map(c => {
      const ctx = c.getContext('webgl2') || c.getContext('webgl');
      if (!ctx) return null;
      const dbg = ctx.getExtension('WEBGL_debug_renderer_info');
      return { width: c.width, height: c.height, clientWidth: c.clientWidth, clientHeight: c.clientHeight,
        drawingBuffer: [ctx.drawingBufferWidth, ctx.drawingBufferHeight], webgl2: typeof WebGL2RenderingContext !== 'undefined' && ctx instanceof WebGL2RenderingContext,
        renderer: dbg ? ctx.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : ctx.getParameter(ctx.RENDERER),
        vendor: dbg ? ctx.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : ctx.getParameter(ctx.VENDOR),
        version: ctx.getParameter(ctx.VERSION), samples: ctx.getParameter(ctx.SAMPLES), sampleBuffers: ctx.getParameter(ctx.SAMPLE_BUFFERS),
        maxSamples: ctx.MAX_SAMPLES ? ctx.getParameter(ctx.MAX_SAMPLES) : null, attributes: ctx.getContextAttributes() };
    }).filter(Boolean);
    const loads = performance.getEntriesByType('resource').filter(e => /\/(assets3d|vfx-ltk|models?|textures?)\//i.test(e.name) || /\.(tex|dds|png|ktx2|glb|bin|json)(\?|$)/i.test(e.name))
      .sort((a, b) => a.responseEnd - b.responseEnd).map(e => new URL(e.name).pathname);
    // Animation clocks (only with ?debug3d, v-capture --render-probe 1): each piece's mixer time and running clips. A
    // piece that idles from its model's load (a dummy, never recast) carries a phase set by when that load finished.
    const r = window.__render3d, anim = r?.pieces ? [...r.pieces].map(([id, v]) => ({ id, def: v.definitionId ?? null, mixerTime: v.mixer?.mixer?.time ?? null,
      running: (v.mixer?.mixer?._actions ?? []).filter(x => x.isRunning()).map(x => ({ clip: x.getClip().name, time: Math.round(x.time * 1000) / 1000 })) })) : null;
    return { dpr: devicePixelRatio, canvases, loads, userAgent: navigator.userAgent, anim };
  });
  // Reference frame: the unit area (union of the unit boxes, padded) as PNG; its sha256 is the fingerprint.
  let ref = null;
  if (boxes && boxes.length) {
    const L = Math.max(0, Math.floor(Math.min(...boxes.map(b => b.left)) - 8)), T = Math.max(0, Math.floor(Math.min(...boxes.map(b => b.top)) - 8));
    const R = Math.min(1920, Math.ceil(Math.max(...boxes.map(b => b.right)) + 8)), B = Math.min(1080, Math.ceil(Math.max(...boxes.map(b => b.bottom)) + 8));
    const clip = { x: L, y: T, width: Math.max(1, R - L), height: Math.max(1, B - T) };
    const png = await page.screenshot({ type: 'png', clip, timeout: 180000 });
    fs.writeFileSync(path.join(out, 'ref-units.png'), png);
    ref = { clip, sha256: crypto.createHash('sha256').update(png).digest('hex') };
  }
  const loadOrder = crypto.createHash('sha256').update(gl.loads.join('\n')).digest('hex').slice(0, 16);
  const main = gl.canvases.slice().sort((a, b) => b.width * b.height - a.width * a.height)[0] ?? null;
  const meta = { at: new Date().toISOString(), quiet, dpr: gl.dpr, userAgent: gl.userAgent, main, canvases: gl.canvases, ref, anim: gl.anim, loads: { count: gl.loads.length, orderSha: loadOrder, order: gl.loads } };
  fs.writeFileSync(path.join(out, 'render-meta.json'), JSON.stringify(meta, null, 1));
  return { renderer: main?.renderer ?? null, samples: main?.samples ?? null, antialias: main?.attributes?.antialias ?? null, dpr: gl.dpr,
    size: main ? [main.width, main.height] : null, refSha: ref?.sha256?.slice(0, 16) ?? null, loads: gl.loads.length, loadOrder, quiet: quiet?.ok ?? null };
}

module.exports = { launchOptions, timeline, timer, FORMS, formProblem, renderMeta, waitQuiet };
