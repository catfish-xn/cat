/* One-shot B9 version-switch golden migration (schema6/save2/replay2). Evidence recorder, never an oracle.
 *   node scripts/update-m8-b9-golden.cjs --capture <tmp-dir>          old = c109d4e tree, new = working tree
 *   node scripts/update-m8-b9-golden.cjs --audit <tmp-dir>            writes only into <tmp-dir>
 *   node scripts/update-m8-b9-golden.cjs --apply <tmp-dir> <audit-sha256>
 *   node scripts/update-m8-b9-golden.cjs --record <tmp-dir>           after apply: clean-tree reproduction -> docs/evidence
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
const SEQUENCE_PATHS = [/^\/combat\/nextEventSeq$/, /^\/combat\/neutralReceipts\/deaths\/\d+\/eventSeq$/, /^\/combat\/neutralReceipts\/controls\/\d+\/(appliedEventSeq|removedEventSeq)$/,
  /^\/m8\/loot\/earnedEvidence\/\d+\/death\/eventSeq$/];
/** companion reactions store [combatId, tick, eventSeq]; only the sequence may move. */
const EVENT_ID_PATHS = [/^\/combat\/companionState\/reactions\/\d+\/deathEventId$/];
const eventIdShift = (a, b) => { try { const x = JSON.parse(a), y = JSON.parse(b); return x.length === 3 && y.length === 3 && x[0] === y[0] && x[1] === y[1] && Number.isSafeInteger(x[2]) && Number.isSafeInteger(y[2]); } catch { return false; } };
function leafDifferences(a, b, at = '') {
  if (equal(a, b)) return [];
  if (a && b && typeof a === 'object' && typeof b === 'object' && Array.isArray(a) === Array.isArray(b))
    return [...new Set([...Object.keys(a), ...Object.keys(b)])].flatMap(key => leafDifferences(a[key], b[key], `${at}/${key}`));
  return [{ path: at, old: a ?? null, new: b ?? null }];
}
/** Settlement copies of the per-battle ledger length; each is checked against the actual ledger in the audit. */
const LENGTH_PATHS = [/^\/roundResults\/\d+\/combatEventCount$/];
function classify(diffs, where) {
  const classes = { version: 0, sequence: 0, ledgerLength: 0 };
  for (const d of diffs) {
    if (VERSION_PATHS.some(p => p.test(d.path))) classes.version++;
    else if (LENGTH_PATHS.some(p => p.test(d.path)) && Number.isSafeInteger(d.old) && Number.isSafeInteger(d.new)) classes.ledgerLength++;
    else if (SEQUENCE_PATHS.some(p => p.test(d.path)) && Number.isSafeInteger(d.old) && Number.isSafeInteger(d.new)) classes.sequence++;
    else if (EVENT_ID_PATHS.some(p => p.test(d.path)) && eventIdShift(d.old, d.new)) classes.sequence++;
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
    heals: c.filter(e => e.type === 'heal'),
    casts: c.filter(e => e.type === 'cast'),
    mana: c.filter(e => e.type === 'manaChanged'),
    aggregates: c.filter(e => e.type === 'damage').map(e => [e.tick, e.unitId, e.amount, e.absorbed, e.hpDamage]),
    counts: Object.fromEntries([...new Set(c.map(e => e.type))].sort().map(t => [t, c.filter(e => e.type === t).length])),
  };
}
function newFacts(events) {
  const c = events.filter(e => e.domain === 'combat');
  for (const e of c) assert(!['damage', 'shieldChanged'].includes(e.type), `legacy ${e.type} in replay2 ledger`);
  const byUnitTick = new Map();
  for (const e of c.filter(e => e.type === 'manaChanged')) { const key = JSON.stringify([e.tick, e.outcome.targetId]); byUnitTick.set(key, [...(byUnitTick.get(key) ?? []), e.outcome]); }
  const castAt = new Map(c.filter(e => e.type === 'cast').map(e => [JSON.stringify([e.tick, e.receipt.source.ownerId]), e.receipt]));
  const packets = c.filter(e => e.type === 'packetDamage').map(e => e.outcome);
  const totals = new Map();
  for (const [i, o] of packets.entries()) {
    const key = JSON.stringify([c.filter(e => e.type === 'packetDamage')[i].tick, o.context.targetId]);
    const row = totals.get(key) ?? [0, 0, 0]; row[0] += o.mitigated; row[1] += o.absorbed; row[2] += o.hpDamage; totals.set(key, row);
  }
  return {
    unchanged: c.filter(e => UNCHANGED.has(e.type)).map(bare),
    heals: c.filter(e => e.type === 'heal'),
    casts: c.filter(e => e.type === 'cast'),
    mana: byUnitTick, castAt,
    totals: Object.fromEntries(totals),
    counts: Object.fromEntries([...new Set(c.map(e => e.type))].sort().map(t => [t, c.filter(e => e.type === t).length])),
  };
}
const ENDS = new Set(['expired', 'cleansed', 'source-lost', 'death-cleanup', 'replaced', 'combat-end']), ACTIVITIES = new Set(['channel', 'redirect']);
const multiset = rows => rows.map(r => JSON.stringify(r)).sort();
/** The pre-switch projection wrote a combat-long status as expiring at MAX_COMBAT_TICKS + 1 (1201); the frozen
 * contribution writes expiresAtTick null with duration kind 'combat'. Any other null is unmapped. */
