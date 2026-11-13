// node dev/castcmp/jobs-check.mjs <jobs.txt> [--out check.json]
// Pre-flight for a jobs file, in node only (no browser, no assets): every `v-capture.cjs ... --real 1` line is simulated the
// way harness.ts replays it (real-combat.ts) and must show, inside its recorded window (--ms, default 3000, from half a
// second before the first cast of the unit): that cast, its targets alive at the end and no other unit casting. A foe next
// to the caster on its row or nearer the camera from the cast to the window's end is a warning only (WARN, never a
// failure): the browser gate's box overlap is the authority, and it fails a job only when a foe nearer the camera covers
// over 60% of the caster.
// Lines without --real are listed as "dummy" (no rules run; nothing to check here; --kill and --pin-foe are allowed there and only there).
// --pin-foe N must be 1-5 and comes without --nfoes (or with --nfoes 1); --hide-units takes 1. Both are echoed per line.
// --cast-index N / --from-start 1 / --lead-ms MS (real only) choose the window (anchor = the N-th cast; start = combat start or
// MS before the anchor); a real line's --times must start at 0, and that t=0 frame is the start only, never a keyframe (WARN).
// --foe-offset K (real only) moves every foe K columns to the side; each must stay on columns 0-6.
// --ally-cell / --foe-cell / --foe2-cell R,C and --foe2 X / --foe2star N (real only) place those units (on the board, one per
// cell; --foe2* need --nfoes 2+). With --ally the line prints "ally line D": how near (hex widths, cell centres) the ally came
// to the caster->first target line in the window ("clear": never between them); under 0.5 is a WARN.
// Only the recorded window counts: a tank that stands on the line at combat start and walks off before the window opens
// gives no warning.
// --form takes melee or ranged (any line): anything else fails, since the renderer would draw the ranged form.
// Exit 1 if any real line fails.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : undefined; };
if (!argv[0]) { console.error('usage: jobs-check.mjs <jobs.txt> [--out check.json]'); process.exit(2); }
const here = dirname(fileURLToPath(import.meta.url));
const { formProblem } = createRequire(import.meta.url)('./common.cjs');
const bundle = join(mkdtempSync(join(tmpdir(), 'castcmp-')), 'real-combat.mjs');
await build({ entryPoints: [join(here, 'real-combat.ts')], outfile: bundle, bundle: true, format: 'esm', platform: 'node', logLevel: 'silent' });
const rc = await import(pathToFileURL(bundle).href);

