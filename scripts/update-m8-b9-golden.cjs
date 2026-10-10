/* One-shot B9 version-switch golden migration (schema6/save2/replay2). Evidence recorder, never an oracle.
 *   node scripts/update-m8-b9-golden.cjs --capture <tmp-dir>          old = c109d4e tree, new = working tree
 *   node scripts/update-m8-b9-golden.cjs --audit <tmp-dir>            writes only into <tmp-dir>
 *   node scripts/update-m8-b9-golden.cjs --apply <tmp-dir> <audit-sha256>
 * The audit proves, per build, that the four normal-input command transcripts are identical, every committed
 * Match state is identical after removing only the version tuple / content digest / event-sequence fields,
 * and every replay2 ledger fact equals the corresponding pre-switch fact (M8_RULES §10). Golden hashes are
 * replaced only from a reviewed audit, and the exact previous golden is archived create-only. */
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), zlib = require('node:zlib');
const assert = require('node:assert/strict'), crypto = require('node:crypto'), { execFileSync, spawnSync } = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');
const { canonical, hash } = require('./m4-evidence.cjs');
const OLD_COMMIT = 'c109d4ebc24bb5de60c1adfa4cad2e5ca5e816fd';
const BUILDS = ['cannon', 'sniper', 'mage', 'sniper-caitlyn'];
const GOLDEN = path.join(ROOT, 'tests/fixtures/m5/full-match-golden.json');
const ARCHIVE = path.join(ROOT, 'tests/fixtures/m5/full-match-golden.pre-m8-b9.json');
const EVIDENCE = path.join(ROOT, 'docs/evidence/m8-b9/golden');
const OLD_VERSION = { schemaVersion: 5, rulesVersion: 'm5-14.24b-v1', contentVersion: 's13-14.24b-slice-v1', commandProtocolVersion: 2, rngAlgorithm: 'lcg32-v1', tickMs: 50 };
const NEW_VERSION = { schemaVersion: 6, rulesVersion: 'm8-14.24b-v1', contentVersion: 's13-14.24b-m8-v1', commandProtocolVersion: 2, rngAlgorithm: 'lcg32-v1', tickMs: 50 };
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file));
const write = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
const git = (...args) => execFileSync('git', args, { cwd: ROOT, maxBuffer: 256 * 1024 * 1024 });
const equal = (a, b) => canonical(a) === canonical(b);
const pick = (x, keys) => Object.fromEntries(keys.map(k => [k, x[k]]));
const loadRoute = (folder, kind, build) => JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(folder, `${kind}-${build}.json.gz`))));

// ---------- capture ----------
async function routeChild(root, build, out) {
  const { createServer } = await import('vite');
  const server = await createServer({ root, configFile: false, server: { middlewareMode: true, ws: false }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom', logLevel: 'error' });
  try {
    const api = await server.ssrLoadModule('/src/simulation/match.ts');
    const route = await require(path.join(root, 'scripts/generate-m5-route.cjs')).run(api, { build, seed: 42, retainStates: true });
    fs.writeFileSync(out, zlib.gzipSync(JSON.stringify(route)));
  } finally { await server.close(); }
}
function capture(folder) {
  fs.mkdirSync(folder, { recursive: true });
  assert(!fs.existsSync(path.join(folder, 'capture-complete.json')), 'capture directory must be fresh');
  const oldRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'b9-golden-old-'));
  execFileSync('tar', ['-x', '-C', oldRoot], { input: git('archive', OLD_COMMIT), maxBuffer: 256 * 1024 * 1024 });
  fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(oldRoot, 'node_modules'));
  const roots = { old: oldRoot, new: ROOT }, files = {};
  for (const kind of ['old', 'new']) for (const build of BUILDS) {
    const out = path.join(folder, `${kind}-${build}.json.gz`);
    const child = spawnSync(process.execPath, [__filename, '--route', roots[kind], build, out], { stdio: 'inherit', cwd: roots[kind] });
    assert.equal(child.status, 0, `${kind} ${build} route capture`);
    files[path.basename(out)] = sha(fs.readFileSync(out));
  }
  const dirty = execFileSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' }).trim();
  write(path.join(folder, 'capture-complete.json'), { oldCommit: OLD_COMMIT, newHead: git('rev-parse', 'HEAD').toString().trim(), newDirty: dirty !== '', node: process.version, files });
}