const frozenExpiry = x => x.expiresAtTick !== null ? x.expiresAtTick : x.application.duration.kind === 'combat' ? 1201 : 'unmapped-null-expiry';
/** Per-contribution status lifecycle. Old events carried one contribution (or its contributionKeys) each; replay2
 * groups by target and kind, with end events listing exactly the ended contributions. */
function statusFacts(events, replay2) {
  const c = events.filter(e => e.domain === 'combat' && e.type === 'statusChanged'), rows = [], active = new Set();
  for (const e of c) {
    const end = ENDS.has(e.reason);
    if (!replay2) {
      if (ACTIVITIES.has(e.status.kind)) continue;
      // The pre-switch ledger said 'applied' for every application; one for an already-active key was a refresh.
      for (const key of e.status.contributionKeys ?? [e.status.key]) {
        if (end) { active.delete(key); rows.push([e.tick, e.unitId, key, e.reason]); continue; }
        rows.push([e.tick, e.unitId, key, active.has(key) ? 'refresh' : 'start', e.status.startsAtTick, e.status.expiresAtTick]); active.add(key);
      }
      continue;
    }
    // N2-P2-4: each replay2 event names exactly the contributions it changed.
    for (const x of e.group.contributions) {
      if (end) { assert(active.delete(x.key), `ended contribution ${x.key} was active`); rows.push([e.tick, e.group.targetId, x.key, e.reason]); continue; }
      assert.equal(active.has(x.key), e.reason === 'refreshed', `${x.key}: 'refreshed' exactly when the contribution was already active`);
      rows.push([e.tick, e.group.targetId, x.key, e.reason === 'refreshed' ? 'refresh' : 'start', x.appliedAtTick, frozenExpiry(x)]); active.add(x.key);
    }
  }
  return multiset(rows);
}
/** Old channel/redirect statusChanged events embedded the frozen CombatActivity record; replay2 publishes it directly. */
function activityFacts(events, replay2) {
  return events.filter(e => e.domain === 'combat' && (replay2 ? e.type === 'activityChanged' : e.type === 'statusChanged' && ACTIVITIES.has(e.status.kind)))
    .map(e => {
      if (replay2) return { tick: e.tick, reason: e.reason, activity: e.activity };
      const reason = e.reason ?? 'applied', activity = e.status.activity;
      // Some pre-switch end events (death/combat cleanup) embedded the still-active snapshot; the frozen record is that
      // activity ended at this tick with this reason. Nothing else may differ.
      const ended = ENDS.has(reason) && activity.lifecycle === 'active' ? { ...activity, lifecycle: 'ended', endedAtTick: e.tick, endReason: reason } : activity;
      return { tick: e.tick, reason, activity: ended };
    });
}
/** Old shield events already embedded the frozen ShieldState (layer.m8State); replay2 publishes it as `layer`. */
function shieldFacts(events, replay2) {
  const rows = events.filter(e => e.domain === 'combat' && e.type === 'shieldLayerChanged').map(e => ({ tick: e.tick, layer: replay2 ? e.layer : e.layer.m8State, reason: replay2 ? e.reason : e.endReason ?? e.reason }));
  return rows;
}
const AUDITED_OLD = new Set([...UNCHANGED, 'packetDamage', 'damage', 'heal', 'cast', 'manaChanged', 'statusChanged', 'shieldLayerChanged', 'statChanged', 'maxHpChanged']);
const AUDITED_NEW = new Set([...UNCHANGED, 'packetDamage', 'heal', 'cast', 'manaChanged', 'statusChanged', 'activityChanged', 'shieldLayerChanged', 'statChanged', 'maxHpChanged']);
/** Plan §2: statChanged/maxHpChanged keep their values; source is the frozen Source (parentItemInstanceId null when absent)
 * and attackSpeedBps is published as attackSpeed (still Bps). */
