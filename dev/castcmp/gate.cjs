// The recording self-check behind v-capture.cjs --systems (writes gate.json; a failed gate exits non-zero, so batch.cjs
// leaves no .ok). What it reads:
//   - the checkout: HEAD, a clean src/, and the page's own copy of two src files equal to HEAD's (the server is this tree);
//   - the rules (--real 1, harness.ts __h.real.audit): combat start applied, the cast's targets alive at the window's end,
//     nobody but the recorded unit casting inside the window;
//   - the renderer: which attached systems have a layer on screen, sampled per recorded frame from runtime.ts
//     ATTACHED_LAYER_STATS (peak cleared before each step, so its peakSystems are that step's layers), and once before the
//     recorded cast (a system already on screen then is the warm pass's, not this cast's).
// Layer checks need a build with ATTACHED_LAYER_STATS and overlays on: the `before` column (older build) and `off`
// (?attached=off) are exempt from them and say so; every other check still applies.
const { execFileSync } = require('child_process');
const os = require('os');

const SRC_PROBES = ['src/rendering/three-mode/vfx-ltk/runtime.ts', 'src/rendering/three-mode/placeholder-renderer.ts'];
const git = (repo, ...a) => execFileSync('git', a, { cwd: repo, encoding: 'utf8', maxBuffer: 64 << 20 });

async function checkout(page, repo) {
  const head = git(repo, 'rev-parse', 'HEAD').trim();
  let srcClean = true; try { execFileSync('git', ['diff', '--quiet', 'HEAD', '--', 'src'], { cwd: repo }); } catch { srcClean = false; }
  const devTree = git(repo, 'write-tree', '--prefix=dev/castcmp/').trim();
  const probes = [];
  for (const file of SRC_PROBES) {
    const served = await page.evaluate(f => import('/' + f + '?raw').then(m => m.default).catch(() => null), file);
    probes.push({ file, same: served !== null && served === git(repo, 'show', `HEAD:${file}`) });
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

function verdict({ systems, column, real, ckout, audit, pre, timeline, layerStats }) {
  const fails = [], exempt = [];
  if (!ckout.ok) fails.push(`checkout: src clean ${ckout.srcClean}, served src = HEAD ${ckout.probes.map(p => `${p.file.split('/').pop()}:${p.same}`).join(' ')}`);
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
  const layerColumn = column === 'after' || column === 'debug';
  if (!layerColumn) exempt.push(`layer checks (column ${column})`);
  else if (!layerStats) fails.push('layers: this build has no ATTACHED_LAYER_STATS');
  else {
    const seen = new Set(timeline.flatMap(f => f.systems));
    for (const id of systems) {
      if (pre.systems.includes(id)) fails.push(`layers: ${id} already on screen before the cast (warm residue)`);
      if (!seen.has(id)) fails.push(`layers: ${id} never on screen in the window`);
    }
    if (!timeline.some(f => f.layers > 0)) fails.push('layers: peakLayers 0 in the window');
  }
  return { ok: !fails.length, fails, exempt };
}

module.exports = { checkout, resetLayers, readLayers, verdict, machine: () => `${os.hostname()} ${process.platform}` };
