// node dev/castcmp/jobs-check.mjs <jobs.txt> [--out check.json]
// Pre-flight for a jobs file, in node only (no browser, no assets): every `v-capture.cjs ... --real 1` line is simulated the
// way harness.ts replays it (real-combat.ts) and must show, inside its recorded window (--ms, default 3000, from half a
// second before the first cast of the unit): that cast, its targets alive at the end and no other unit casting. A foe next
// to the caster on its row or nearer the camera from the cast to the window's end is a warning only (WARN, never a
// failure): the browser gate's box overlap is the authority, and it fails a job only when a foe nearer the camera covers
// over 60% of the caster.
// Lines without --real are listed as "dummy" (no rules run; nothing to check here; --kill and --pin-foe are allowed there and only there).
// --pin-foe N must be 1-5 and comes without --nfoes (or with --nfoes 1); --hide-units takes 1. Both are echoed per line.
// Exit 1 if any real line fails.
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
  if (o('kill') && o('real')) { results.push({ name, unit, mode: 'real', ok: false, why: ['--kill is for dummies only'] }); continue; }
  // --pin-foe N: dummies only, exactly one dummy N hexes ahead (1-5); --hide-units 1: unit models not drawn (labelled).
  const pinWhy = o('pin-foe') === undefined ? [] : [
    ...(o('real') ? ['--pin-foe is for dummies only (a real combat moves the foes and they hit back)'] : []),
    ...(!/^[1-5]$/.test(o('pin-foe')) ? [`--pin-foe must be 1-5, got ${o('pin-foe')}`] : []),
    ...(o('nfoes') !== undefined && o('nfoes') !== '1' ? ['--pin-foe places exactly one dummy: drop --nfoes'] : [])];
  const hideWhy = o('hide-units') === undefined || o('hide-units') === '1' ? [] : [`--hide-units takes 1, got ${o('hide-units')}`];
  const modeTags = { ...(o('pin-foe') !== undefined ? { pinFoe: Number(o('pin-foe')) } : {}), ...(o('hide-units') !== undefined ? { hideUnits: true } : {}) };
  if (pinWhy.length || hideWhy.length) { results.push({ name, unit, mode: o('real') ? 'real' : 'dummy', ok: false, why: [...pinWhy, ...hideWhy] }); continue; }
  if (script !== 'v-capture.cjs' || !o('real')) { results.push({ name, unit, mode: 'dummy', ok: true, ...(o('kill') ? { kill: o('kill') } : {}), ...modeTags }); continue; }
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
  // A foe next to the caster on its row or nearer the camera may cover it (the browser gate measures
  // the real screen boxes; this is the node stand-in, checked at the cast and through the window).
  const blockers = [...new Set([run.castIndex, ...Array.from({ length: a.to - run.castIndex + 1 }, (_, i) => run.castIndex + i)]
    .filter(t => cells[t]).flatMap(t => rc.frontBlockers(cells[t])))];
  const warn = blockers.length ? [`may cover the caster (warning; the browser gate decides): ${blockers.join(',')}`] : [];
  results.push({ name, unit, mode: 'real', ok: !why.length, why, warn, castTick: a.castTick, window: [a.from, a.to], targets: a.targets, myCasts: a.myCasts, ...modeTags });
}
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.mode.padEnd(5)} ${r.name}${r.pinFoe ? ` pinned dummy ${r.pinFoe} hex` : ''}${r.hideUnits ? ' units hidden' : ''}${r.castTick !== undefined ? ` cast@${r.castTick} window ${r.window.join('-')} targets ${r.targets.join(',')}` : ''}${r.why?.length ? ' | ' + r.why.join('; ') : ''}${r.warn?.length ? ' | WARN ' + r.warn.join('; ') : ''}`);
if (opt('out')) writeFileSync(resolve(opt('out')), JSON.stringify(results, null, 2));
process.exit(results.some(r => !r.ok) ? 1 : 0);