// ---------- normalization ----------
/** The only Match fields allowed to differ: the frozen version tuple, the recomputed digest and copies of it. */
const VERSION_PATHS = [/^\/(schemaVersion|rulesVersion|contentVersion|contentDigest)$/, /^\/combatInputBasis\/contentDigest$/];
/** Fields that carry an event sequence number; removing the aggregate `damage` event and splitting mana
 * per request shifts eventSeq values only. Listed explicitly, each verified to differ by eventSeq alone. */
const SEQUENCE_PATHS = [/^\/combat\/nextEventSeq$/, /^\/nextEventSeq$/, /\/eventSeq$/, /\/eventId$/, /\/neutralReceipts\/\d+\/(appliedEventSeq|removedEventSeq|eventSeq)$/];
function leafDifferences(a, b, at = '') {
  if (equal(a, b)) return [];
  if (a && b && typeof a === 'object' && typeof b === 'object' && Array.isArray(a) === Array.isArray(b))
    return [...new Set([...Object.keys(a), ...Object.keys(b)])].flatMap(key => leafDifferences(a[key], b[key], `${at}/${key}`));
  return [{ path: at, old: a ?? null, new: b ?? null }];
}
function classify(diffs, where) {
  const classes = { version: 0, sequence: 0 };
  for (const d of diffs) {
    if (VERSION_PATHS.some(p => p.test(d.path))) classes.version++;
    else if (SEQUENCE_PATHS.some(p => p.test(d.path)) && Number.isSafeInteger(d.old) && Number.isSafeInteger(d.new)) classes.sequence++;
    else throw new Error(`UNKNOWN state difference at ${where}: ${d.path} ${JSON.stringify(d.old).slice(0, 200)} -> ${JSON.stringify(d.new).slice(0, 200)}`);
  }
  return classes;
}

// ---------- ledger fact projections (old shapes from c109d4e, frozen replay2 shapes now) ----------
const UNCHANGED = new Set(['targetChanged', 'kill', 'growth', 'effectTriggered', 'movement', 'attack', 'death', 'combatFinished']);
const bare = ({ eventSeq, ...event }) => event;
const who = s => s && [s.ownerId, s.sourceKind, s.definitionId];
function oldFacts(events) {
  const c = events.filter(e => e.domain === 'combat');
  return {
    unchanged: c.filter(e => UNCHANGED.has(e.type)).map(bare),
    packets: c.filter(e => e.type === 'packetDamage').map(e => [e.tick, e.unitId, who(e.source), e.damageType, e.mitigated, e.absorbed, e.hpDamage, e.critical, e.redirected]),
    heals: c.filter(e => e.type === 'heal').map(e => [e.tick, e.unitId, who(e.source), e.amount ?? e.actual, e.overheal ?? 0]),
    casts: c.filter(e => e.type === 'cast').map(e => [e.tick, e.sourceId, e.targetIds, e.manaSpent]),
    manaAfter: c.filter(e => e.type === 'manaChanged').map(e => [e.tick, e.unitId, e.after]),
    aggregates: c.filter(e => e.type === 'damage').map(e => [e.tick, e.unitId, e.amount, e.absorbed, e.hpDamage]),
    counts: Object.fromEntries([...new Set(c.map(e => e.type))].sort().map(t => [t, c.filter(e => e.type === t).length])),
  };
}
function newFacts(events) {
  const c = events.filter(e => e.domain === 'combat');
  for (const e of c) assert(!['damage', 'shieldChanged'].includes(e.type), `legacy ${e.type} in replay2 ledger`);
  const mana = c.filter(e => e.type === 'manaChanged'), byUnitTick = new Map();
  for (const e of mana) byUnitTick.set(JSON.stringify([e.tick, e.outcome.targetId]), e.outcome.after);
  const packets = c.filter(e => e.type === 'packetDamage').map(e => e.outcome);
  const totals = new Map();
  for (const [i, o] of packets.entries()) {
    const key = JSON.stringify([c.filter(e => e.type === 'packetDamage')[i].tick, o.context.targetId]);
    const row = totals.get(key) ?? [0, 0, 0]; row[0] += o.mitigated; row[1] += o.absorbed; row[2] += o.hpDamage; totals.set(key, row);
  }
  return {
    unchanged: c.filter(e => UNCHANGED.has(e.type)).map(bare),
    packets: c.filter(e => e.type === 'packetDamage').map(e => { const o = e.outcome; return [e.tick, o.context.targetId, who(o.context.source), o.context.damageType, o.mitigated, o.absorbed, o.hpDamage, o.critical, o.context.redirected]; }),
    heals: c.filter(e => e.type === 'heal').map(e => [e.tick, e.outcome.targetId, who(e.outcome.shares[0].source), e.outcome.actual, e.outcome.overheal]),
    casts: c.filter(e => e.type === 'cast').map(e => [e.tick, e.receipt.source.ownerId, e.receipt.targetIds, e.receipt.actualManaSpent]),
    manaAfter: [...byUnitTick].map(([key, after]) => [...JSON.parse(key), after]),
    totals: Object.fromEntries(totals),
    counts: Object.fromEntries([...new Set(c.map(e => e.type))].sort().map(t => [t, c.filter(e => e.type === t).length])),
  };
}
function ledgerAudit(oldEvents, newEvents, where) {
  const a = oldFacts(oldEvents), b = newFacts(newEvents);
  assert.deepEqual(b.unchanged, a.unchanged, `${where}: eight unchanged event types identical apart from eventSeq`);
  assert.deepEqual(b.packets, a.packets, `${where}: every packet target/source/type/mitigated/absorbed/hpDamage/critical/redirect identical`);
  assert.deepEqual(b.heals, a.heals, `${where}: every heal target/source/actual/overheal identical`);
  assert.deepEqual(b.casts, a.casts, `${where}: every cast caster/targets/mana identical`);
  // Old manaChanged was one aggregate per unit and tick; its `after` equals the last replay2 outcome of that unit and tick.
  const lastNew = new Map(b.manaAfter.map(([tick, unit, after]) => [JSON.stringify([tick, unit]), after]));
  for (const [tick, unit, after] of a.manaAfter) assert.equal(lastNew.get(JSON.stringify([tick, unit])), after, `${where}: mana after ${unit}@${tick}`);
  // The removed aggregate equals the sum of its tick's packets (it carried no independent fact).
  for (const [tick, unit, amount, absorbed, hpDamage] of a.aggregates) assert.deepEqual(b.totals[JSON.stringify([tick, unit])], [amount, absorbed, hpDamage], `${where}: aggregate ${unit}@${tick}`);
  return { oldCounts: a.counts, newCounts: b.counts };
}

