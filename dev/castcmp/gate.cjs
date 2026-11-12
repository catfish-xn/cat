// The recording self-check behind v-capture.cjs / v-capture-attack.cjs --systems (writes gate.json; a failed gate exits
// non-zero, so batch.cjs leaves no .ok). What it reads:
//   - the checkout: HEAD, a clean src/, and the page's own copy of two src files equal to HEAD's (the server is this tree);
//   - the rules (--real 1, harness.ts __h.audit): combat start applied, the cast's targets alive at the window's end,
//     nobody but the recorded unit casting inside the window;
//   - the vfx runtime, per recorded frame: every system running (harness probes.ts, any build) and the attached systems
//     with a layer on screen (runtime.ts ATTACHED_LAYER_STATS, peak cleared before each step; builds that have it), plus
//     one sample just before the recorded action (a system already running then is the warm pass's, not this action's);
//   - covering, at the action frame: a foe nearer the camera (its box's bottom below the caster's) over 60% of the
//     caster's box fails; any other overlap over 30% is a warning in notes (warnings[]), not a failure;
//   - optionally (--probe overhead) the caster's overhead bar against its body on screen, per frame; (--probe attached)
//     every attached overlay drawn, per frame: tint, blend state, textures and whether each has loaded (recorded only).
//     Both: --probe overhead,attached.
// Options: --systems id,id|none (must run in the judged window), --absent id,id (must not run in it), --layers id,id|none
// (which of --systems must also show an attached layer; default all of them), --from/--to ms (the judged window on the
// recording's clock; default all of it), --column before|after|off|debug.
// The `before` column (the older build) only records which systems ran: it is where they are expected to be missing or
// different, so neither presence nor absence fails it. `off` (?attached=off) and `before` are exempt from layer checks.
// Whether play() returned true is not read (that needs a hook in src/): a system that started is the evidence, since play
// queues nothing unless it returns true.
const { execFileSync } = require('child_process');
const os = require('os');

const SRC_PROBES = ['src/rendering/three-mode/vfx-ltk/runtime.ts', 'src/rendering/three-mode/placeholder-renderer.ts'];
const git = (repo, ...a) => execFileSync('git', a, { cwd: repo, encoding: 'utf8', maxBuffer: 64 << 20 });
const list = v => v === undefined || v === 'none' ? [] : v.split(',').filter(Boolean);
/** Overlap above this share of the caster's box at the action frame is a warning (notes only). */
const WARN_COVER = 0.3;
/** A foe nearer the camera than the caster (box bottom lower on screen) may cover at most this share; above it fails. */
const MAX_COVER = 0.6;

async function checkout(page, repo) {
  const head = git(repo, 'rev-parse', 'HEAD').trim();
  let srcClean = true; try { execFileSync('git', ['diff', '--quiet', 'HEAD', '--', 'src'], { cwd: repo }); } catch { srcClean = false; }
  const devTree = git(repo, 'write-tree', '--prefix=dev/castcmp/').trim();
  const probes = [];
  for (const file of SRC_PROBES) {
    const served = await page.evaluate(f => import('/' + f + '?raw').then(m => m.default).catch(() => null), file);
    // Line endings aside: a Windows checkout (core.autocrlf) holds CRLF files whose blobs are still HEAD's.
    const lf = text => text.replace(/\r\n/g, '\n');
    probes.push({ file, same: served !== null && lf(served) === lf(git(repo, 'show', `HEAD:${file}`)) });
  }
  return { head, srcClean, devCastcmpTree: devTree, probes, ok: srcClean && probes.every(p => p.same) };
}

/** Clears the layer peak; the next read returns what was on screen during the steps in between. */
const resetLayers = page => page.evaluate(async () => {
  const r = await import('/src/rendering/three-mode/vfx-ltk/runtime.ts').catch(() => null);
  const s = r?.ATTACHED_LAYER_STATS; if (!s) return false;
  s.peakLayers = 0; s.peakSystems = {}; return true;
});
const readLayers = page => page.evaluate(async () => {
  const r = await import('/src/rendering/three-mode/vfx-ltk/runtime.ts').catch(() => null);
  const s = r?.ATTACHED_LAYER_STATS; if (!s) return null;
  // peakSystems keys are `<system>@<source>+<started>:<emitter>`.
  return { layers: s.peakLayers, systems: [...new Set(Object.keys(s.peakSystems).map(k => k.split('@')[0]))] };
});
/** Systems running now, and those that started since the last read (the harness probe). */
const readRunning = page => page.evaluate(() => { const s = window.__h.systems?.(); window.__h.resetStarts?.(); return s ?? null; });