const statFacts = (events, replay2) => events.filter(e => e.domain === 'combat' && ['statChanged', 'maxHpChanged'].includes(e.type)).map(({ eventSeq, domain, combatId, ...e }) =>
  replay2 ? e : { ...e, source: { ...e.source, parentItemInstanceId: e.source.parentItemInstanceId ?? null }, ...(e.stat === 'attackSpeedBps' ? { stat: 'attackSpeed' } : {}) });
const sourceOf = s => ({ ...s, parentItemInstanceId: s.parentItemInstanceId ?? null });
/** N2-P2-1: every pre-switch packet fact is bound to its replay2 DamageOutcome, including the full source (instance and
 * parent item), actionSeq, ordinal, a packetId derived from those facts, parent links, and raw under its legal mapping:
 * the old raw was rawAfterCritical (a redirect child carried its parent's), the frozen outcome.raw is the entry amount. */
function packetAudit(oldEvents, newEvents, where, combatId, multiplierOf) {
  const op = oldEvents.filter(e => e.domain === 'combat' && e.type === 'packetDamage'), np = newEvents.filter(e => e.domain === 'combat' && e.type === 'packetDamage');
  assert.equal(np.length, op.length, `${where}: packet count`);
  const byId = new Map();
  np.forEach((e, i) => { assert(!byId.has(e.outcome.context.packetId), `${where} packet ${i}: unique packetId`); byId.set(e.outcome.context.packetId, { e, old: op[i] }); });
  np.forEach((e, i) => {
    const old = op[i], o = e.outcome, c = o.context, at = `${where} packet ${i}`;
    assert.equal(e.tick, old.tick, `${at}: tick`);
    assert.deepEqual(c.source, sourceOf(old.source), `${at}: full source (instance, effect index, parent item)`);
    assert.deepEqual([c.targetId, c.damageType, c.actionSeq, c.packetOrdinal, c.redirected, o.mitigated, o.absorbed, o.hpDamage, o.critical],
      [old.unitId, old.damageType, old.actionSeq, old.packetOrdinal, old.redirected, old.mitigated, old.absorbed, old.hpDamage, old.critical], `${at}: target/type/actionSeq/ordinal/redirect/amounts/critical`);
    const parent = c.parentPacketId === null ? null : byId.get(c.parentPacketId);
    assert(c.parentPacketId === null || parent, `${at}: parent packet exists in this ledger`);
    const rawStage = () => assert.equal(old.raw, o.critical ? Number(BigInt(o.raw) * BigInt(multiplierOf(c.source.ownerId)) / 10000n) : o.raw, `${at}: old raw = rawAfterCritical of the frozen entry amount`);
    if (c.redirected) {
      // Loris share: same tick as its parent, packetId derived from the parent; old raw repeated the parent's rawAfterCritical.
      assert(parent.e.tick === e.tick && !parent.e.outcome.context.redirected && parent.e.outcome.context.source.ownerId === c.source.ownerId && parent.e.outcome.context.actionSeq === c.actionSeq, `${at}: redirect parent`);
      assert.equal(c.packetId, JSON.stringify([c.parentPacketId, 'redirect', c.targetId]), `${at}: redirect packetId`);
      assert.equal(old.raw, parent.old.raw, `${at}: old redirect raw was the parent's rawAfterCritical`);
      assert.equal(o.raw, o.mitigated + o.prevented, `${at}: inherited share enters after mitigation`);
      return;
    }
    assert.equal(c.packetId, JSON.stringify([combatId, e.tick, c.source.ownerId, c.actionSeq, c.targetId, c.packetOrdinal]), `${at}: packetId from its facts`);
    if (parent && parent.e.tick < e.tick && parent.e.outcome.killingPacket && parent.e.outcome.overkill === o.raw && parent.e.outcome.context.source.ownerId === c.source.ownerId && parent.e.outcome.context.actionSeq === c.actionSeq) {
      // Overkill bounce: the inherited amount is exactly the parent's overkill; old raw was that same inherited amount.
      assert.equal(old.raw, o.raw, `${at}: inherited raw unchanged`);
      assert.equal(o.raw, o.mitigated + o.prevented, `${at}: inherited amount enters after mitigation`);
      return;
    }
    // Raw-stage packets, including cone secondaries and mechanism-triggered damage whose parent is the triggering packet.
    if (parent) assert(parent.e.tick <= e.tick, `${at}: parent not in the future`);
    rawStage();
  });
  return np.length;
}
function ledgerAudit(oldEvents, newEvents, where, { combatId, multiplierOf }) {
  for (const e of oldEvents) if (e.domain === 'combat') assert(AUDITED_OLD.has(e.type), `${where}: unaudited pre-switch event ${e.type}`);
  for (const e of newEvents) if (e.domain === 'combat') assert(AUDITED_NEW.has(e.type), `${where}: unaudited replay2 event ${e.type}`);
  assert.deepEqual(statFacts(newEvents, true), statFacts(oldEvents, false), `${where}: every stat/maxHp change identical (attackSpeedBps -> attackSpeed)`);
  const a = oldFacts(oldEvents), b = newFacts(newEvents);
  assert.deepEqual(statusFacts(newEvents, true), statusFacts(oldEvents, false), `${where}: every status contribution starts and ends at the same tick with the same reason`);
  assert.deepEqual(activityFacts(newEvents, true), activityFacts(oldEvents, false), `${where}: every channel/redirect record (key, source, actionSeq, ticks, lifecycle) identical`);
  const os = shieldFacts(oldEvents, false), ns = shieldFacts(newEvents, true);
  assert.deepEqual(ns.map(r => [r.tick, r.layer]), os.map(r => [r.tick, r.layer]), `${where}: every shield layer state identical`);
  // Plan §2: the pre-switch endReason is merged into reason; every shield reason equals old endReason ?? reason.
  assert.deepEqual(ns.map(r => r.reason), os.map(r => r.reason), `${where}: shield reasons (endReason merged)`);
  assert.deepEqual(b.unchanged, a.unchanged, `${where}: eight unchanged event types identical apart from eventSeq`);
  packetAudit(oldEvents, newEvents, where, combatId, multiplierOf);
  // Old heal events already embedded the frozen HealOutcome; it must be identical and agree with the old summary fields.
  assert.equal(b.heals.length, a.heals.length, `${where}: heal count`);
  a.heals.forEach((old, i) => {
    const e = b.heals[i];
    assert.equal(e.tick, old.tick); assert.deepEqual(e.outcome, old.outcome, `${where} heal ${i}: HealOutcome identical`);
    assert.deepEqual([old.unitId, sourceOf(old.source), old.requested, old.actual, old.overheal], [e.outcome.targetId, e.outcome.shares[0].source, e.outcome.requested, e.outcome.actual, e.outcome.overheal], `${where} heal ${i}: summary`);
  });
  assert.equal(b.casts.length, a.casts.length, `${where}: cast count`);
  a.casts.forEach((old, i) => {
    const r = b.casts[i].receipt;
    assert.deepEqual([b.casts[i].tick, r.source.ownerId, r.source.definitionId, r.targetIds, r.actualManaSpent], [old.tick, old.sourceId, old.abilityId, old.targetIds, old.manaSpent], `${where} cast ${i}: caster/ability/targets/mana`);
  });
  // Old manaChanged was one aggregate per unit and tick; replay2 publishes the cast spend in cast.receipt and one
  // outcome per gain request. Every aggregate field must be reproduced exactly, and replay2 adds no unit/tick.
  const keys = new Set(a.mana.map(e => JSON.stringify([e.tick, e.unitId])));
  for (const key of b.mana.keys()) assert(keys.has(key), `${where}: replay2 mana outcome ${key} has a pre-switch aggregate`);
  for (const e of a.mana) {
    const key = JSON.stringify([e.tick, e.unitId]), outcomes = b.mana.get(key) ?? [], cast = b.castAt.get(key);
    // The aggregate reported requested gains before the cap; each outcome splits its request into applied/overflow/blocked.
    const sum = reason => outcomes.filter(o => o.reason === reason).reduce((n, o) => n + o.amount, 0);
    for (const o of outcomes) assert.equal(o.applied + o.overflow + (o.blocked ?? 0), o.amount, `${where}: outcome conserves its request`);
    assert.equal(e.hookGain, 0, `${where}: no legacy hook mana in shipped routes`);
    assert.deepEqual([cast?.actualManaSpent ?? 0, sum('attack'), sum('damage'), outcomes.reduce((n, o) => n + o.overflow, 0), outcomes.length ? outcomes.at(-1).after : e.before - e.spent,
      outcomes.length ? outcomes[0].before : e.before - e.spent], [e.spent, e.attackGain, e.damageGain, e.overflow, e.after, e.before - e.spent], `${where}: mana ${key}`);
    assert(outcomes.every(o => ['attack', 'damage'].includes(o.reason)), `${where}: only attack/damage mana in shipped routes`);
  }
  // The removed aggregate equals the sum of its tick's packets (it carried no independent fact).
  for (const [tick, unit, amount, absorbed, hpDamage] of a.aggregates) assert.deepEqual(b.totals[JSON.stringify([tick, unit])], [amount, absorbed, hpDamage], `${where}: aggregate ${unit}@${tick}`);
  return { oldCounts: a.counts, newCounts: b.counts };
}