// ---------- audit ----------
function frozen(route) { return { versions: pick(route.initial, Object.keys(read(GOLDEN).routes.cannon.versions)), seed: route.initial.seed, commands: route.actions.map(a => a.command), rounds: route.rounds.map(r => pick(r, ['round', 'stateHash', 'eventsHash'])) }; }
function audit(folder) {
  const done = read(path.join(folder, 'capture-complete.json'));
  for (const [file, digest] of Object.entries(done.files)) assert.equal(sha(fs.readFileSync(path.join(folder, file))), digest, `${file} unchanged since capture`);
  assert.equal(done.oldCommit, OLD_COMMIT);
  const goldenBytes = fs.readFileSync(GOLDEN), golden = JSON.parse(goldenBytes), candidate = structuredClone(golden), report = { builds: {} };
  for (const build of BUILDS) {
    const previous = loadRoute(folder, 'old', build), current = loadRoute(folder, 'new', build);
    assert.deepEqual(frozen(previous), golden.routes[build], `${build}: old capture reproduces the exact current golden`);
    assert.deepEqual(pick(previous.initial, Object.keys(OLD_VERSION)), OLD_VERSION);
    assert.deepEqual(pick(current.initial, Object.keys(NEW_VERSION)), NEW_VERSION, `${build}: frozen M8 version tuple`);
    assert.match(current.initial.contentDigest, /^fnv1a32-utf16:[0-9a-f]{8}$/);
    assert.notEqual(current.initial.contentDigest, previous.initial.contentDigest, 'digest recomputed from versioned content');
    assert.deepEqual(current.actions.map(a => a.command), previous.actions.map(a => a.command), `${build}: identical command transcript`);
    assert.equal(current.final.phase, 'gameOver'); assert.deepEqual(current.summary.outcome, previous.summary.outcome);
    assert.deepEqual(pick(current.summary, ['round', 'outcome', 'caitlynBattles', 'caitlynCasts', 'boundBattles']), pick(previous.summary, ['round', 'outcome', 'caitlynBattles', 'caitlynCasts', 'boundBattles']), `${build}: route summary`);
    assert.deepEqual(current.ledger, previous.ledger, `${build}: independent oracle resource ledger unchanged`);
    const classes = { version: 0, sequence: 0 }, add = c => { classes.version += c.version; classes.sequence += c.sequence; };
    add(classify(leafDifferences(previous.initial, current.initial), `${build} initial`));
    add(classify(leafDifferences(previous.final, current.final), `${build} final`));
    for (const [i, action] of current.actions.entries()) {
      add(classify(leafDifferences(previous.actions[i].before, action.before), `${build} action ${i} before`));
      add(classify(leafDifferences(previous.actions[i].after, action.after), `${build} action ${i} after`));
      const oldMatch = previous.actions[i].events.filter(e => e.domain !== 'combat'), newMatch = action.events.filter(e => e.domain !== 'combat');
      assert.deepEqual(newMatch.map(bare), oldMatch.map(bare), `${build} action ${i}: match events identical apart from eventSeq`);
    }
    assert.equal(current.rounds.length, previous.rounds.length);
    const ledgers = [];
    for (const [i, round] of current.rounds.entries()) {
      const old = previous.rounds[i];
      assert.equal(round.round, old.round);
      add(classify(leafDifferences(old.after, round.after), `${build} round ${round.round} terminal`));
      assert.deepEqual(round.result, old.result, `${build} round ${round.round}: settlement`);
      ledgers.push({ round: round.round, ...ledgerAudit(old.events, round.events, `${build} round ${round.round}`) });
    }
    candidate.routes[build] = frozen(current);
    report.builds[build] = { commands: current.actions.length, battles: current.rounds.length, stateDifferences: classes, ledgers,
      outcome: current.summary.outcome, oldDigest: previous.initial.contentDigest, newDigest: current.initial.contentDigest };
  }
  candidate.note = `${golden.note ?? ''} B9 version switch (schema6/m8-14.24b-v1/s13-14.24b-m8-v1, save2/replay2) re-records hashes only: commands, settlements, resources and every ledger fact are unchanged (docs/evidence/m8-b9/golden/audit.json); the previous golden is archived as pre-m8-b9.`.trim();
  write(path.join(folder, 'candidate.json'), candidate);
  const result = { kind: 'm8-b9-version-switch-golden-v1', oldCommit: OLD_COMMIT, capture: done, previousGoldenSha256: sha(goldenBytes),
    candidateSha256: sha(fs.readFileSync(path.join(folder, 'candidate.json'))), updaterSha256: sha(fs.readFileSync(__filename)), report };
  write(path.join(folder, 'audit.json'), result);
  console.log(JSON.stringify({ audit: sha(fs.readFileSync(path.join(folder, 'audit.json'))), builds: Object.fromEntries(Object.entries(report.builds).map(([b, r]) => [b, r.stateDifferences])) }));
}
function apply(folder, reviewed) {
  assert.match(reviewed ?? '', /^[a-f0-9]{64}$/, 'exact reviewed audit SHA256 required');
  const auditBytes = fs.readFileSync(path.join(folder, 'audit.json'));
  assert.equal(sha(auditBytes), reviewed, 'unreviewed or changed audit');
  const result = JSON.parse(auditBytes), candidateBytes = fs.readFileSync(path.join(folder, 'candidate.json')), goldenBytes = fs.readFileSync(GOLDEN);
  assert.equal(result.updaterSha256, sha(fs.readFileSync(__filename)), 'updater changed after audit');
  assert.equal(sha(candidateBytes), result.candidateSha256); assert.equal(sha(goldenBytes), result.previousGoldenSha256, 'golden changed after audit');
  if (fs.existsSync(ARCHIVE)) assert.equal(sha(fs.readFileSync(ARCHIVE)), result.previousGoldenSha256, 'never overwrite archive');
  else fs.writeFileSync(ARCHIVE, goldenBytes, { flag: 'wx' });
  fs.mkdirSync(EVIDENCE, { recursive: true });
  fs.copyFileSync(path.join(folder, 'audit.json'), path.join(EVIDENCE, 'audit.json'));
  fs.copyFileSync(path.join(folder, 'capture-complete.json'), path.join(EVIDENCE, 'capture-complete.json'));
  fs.writeFileSync(GOLDEN, candidateBytes);
  console.log(JSON.stringify({ applied: true, archive: path.relative(ROOT, ARCHIVE) }));
}
module.exports = { leafDifferences, classify, oldFacts, newFacts, ledgerAudit, OLD_COMMIT };
if (require.main === module) {
  const [mode, a, b, c] = process.argv.slice(2);
  const run = mode === '--route' ? () => routeChild(a, b, c)
    : mode === '--capture' ? () => capture(path.resolve(a)) : mode === '--audit' ? () => audit(path.resolve(a)) : mode === '--apply' ? () => apply(path.resolve(a), b)
    : () => assert.fail('Use --capture, --audit or --apply');
  if (mode !== '--route') assert(path.resolve(a ?? '.').startsWith(os.tmpdir() + path.sep), 'staging must be under the system tmp directory');
  Promise.resolve().then(run).catch(error => { console.error(error); process.exitCode = 1; });
}
