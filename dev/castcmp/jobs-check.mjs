// node dev/castcmp/jobs-check.mjs <jobs.txt> [--out check.json]
// Pre-flight for a jobs file, in node only (no browser, no assets): every `v-capture.cjs ... --real 1` line is simulated the
// way harness.ts replays it (real-combat.ts) and must show, inside its recorded window (--ms, default 3000, from half a
// second before the first cast of the unit): that cast, its targets alive at the end, no other unit casting, and no foe
// next to the caster on its row or nearer the camera (may cover it on screen) from the cast to the window's end.
// Lines without --real are listed as "dummy" (no rules run; nothing to check here). Exit 1 if any real line fails.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL, fileURLToPath } from 'node:url';

const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : undefined; };
if (!argv[0]) { console.error('usage: jobs-check.mjs <jobs.txt> [--out check.json]'); process.exit(2); }
const here = dirname(fileURLToPath(import.meta.url));
const bundle = join(mkdtempSync(join(tmpdir(), 'castcmp-')), 'real-combat.mjs');
await build({ entryPoints: [join(here, 'real-combat.ts')], outfile: bundle, bundle: true, format: 'esm', platform: 'node', logLevel: 'silent' });
const rc = await import(pathToFileURL(bundle).href);

const lines = readFileSync(resolve(argv[0]), 'utf8').split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));
const results = [];
for (const line of lines) {
  const [script, unit, name, ...rest] = line.split(/\s+/);
  const o = k => { const i = rest.indexOf('--' + k); return i >= 0 ? rest[i + 1] : undefined; };
  if (script !== 'v-capture.cjs' || !o('real')) { results.push({ name, unit, mode: 'dummy', ok: true }); continue; }
  const ms = Number(o('ms') ?? 3000);
  const setup = { unit, star: Number(o('star') ?? 3), form: o('form') ?? null, foe: o('target') ?? 'garen', dist: Number(o('dist') ?? 3),
    nfoes: Number(o('nfoes') ?? 4), foestar: Number(o('foestar') ?? 1) };
  const events = [], alive = [], cells = [];
  let run;
  try {
    run = rc.runRealCombat(rc.realUnits(setup), Math.max(rc.DEFAULT_AFTER_TICKS, Math.ceil(ms / 50) - rc.LEAD_TICKS + 1), (state, shown) => {
      events.push(shown); alive.push(Object.fromEntries(state.units.map(u => [u.id, !!u.alive]))); cells.push(rc.cellsOf(state));
    });
  } catch (e) { results.push({ name, unit, mode: 'real', ok: false, why: [String(e.message ?? e)] }); continue; }
  if (run.castIndex < 0) { results.push({ name, unit, mode: 'real', ok: false, why: [`never cast in ${run.ticks} ticks`] }); continue; }
  const a = rc.auditWindow(events, alive, run.castIndex, ms);
  const why = [];
  if (!run.combatStart) why.push('combat start not applied');
  if (!a.coversWindow) why.push(`combat ends at tick ${a.replayEnds}, window ends at ${a.to}`);
  const dead = Object.entries(a.targetsAliveAtEnd).filter(([, up]) => !up).map(([id]) => id);
  if (dead.length) why.push(`target dead by window end: ${dead.join(',')}`);
  if (a.otherCasts.length) why.push(`others cast in window: ${a.otherCasts.map(c => `${c.id}@${c.tick}`).join(' ')}`);
  // A foe standing next to the caster on its row or nearer the camera at the cast may cover it (the browser gate measures
  // the real screen boxes; this is the node stand-in, checked at the cast and through the window).
  const blockers = [...new Set([run.castIndex, ...Array.from({ length: a.to - run.castIndex + 1 }, (_, i) => run.castIndex + i)]
    .filter(t => cells[t]).flatMap(t => rc.frontBlockers(cells[t])))];
  if (blockers.length) why.push(`may cover the caster: ${blockers.join(',')}`);
  results.push({ name, unit, mode: 'real', ok: !why.length, why, castTick: a.castTick, window: [a.from, a.to], targets: a.targets, myCasts: a.myCasts });
}
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.mode.padEnd(5)} ${r.name}${r.castTick !== undefined ? ` cast@${r.castTick} window ${r.window.join('-')} targets ${r.targets.join(',')}` : ''}${r.why?.length ? ' | ' + r.why.join('; ') : ''}`);
if (opt('out')) writeFileSync(resolve(opt('out')), JSON.stringify(results, null, 2));
process.exit(results.some(r => !r.ok) ? 1 : 0);