// ---------- sequence references: every stored eventSeq must resolve to the same fact in its own ledger ----------
function ledgerOf(route, combatId) {
  const round = route.rounds.find(r => r.after.combat.combatId === combatId);
  assert(round, `ledger ${combatId}`); return round.events.filter(e => e.domain === 'combat');
}
const statusKeys = e => e.type !== 'statusChanged' ? [] : e.group ? e.group.contributions.map(c => c.key) : e.status ? [e.status.key] : [];
function references(route) {
  const facts = [];
  const death = (combatId, seq, tick, unitId) => { const e = ledgerOf(route, combatId)[seq]; assert(e && e.type === 'death' && e.tick === tick && (unitId === undefined || e.unitId === unitId), `death ref ${combatId}#${seq}`); facts.push(['death', combatId, bare(e)]); };
  for (const round of route.rounds) {
    const combat = round.after.combat, events = ledgerOf(route, combat.combatId);
    assert.equal(combat.nextEventSeq, events.length, `${combat.combatId} nextEventSeq`);
    for (const d of combat.neutralReceipts?.deaths ?? []) death(combat.combatId, d.eventSeq, d.tick, d.unitId);
    for (const c of combat.neutralReceipts?.controls ?? []) {
      const applied = events[c.appliedEventSeq];
      assert(applied && statusKeys(applied).includes(c.key), `control applied ref ${c.key}`);
      if (c.removedEventSeq !== null && c.removedEventSeq !== undefined) {
        const removed = events[c.removedEventSeq];
        assert(removed && removed.tick === c.removedAtTick && statusKeys(removed).includes(c.key), `control removed ref ${c.key}`);
      }
      facts.push(['control', combat.combatId, c.key, applied.tick, c.removedAtTick ?? null]);
    }
    for (const r of combat.companionState?.reactions ?? []) { const [combatId, tick, seq] = JSON.parse(r.deathEventId); death(combatId, seq, tick); }
  }
  for (const e of route.final.m8.loot.earnedEvidence ?? []) death(e.death.combatId, e.death.eventSeq, e.death.tick);
  return facts;
}