/** Share of `me`'s screen box covered by each foe's box in one frame. */
function cover(boxes) {
  const me = boxes.me; if (!me) return {};
  const area = b => Math.max(0, b.right - b.left) * Math.max(0, b.bottom - b.top);
  return Object.fromEntries(Object.entries(boxes).filter(([id, b]) => id !== 'me' && b).map(([id, b]) => {
    const i = { left: Math.max(me.left, b.left), right: Math.min(me.right, b.right), top: Math.max(me.top, b.top), bottom: Math.min(me.bottom, b.bottom) };
    return [id, +(area(i) / Math.max(1, area(me))).toFixed(3)];
  }));
}

/**
 * One recording's gate. `opt` is the script's option reader; `ctx` = { page, repo, unit, real, times, actionAtMs }.
 * Call pre() just before the recorded action, frame(t) after each recorded step, finish(record) at the end.
 */
function createGate(opt, ctx) {
  const enabled = opt('systems') !== undefined;
  const systems = list(opt('systems')), absent = list(opt('absent'));
  const layerIds = opt('layers') === undefined ? systems : list(opt('layers'));
  const column = opt('column') ?? (opt('attached') === 'off' ? 'off' : opt('attached') === 'debug' ? 'debug' : 'after');
  const from = Number(opt('from') ?? -Infinity), to = Number(opt('to') ?? Infinity);
  const probeList = list(opt('probe')), probeOverhead = probeList.includes('overhead'), probeAttached = probeList.includes('attached');
  const frames = [];
  let ckout = null, pre = { running: [], layers: [] }, sampleLayers = false;
  return {
    enabled, column,
    async start() { if (enabled) ckout = await checkout(ctx.page, ctx.repo); },
    async pre() {
      if (!enabled) return;
      sampleLayers = await resetLayers(ctx.page);
      await ctx.page.evaluate(() => window.__h.step(100));
      const running = await readRunning(ctx.page), layers = sampleLayers ? await readLayers(ctx.page) : null;
      pre = { running: running?.live ?? [], layers: layers?.systems ?? [] };
    },
    async beforeStep() { if (enabled && sampleLayers) await resetLayers(ctx.page); },
    async frame(t) {
      if (!enabled && !probeOverhead && !probeAttached) return;
      const f = { t };
      if (enabled) {
        const running = await readRunning(ctx.page);
        f.running = [...new Set([...(running?.live ?? []), ...(running?.started ?? []).map(s => s.system)])];
        f.starts = (running?.started ?? []).map(s => `${s.system}@${s.source ?? ''}:${s.action ?? ''}`);
        if (sampleLayers) { const l = await readLayers(ctx.page); f.layers = l?.layers ?? 0; f.layerSystems = l?.systems ?? []; }
        f.boxes = await ctx.page.evaluate(() => Object.fromEntries(['me', 'foe', 'foe2', 'foe3', 'foe4'].map(id => [id, window.__h.box(id) ?? null])));
      }
      if (probeOverhead) f.overhead = await ctx.page.evaluate(() => window.__h.overhead?.('me') ?? null);
      if (probeAttached) f.attachedDraws = await ctx.page.evaluate(() => window.__h.attached?.() ?? null);
      frames.push(f);
    },
    async finish(record) {
      const fs = require('fs'), path = require('path');
      if (probeAttached) fs.writeFileSync(path.join(record.out, 'attached.json'), JSON.stringify(frames.map(f => ({ t: f.t, ...(f.attachedDraws ?? {}) })), null, 2));
      if (probeOverhead) fs.writeFileSync(path.join(record.out, 'overhead.json'), JSON.stringify(frames.map(f => ({ t: f.t, ...(f.overhead ?? {}) })), null, 2));
      if (!enabled) return true;
      const audit = ctx.real ? await ctx.page.evaluate(ms => window.__h.audit ? { ...window.__h.audit(ms), combatStart: window.__h.real?.combatStart } : null, ctx.times[ctx.times.length - 1]) : null;
      const v = verdict({ systems, absent, layerIds, column, real: ctx.real, ckout, audit, pre, frames, from, to, actionAtMs: ctx.actionAtMs, sampleLayers, probeOverhead });
      const out = { ...v, unit: ctx.unit, column, actionAtMs: ctx.actionAtMs, systems, absent, layers: layerIds, window: { from: Number.isFinite(from) ? from : null, to: Number.isFinite(to) ? to : null },
        snapshot: opt('snapshot') ?? null, machine: `${os.hostname()} ${process.platform}`, at: new Date().toISOString(), checkout: ckout, audit, preAction: pre, ...record.meta, frames };
      fs.writeFileSync(path.join(record.out, 'gate.json'), JSON.stringify(out, null, 2));
      console.log('gate', v.ok ? 'PASS' : 'FAIL', v.fails.join(' | '), v.exempt.length ? '(exempt: ' + v.exempt.join('; ') + ')' : '');
      return v.ok;
    },
  };
}