const lines = readFileSync(resolve(argv[0]), 'utf8').split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));
const results = [];
for (const line of lines) {
  const [script, unit, name, ...rest] = line.split(/\s+/);
  const o = k => { const i = rest.indexOf('--' + k); return i >= 0 ? rest[i + 1] : undefined; };
  // --form melee | ranged only (common.cjs formProblem): any other value records the ranged form. Dummy and real lines alike.
  { const why = formProblem(o('form')); if (why) { results.push({ name, unit, mode: o('real') ? 'real' : 'dummy', ok: false, why: [why] }); continue; } }
  if (o('kill') && o('real')) { results.push({ name, unit, mode: 'real', ok: false, why: ['--kill is for dummies only'] }); continue; }
  // --pin-foe N: dummies only, exactly one dummy N hexes ahead (1-5); --hide-units 1: unit models not drawn (labelled).
  const pinWhy = o('pin-foe') === undefined ? [] : [
    ...(o('real') ? ['--pin-foe is for dummies only (a real combat moves the foes and they hit back)'] : []),
    ...(!/^[1-5]$/.test(o('pin-foe')) ? [`--pin-foe must be 1-5, got ${o('pin-foe')}`] : []),
    ...(o('nfoes') !== undefined && o('nfoes') !== '1' ? ['--pin-foe places its own dummies: drop --nfoes'] : []),
    ...(o('pin-foe2') !== undefined && !(/^[2-5]$/.test(o('pin-foe2')) && Number(o('pin-foe2')) > Number(o('pin-foe'))) ? [`--pin-foe2 must be above --pin-foe and at most 5, got ${o('pin-foe2')}`] : [])];
  if (o('pin-foe2') !== undefined && o('pin-foe') === undefined) { results.push({ name, unit, mode: 'dummy', ok: false, why: ['--pin-foe2 needs --pin-foe'] }); continue; }
  const hideWhy = o('hide-units') === undefined || o('hide-units') === '1' ? [] : [`--hide-units takes 1, got ${o('hide-units')}`];
  const modeTags = { ...(o('pin-foe') !== undefined ? { pinFoe: Number(o('pin-foe')) } : {}), ...(o('pin-foe2') !== undefined ? { pinFoe2: Number(o('pin-foe2')) } : {}), ...(o('hide-units') !== undefined ? { hideUnits: true } : {}) };
  if (pinWhy.length || hideWhy.length) { results.push({ name, unit, mode: o('real') ? 'real' : 'dummy', ok: false, why: [...pinWhy, ...hideWhy] }); continue; }
  const realOnly = ['from-start', 'lead-ms', 'cast-index', 'foe-offset', 'ally', 'ally-cell', 'foe-cell', 'foe2', 'foe2star', 'foe2-cell'];
  if (realOnly.some(k => o(k) !== undefined) && (script !== 'v-capture.cjs' || !o('real'))) { results.push({ name, unit, mode: 'dummy', ok: false, why: [`${realOnly.map(k => '--' + k).join(' / ')} are for v-capture.cjs --real only`] }); continue; }
  if (script !== 'v-capture.cjs' || !o('real')) { results.push({ name, unit, mode: 'dummy', ok: true, ...(o('kill') ? { kill: o('kill') } : {}), ...modeTags }); continue; }
  // The recorded window's length, as v-capture.cjs takes it: the last --times point, else --ms (default 3000).
  const ms = o('times') !== undefined ? Number(o('times').split(',').at(-1)) : Number(o('ms') ?? 3000);
  // --cast-index N / --from-start 1 / --lead-ms MS: the window choice (real-combat.ts leadTicksFor); default 500 ms before the first cast.
  const start = { fromStart: o('from-start') === '1', leadMs: o('lead-ms') !== undefined ? Number(o('lead-ms')) : null, castNumber: o('cast-index') !== undefined ? Number(o('cast-index')) : 1 };
  const startWhy = [
    ...(o('from-start') !== undefined && o('from-start') !== '1' ? [`--from-start takes 1, got ${o('from-start')}`] : []),
    ...(o('lead-ms') !== undefined && !(Number(o('lead-ms')) >= 0) ? [`--lead-ms must be ms >= 0, got ${o('lead-ms')}`] : []),
    ...(start.fromStart && start.leadMs !== null ? ['--from-start and --lead-ms: give one'] : []),
    ...(o('cast-index') !== undefined && !/^[1-9][0-9]*$/.test(o('cast-index')) ? [`--cast-index must be 1, 2, ..., got ${o('cast-index')}`] : []),
    // --foe-offset K: every foe K columns to the side; all must stay on the board (real-combat.ts foeOffsetProblem).
    ...(o('foe-offset') !== undefined ? [rc.foeOffsetProblem(/^-?[0-9]+$/.test(o('foe-offset')) ? Number(o('foe-offset')) : NaN, Number(o('nfoes') ?? 4))].filter(Boolean) : []),
    // --ally-cell / --foe-cell / --foe2-cell R,C: whole-number cells (the layout itself is checked by realUnits below).
    ...['ally-cell', 'foe-cell', 'foe2-cell'].filter(k => o(k) !== undefined && !rc.parseCell(o(k))).map(k => `--${k} must be R,C (row,column), got ${o(k)}`),
    ...(o('foe-cell') !== undefined && o('foe-offset') !== undefined ? ['--foe-cell and --foe-offset: give one'] : []),
    // Rule (11-13): a real recording's --times starts at 0, the window's first tick.
    ...(o('times') !== undefined && Number(o('times').split(',')[0]) !== 0 ? [`--times must start at 0 for --real, got ${o('times').split(',')[0]}`] : [])];
  if (startWhy.length) { results.push({ name, unit, mode: 'real', ok: false, why: startWhy }); continue; }
  const custom = start.fromStart || start.leadMs !== null || o('cast-index') !== undefined;
  const setup = { unit, star: Number(o('star') ?? 3), form: o('form') ?? null, foe: o('target') ?? 'garen', dist: Number(o('dist') ?? 3),
    nfoes: Number(o('nfoes') ?? 4), foestar: Number(o('foestar') ?? 1), ...(o('foe-offset') !== undefined && Number(o('foe-offset')) !== 0 ? { foeOffset: Number(o('foe-offset')) } : {}),
    ...(o('ally') !== undefined ? { ally: o('ally'), allystar: Number(o('allystar') ?? 2) } : {}),
    ...(o('ally-cell') !== undefined ? { allyCell: rc.parseCell(o('ally-cell')) } : {}), ...(o('foe-cell') !== undefined ? { foeCell: rc.parseCell(o('foe-cell')) } : {}),
    ...(o('foe2') !== undefined ? { foe2: o('foe2') } : {}), ...(o('foe2star') !== undefined ? { foe2star: Number(o('foe2star')) } : {}),
    ...(o('foe2-cell') !== undefined ? { foe2Cell: rc.parseCell(o('foe2-cell')) } : {}) };
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
  // --ally: how near it comes to the line from the caster to its foe (cell centres, hex widths) over the window: the cast's
  // first enemy target, else (a self-cast: Twitch) the first foe it attacks in the window, else `foe`. Under 0.5 its body
  // stands on the line (a beam or missile drawn through it): a warning, with where and when.
  let allyLine;
  if (setup.ally) {
    const isFoe = id => /^foe[0-9]*$/.test(id);
    const target = a.targets.find(isFoe) ?? events.slice(a.from, a.to + 1).flat().find(e => e.type === 'attack' && e.attackerId === 'me' && isFoe(e.targetId))?.targetId ?? 'foe';
    for (let t = a.from; t <= Math.min(a.to, cells.length - 1); t++) {
      const c = cells[t]; if (!c?.ally?.alive || !c[target] || !c.me) continue;
      const d = rc.lineClearance(c.me, c[target], c.ally);
      if (!allyLine || d < allyLine.min) allyLine = { to: target, min: d, tick: t, ally: [c.ally.row, c.ally.col], me: [c.me.row, c.me.col], target: [c[target].row, c[target].col] };
    }
    if (allyLine && allyLine.min < 0.5) warn.push(`ally on the line to ${target}: ${allyLine.min.toFixed(2)} hex off at tick ${allyLine.tick} (ally ${allyLine.ally}, me ${allyLine.me}, ${target} ${allyLine.target})`);
  }
  // Rule (11-13): t=0 is the window's start only (the replay was just reset; the units are stand-in pawns there).
  if (o('times') !== undefined && o('times').split(',').some(t => Number(t) === 0)) warn.push('t=0 is the window start (stand-in pawns), not a keyframe: keyframes.cjs skips it');
  // With an asked-for window the anchor cast may fall after it (fine when the attacks are the point): say so.
  if (custom && a.castTick > a.to) warn.push(`anchor cast (#${start.castNumber}) at tick ${a.castTick} is after the window (ticks ${a.from}-${a.to})`);
  results.push({ name, unit, mode: 'real', ok: !why.length, why, warn, castTick: a.castTick, window: [a.from, a.to], targets: a.targets, myCasts: a.myCasts, ...modeTags, ...(o('foe-offset') !== undefined ? { foeOffset: Number(o('foe-offset')) } : {}), ...(allyLine ? { allyLine: { ...allyLine, min: Number.isFinite(allyLine.min) ? +allyLine.min.toFixed(2) : null } } : {}), ...(custom ? { anchorCast: start.castNumber, windowStart: start.fromStart ? 'combat start' : `${start.leadMs ?? 500} ms before the anchor cast` } : {}) });
}
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.mode.padEnd(5)} ${r.name}${r.pinFoe ? ` pinned dummy ${r.pinFoe} hex${r.pinFoe2 ? ` + ${r.pinFoe2} in line` : ''}` : ''}${r.hideUnits ? ' units hidden' : ''}${r.castTick !== undefined ? ` cast@${r.castTick} window ${r.window.join('-')} targets ${r.targets.join(',')}` : ''}${r.allyLine ? ` ally line to ${r.allyLine.to} ${r.allyLine.min ?? 'clear'}` : ''}${r.why?.length ? ' | ' + r.why.join('; ') : ''}${r.warn?.length ? ' | WARN ' + r.warn.join('; ') : ''}`);
if (opt('out')) writeFileSync(resolve(opt('out')), JSON.stringify(results, null, 2));
process.exit(results.some(r => !r.ok) ? 1 : 0);
