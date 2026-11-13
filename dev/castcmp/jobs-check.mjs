// node dev/castcmp/jobs-check.mjs <jobs.txt> [--out check.json]
// Pre-flight for a jobs file, in node only (no browser, no assets): every `v-capture.cjs ... --real 1` line is simulated the
// way harness.ts replays it (real-combat.ts) and must show, inside its recorded window (--ms, default 3000, from half a
// second before the first cast of the unit): that cast, its targets alive at the end and no other unit casting. A foe next
// to the caster on its row or nearer the camera from the cast to the window's end is a warning only (WARN, never a
// failure): the browser gate's box overlap is the authority, and it fails a job only when a foe nearer the camera covers
// over 60% of the caster.
// Lines without --real are listed as "dummy" (no rules run; nothing to check here; --kill is allowed there and only there).
// --cast-index N / --from-start 1 / --lead-ms MS (real only) choose the window (anchor = the N-th cast; start = combat start or
// MS before the anchor); a real line's --times must start at 0.
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
  if ((o('from-start') !== undefined || o('lead-ms') !== undefined || o('cast-index') !== undefined) && (script !== 'v-capture.cjs' || !o('real'))) { results.push({ name, unit, mode: 'dummy', ok: false, why: ['--from-start / --lead-ms / --cast-index are for v-capture.cjs --real only'] }); continue; }
  if (script !== 'v-capture.cjs' || !o('real')) { results.push({ name, unit, mode: 'dummy', ok: true, ...(o('kill') ? { kill: o('kill') } : {}) }); continue; }
  // The recorded window's length, as v-capture.cjs takes it: the last --times point, else --ms (default 3000).
  const ms = o('times') !== undefined ? Number(o('times').split(',').at(-1)) : Number(o('ms') ?? 3000);
  // --cast-index N / --from-start 1 / --lead-ms MS: the window choice (real-combat.ts leadTicksFor); default 500 ms before the first cast.
  const start = { fromStart: o('from-start') === '1', leadMs: o('lead-ms') !== undefined ? Number(o('lead-ms')) : null, castNumber: o('cast-index') !== undefined ? Number(o('cast-index')) : 1 };
  const startWhy = [
    ...(o('from-start') !== undefined && o('from-start') !== '1' ? [`--from-start takes 1, got ${o('from-start')}`] : []),
    ...(o('lead-ms') !== undefined && !(Number(o('lead-ms')) >= 0) ? [`--lead-ms must be ms >= 0, got ${o('lead-ms')}`] : []),
    ...(start.fromStart && start.leadMs !== null ? ['--from-start and --lead-ms: give one'] : []),
    ...(o('cast-index') !== undefined && !/^[1-9][0-9]*$/.test(o('cast-index')) ? [`--cast-index must be 1, 2, ..., got ${o('cast-index')}`] : []),
    // Rule (11-13): a real recording's --times starts at 0, the window's first tick.
    ...(o('times') !== undefined && Number(o('times').split(',')[0]) !== 0 ? [`--times must start at 0 for --real, got ${o('times').split(',')[0]}`] : [])];
  if (startWhy.length) { results.push({ name, unit, mode: 'real', ok: false, why: startWhy }); continue; }
  const custom = start.fromStart || start.leadMs !== null || o('cast-index') !== undefined;
  const setup = { unit, star: Number(o('star') ?? 3), form: o('form') ?? null, foe: o('target') ?? 'garen', dist: Number(o('dist') ?? 3),
    nfoes: Number(o('nfoes') ?? 4), foestar: Number(o('foestar') ?? 1) };
  const events = [], alive = [], cells = [];
  let run;
  try {
    run = rc.runRealCombat(rc.realUnits(setup), rc.afterTicksFor(ms, start), (state, shown) => {
      events.push(shown); alive.push(Object.fromEntries(state.units.map(u => [u.id, !!u.alive]))); cells.push(rc.cellsOf(state));
    }, start.castNumber);
  } catch (e) { results.push({ name, unit, mode: 'real', ok: false, why: [String(e.message ?? e)] }); continue; }
  if (run.castIndex < 0) { results.push({ name, unit, mode: 'real', ok: false, why: [`never cast${start.castNumber !== 1 ? ` ${start.castNumber} times` : ''} in ${run.ticks} ticks`] }); continue; }
  const a = rc.auditWindow(events, alive, run.castIndex, ms, rc.leadTicksFor(run.castIndex, start));
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
  // With an asked-for start the window may end before the first cast (fine when the attacks are the point): say so.
  if (custom && a.castTick > a.to) warn.push(`anchor cast (#${start.castNumber}) at tick ${a.castTick} is after the window (ticks ${a.from}-${a.to})`);
  results.push({ name, unit, mode: 'real', ok: !why.length, why, warn, castTick: a.castTick, window: [a.from, a.to], targets: a.targets, myCasts: a.myCasts, ...(custom ? { anchorCast: start.castNumber, windowStart: start.fromStart ? 'combat start' : `${start.leadMs ?? 500} ms before the anchor cast` } : {}) });
}
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.mode.padEnd(5)} ${r.name}${r.castTick !== undefined ? ` cast@${r.castTick} window ${r.window.join('-')} targets ${r.targets.join(',')}` : ''}${r.why?.length ? ' | ' + r.why.join('; ') : ''}${r.warn?.length ? ' | WARN ' + r.warn.join('; ') : ''}`);
if (opt('out')) writeFileSync(resolve(opt('out')), JSON.stringify(results, null, 2));
process.exit(results.some(r => !r.ok) ? 1 : 0);