function verdict({ systems, absent, layerIds, column, real, ckout, audit, pre, frames, from, to, actionAtMs, sampleLayers, probeOverhead, sampledRunning = true }) {
  const fails = [], exempt = [], notes = [], warnings = [];
  notes.push('play() return: not read; a named system that started is the evidence that play() returned true');
  const judged = frames.filter(f => f.t >= from && f.t <= to);
  // Covering, at the action frame.
  const actionFrame = frames.find(f => f.t >= actionAtMs) ?? frames[0];
  if (actionFrame?.boxes) {
    const c = cover(actionFrame.boxes), worst = Object.entries(c).sort((x, y) => y[1] - x[1])[0];
    notes.push(`cover at ${actionFrame.t}ms: ${JSON.stringify(c)}`);
    const me = actionFrame.boxes.me;
    for (const [id, share] of Object.entries(c)) {
      const front = actionFrame.boxes[id].bottom > me.bottom, pct = (share * 100).toFixed(0);
      if (front && share > MAX_COVER) fails.push(`cover: ${id} (nearer the camera) covers ${pct}% of the caster's box at the action (${actionFrame.t}ms; max ${MAX_COVER * 100}% for a foe in front)`);
      else if (share > WARN_COVER) warnings.push(`cover: ${id} (${front ? 'nearer the camera' : 'behind the caster'}) covers ${pct}% of the caster's box at the action (${actionFrame.t}ms); warning only`);
    }
  } else fails.push('cover: no boxes recorded');
  if (!ckout?.ok) fails.push(`checkout: src clean ${ckout?.srcClean}, served src = HEAD ${(ckout?.probes ?? []).map(p => `${p.file.split('/').pop()}:${p.same}`).join(' ')}`);
  if (real) {
    if (!audit) fails.push('real: no audit from the page');
    else {
      if (!audit.combatStart) fails.push('real: combat start not applied');
      if (!audit.coversWindow) fails.push(`real: combat ends at tick ${audit.replayEnds}, before the window's end ${audit.to}`);
      const dead = Object.entries(audit.targetsAliveAtEnd).filter(([, up]) => !up).map(([id]) => id);
      if (dead.length) fails.push(`real: target dead by window end: ${dead.join(',')}`);
      if (audit.otherCasts.length) fails.push(`real: others cast in window: ${audit.otherCasts.map(c => `${c.id}@${c.tick}`).join(' ')}`);
    }
  } else exempt.push('rules checks (not --real: dummies, no rules run)');
  // Running systems.
  const ran = new Set(judged.flatMap(f => f.running ?? []));
  const report = { ran: systems.filter(id => ran.has(id)), missing: systems.filter(id => !ran.has(id)), absentButRan: absent.filter(id => ran.has(id)), runningBeforeAction: [...systems, ...absent].filter(id => pre.running.includes(id)) };
  notes.push(`systems: ${JSON.stringify(report)}`);
  if (!sampledRunning) exempt.push('running systems (gate.json from before the running-system probe: layers only)');
  else if (column === 'before') exempt.push('system presence/absence (column before: recorded only)');
  else {
    for (const id of report.missing) fails.push(`systems: ${id} never ran in the judged window`);
    for (const id of report.absentButRan) fails.push(`systems: ${id} ran in the judged window but must not`);
    for (const id of systems) if (pre.running.includes(id)) fails.push(`systems: ${id} already running before the action (warm residue)`);
  }
  // Attached layers, for the systems that carry them.
  if (!(column === 'after' || column === 'debug')) exempt.push(`layer checks (column ${column})`);
  else if (!layerIds.length) exempt.push('layer checks (no attached systems named)');
  else if (!sampleLayers) fails.push('layers: this build has no ATTACHED_LAYER_STATS');
  else {
    const seen = new Set(judged.flatMap(f => f.layerSystems ?? []));
    for (const id of layerIds) {
      if (pre.layers.includes(id)) fails.push(`layers: ${id} already on screen before the action (warm residue)`);
      if (!seen.has(id)) fails.push(`layers: ${id} never on screen in the judged window`);
    }
    if (!judged.some(f => f.layers > 0)) fails.push('layers: peakLayers 0 in the judged window');
  }
  // Overhead bar against the body (recorded; the before/after comparison is keyframes.cjs's).
  let overhead = null;
  if (probeOverhead) {
    const pts = judged.filter(f => f.overhead && Number.isFinite(f.overhead.dx));
    const worst = pts.reduce((w, f) => !w || Math.abs(f.overhead.dx) > Math.abs(w.overhead.dx) ? f : w, null);
    overhead = worst ? { maxAbsDx: Math.abs(worst.overhead.dx), atMs: worst.t, frames: pts.length } : { maxAbsDx: null, frames: 0 };
    if (!pts.length) fails.push('overhead: no bar/body point found in the judged window');
  }
  notes.push(...warnings.map(w => 'WARN ' + w));
  return { ok: !fails.length, fails, exempt, notes, warnings, overhead };
}