// ---------- audit ----------
function frozen(route) { return { versions: pick(route.initial, Object.keys(read(GOLDEN).routes.cannon.versions)), seed: route.initial.seed, commands: route.actions.map(a => a.command), rounds: route.rounds.map(r => pick(r, ['round', 'stateHash', 'eventsHash'])) }; }
async function audit(folder) {
  const { createServer } = await import('vite');
  const server = await createServer({ root: ROOT, configFile: false, server: { middlewareMode: true, ws: false }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom', logLevel: 'error' });
  try { return auditWith(folder, (await server.ssrLoadModule('/src/simulation/combat-s13-state.ts')).spellCrit); } finally { await server.close(); }
}
function auditWith(folder, spellCrit) {
  const done = read(path.join(folder, 'capture-complete.json'));
  for (const [file, digest] of Object.entries(done.files)) assert.equal(sha(fs.readFileSync(path.join(folder, file))), digest, `${file} unchanged since capture`);
  assert.equal(done.oldCommit, OLD_COMMIT);
  // Once applied, the archived pre-switch golden stays the baseline of this one migration (c109d4e -> replay2).
  const archived = fs.existsSync(ARCHIVE);
  const goldenBytes = fs.readFileSync(archived ? ARCHIVE : GOLDEN), golden = JSON.parse(goldenBytes), candidate = structuredClone(golden), report = { builds: {} };
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
    // combatEventCount is the ledger length, which replay2 changes by design; it must still equal each version's own ledger.
    const withoutCount = ledger => ({ ...ledger, rounds: ledger.rounds.map(({ combatEventCount, ...row }) => row) });
    assert.deepEqual(withoutCount(current.ledger), withoutCount(previous.ledger), `${build}: independent oracle resource ledger unchanged`);
    for (const route of [previous, current]) assert.equal(route.ledger.rounds.reduce((n, r) => n + (r.combatEventCount ?? 0), 0),
      route.rounds.reduce((n, r) => n + r.events.filter(e => e.domain === 'combat').length, 0), `${build}: combatEventCount equals the actual ledger`);
    const classes = { version: 0, sequence: 0, ledgerLength: 0 }, add = c => { for (const k of Object.keys(classes)) classes[k] += c[k]; };
    for (const route of [previous, current]) {
      const fought = route.final.roundResults.filter(r => r.result !== 'supply');
      assert.equal(fought.length, route.rounds.length);
      fought.forEach((r, i) => assert.equal(r.combatEventCount, route.rounds[i].events.filter(e => e.domain === 'combat').length, `${build}: settlement ledger length round ${r.round}`));
    }
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
      const settled = ({ combatEventCount, ...rest }) => rest; // ledger length checked against the actual ledger above
      assert.deepEqual(settled(round.result), settled(old.result), `${build} round ${round.round}: settlement`);
      const combatId = round.after.combat.combatId, units = round.after.combat.units;
      // The crit multiplier is the owner's spellCrit multiplier (combat-s13.ts damageSample); items do not change in combat.
      const multiplierOf = ownerId => spellCrit(units.find(u => u.id === ownerId)).multiplierBps;
      ledgers.push({ round: round.round, ...ledgerAudit(old.events, round.events, `${build} round ${round.round}`, { combatId, multiplierOf }) });
    }
    const oldRefs = references(previous), newRefs = references(current);
    assert.deepEqual(newRefs, oldRefs, `${build}: every stored event reference resolves to the same death/control fact`);
    candidate.routes[build] = frozen(current);
    report.builds[build] = { commands: current.actions.length, battles: current.rounds.length, stateDifferences: classes, resolvedReferences: newRefs.length, ledgers,
      outcome: current.summary.outcome, oldDigest: previous.initial.contentDigest, newDigest: current.initial.contentDigest };
  }
  candidate.note = `${golden.note ?? ''} B9 version switch (schema6/m8-14.24b-v1/s13-14.24b-m8-v1, save2/replay2) re-records hashes only: commands, settlements, resources and every ledger fact are unchanged (docs/evidence/m8-b9/golden/audit.json); the previous golden is archived as pre-m8-b9.`.trim();
  write(path.join(folder, 'candidate.json'), candidate);
  // A reproduction is a candidate byte-identical to the committed golden; only a reproduction may be recorded as evidence.
  const reproducing = archived && sha(fs.readFileSync(path.join(folder, 'candidate.json'))) === sha(fs.readFileSync(GOLDEN));
  const result = { reproducedCommittedGolden: reproducing, kind: 'm8-b9-version-switch-golden-v1', oldCommit: OLD_COMMIT, capture: done, previousGoldenSha256: sha(goldenBytes),
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
  assert.equal(sha(candidateBytes), result.candidateSha256);
  // The baseline is the archive once it exists (never overwritten); before that, the golden being replaced.
  if (fs.existsSync(ARCHIVE)) assert.equal(sha(fs.readFileSync(ARCHIVE)), result.previousGoldenSha256, 'archive is the audited baseline');
  else { assert.equal(sha(goldenBytes), result.previousGoldenSha256, 'golden changed after audit'); fs.writeFileSync(ARCHIVE, goldenBytes, { flag: 'wx' }); }
  fs.mkdirSync(EVIDENCE, { recursive: true });
  fs.copyFileSync(path.join(folder, 'audit.json'), path.join(EVIDENCE, 'audit.json'));
  fs.copyFileSync(path.join(folder, 'capture-complete.json'), path.join(EVIDENCE, 'capture-complete.json'));
  fs.writeFileSync(GOLDEN, candidateBytes);
  console.log(JSON.stringify({ applied: true, archive: path.relative(ROOT, ARCHIVE) }));
}
/** Copies a clean-tree reproduction into the committed evidence directory (audit, capture metadata, raw trajectories). */
function record(folder) {
  const result = read(path.join(folder, 'audit.json')), done = read(path.join(folder, 'capture-complete.json'));
  assert.equal(result.reproducedCommittedGolden, true, 'record only a reproduction of the committed golden');
  assert.equal(done.newDirty, false, 'record only a capture of a clean committed tree');
  assert.equal(result.updaterSha256, sha(fs.readFileSync(__filename)), 'updater changed after audit');
  fs.mkdirSync(EVIDENCE, { recursive: true });
  for (const file of ['audit.json', 'capture-complete.json', ...Object.keys(done.files)]) fs.copyFileSync(path.join(folder, file), path.join(EVIDENCE, file));
  console.log(JSON.stringify({ recorded: Object.keys(done.files).length + 2, newHead: done.newHead }));
}
module.exports = { leafDifferences, classify, oldFacts, newFacts, ledgerAudit, packetAudit, OLD_COMMIT };
if (require.main === module) {
  const [mode, a, b, c] = process.argv.slice(2);
  const run = mode === '--route' ? () => routeChild(a, b, c)
    : mode === '--capture' ? () => capture(path.resolve(a)) : mode === '--audit' ? () => audit(path.resolve(a)) : mode === '--apply' ? () => apply(path.resolve(a), b)
    : mode === '--record' ? () => record(path.resolve(a)) : () => assert.fail('Use --capture, --audit, --apply or --record');
  if (mode !== '--route') assert(path.resolve(a ?? '.').startsWith(os.tmpdir() + path.sep), 'staging must be under the system tmp directory');
  Promise.resolve().then(run).catch(error => { console.error(error); process.exitCode = 1; });
}