/** A gate.json from before 5f8a3be8 (layerTimeline / boxTimeline / preCast, no running-system samples) in today's shape:
 * frames from its two timelines, its systems as the layer ids, nothing to judge for running systems. */
function upgradeOld(g) {
  if (g.frames || !g.layerTimeline) return g;
  // Builds without ATTACHED_LAYER_STATS (a before column) wrote an empty layerTimeline: their frames carry boxes only.
  const boxes = new Map((g.boxTimeline ?? []).map(b => [b.t, b.boxes])), layers = new Map(g.layerTimeline.map(l => [l.t, l]));
  const frames = [...new Set([...boxes.keys(), ...layers.keys()])].sort((a, b) => a - b).map(t => ({ t, boxes: boxes.get(t) ?? null,
    ...(layers.has(t) ? { layers: layers.get(t).layers ?? 0, layerSystems: layers.get(t).systems ?? [] } : {}) }));
  return { ...g, frames, layers: g.systems ?? [], absent: [], preAction: { running: [], layers: g.preCast?.systems ?? [] }, oldFormat: true };
}

/** A written gate.json judged again by this verdict(), with no recording: what it recorded (frames, pre-action sample,
 * audit, checkout) under today's rules. Files from before actionAtMs was stored: 500 ms for --real runs, else 0. Files from
 * before the running-system probe (78b6adfc and older) are judged on layers, covering, checkout and rules only. */
function regate(raw) {
  const g = upgradeOld(raw);
  const v = verdict({ systems: g.systems ?? [], absent: g.absent ?? [], layerIds: g.layers ?? [], column: g.column, real: !!g.real, ckout: g.checkout,
    audit: g.audit, pre: g.preAction ?? { running: [], layers: [] }, frames: g.frames ?? [], from: g.window?.from ?? -Infinity, to: g.window?.to ?? Infinity,
    actionAtMs: g.actionAtMs ?? (g.real ? 500 : 0), sampleLayers: (g.frames ?? []).some(f => 'layers' in f), probeOverhead: g.overhead != null,
    sampledRunning: !g.oldFormat });
  return { ...g, ...v, regated: { at: new Date().toISOString(), was: { ok: raw.ok, fails: raw.fails } } };
}

module.exports = { regate, createGate, checkout, cover, verdict, MAX_COVER, WARN_COVER };
