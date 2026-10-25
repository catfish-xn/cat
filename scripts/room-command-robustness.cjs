#!/usr/bin/env node
'use strict';
// Offline validation QA. Local loopback only; no external service or production patches.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const ROOT = path.resolve(__dirname, '..');
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const invariant = (condition, code) => { if (!condition) throw new Error(code); };
const SERIALS = ['nextUnitSerial', 'nextItemSerial', 'nextConsumableSerial', 'nextMatchEventSeq'];
const PRIVATE = new Set(['shop', 'gold', 'xp', 'pendingChoice', 'rngState', 'choiceRngState', 'rewardRngState', 'sharedPool', 'seatMechanics', 'resourceProvenance', 'unclaimedOrbs', 'orbClaimReceipts', 'consumables']);
function noPrivate(value) {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) { invariant(!PRIVATE.has(key), `private-field:${key}`); noPrivate(child); }
}
function picker(seed) { let word = seed >>> 0; return list => { word = (Math.imul(word, 1664525) + 1013904223) >>> 0; return list[Math.floor(word / 4294967296 * list.length)]; }; }

function createRoom(api, seed) {
  const clock = new api.ManualClock();
  const seats = Array.from({ length: 8 }, (_, i) => ({ seatId: `s${i}`, name: `qa-${i}`, kind: i < 2 ? 'human' : 'bot' }));
  return { clock, room: new api.Room(seats, { ...api.ROOM_TIMING_DEFAULTS, roomId: 'robustness', seed, clock, resolver: new api.TwoSidedBattleResolver(), preparationMs: 1000, choiceMs: 500, settlementMs: 200, battleTailMs: 100 }) };
}
// Same current-state replacement seam as tests/server/anvil-room-helpers.ts:seedSeat.
// Synthetic starting resources cover item/tool branches without depending on randomly earned loot.
function seedAssets(room, api) {
  room.current = { ...room.state, seats: room.state.seats.map(seat => {
    let match = seat.match;
    for (const [fn, extra, tag] of [
      [api.grantMechanicGold, { amount: 100 }, 'gold'],
      [api.grantMechanicItem, { definitionId: 'sword' }, 'item'],
      [api.grantMechanicConsumable, { definitionId: 'magnetic-remover' }, 'tool'],
      [api.grantMechanicUnit, { definitionId: match.preparation.units.find(u => u.team === 'player').definitionId }, 'orb'],
    ]) { const grant = fn(match, { receiptId: `qa-${seat.seatId}-${tag}`, source: 'qa-fixture', ...extra }); invariant(grant.ok, `fixture-grant:${tag}`); match = grant.state; }
    const progress = api.readG23Progress(match);
    const { Gold: ignored, ...reward } = api.g23ConquerorReward(api.G23_CONQUEROR_CHESTS[8]);
    match = api.writeG23Progress(match, { ...progress, rewards: [...progress.rewards, { id: 'g23:conqueror:9', round: match.round, source: 'conqueror', tier: 9, reward }] });
    if (seat.seatId === 's1') {
      const opened = api.openMechanicChoice(match, { choiceId: 'qa-armory-s1', returnPhase: 'preparation', offers: ['free', 'paid'], payload: { kind: 'armory', source: 'qa-fixture', prices: { free: 0, paid: 3 }, timeoutOption: 'free' } });
      invariant(opened.ok, 'fixture-armory'); match = opened.state;
    }
    return { ...seat, seatRevision: seat.seatRevision + 1, match };
  }) };
}
function inspect(api, room, previous, seen) {
  invariant(room.state.fault === null, `room-fault:${room.state.fault?.kind}:${room.state.fault?.detail}`);
  const state = room.state;
  const orbIds = state.seats.flatMap(seat => (api.readLootView(seat.match).unclaimedOrbs ?? []).map(orb => orb.orbId));
  for (const seat of state.seats) {
    const match = seat.match, old = previous?.seats.find(s => s.seatId === seat.seatId)?.match;
    for (const key of ['gold', 'xp', ...SERIALS]) invariant(Number.isSafeInteger(match[key]) && match[key] >= 0, `negative-or-invalid:${key}`);
    for (const key of SERIALS) if (old) invariant(match[key] >= old[key], `serial-regressed:${key}`);
    for (const [kind, values] of [['unit', match.preparation.units.filter(u => u.team === 'player').map(u => u.id)], ['item', match.items.map(i => i.id)], ['tool', match.consumables.map(c => c.consumableId)]]) {
      invariant(new Set(values).size === values.length, `duplicate-${kind}-id`);
      const key = `${seat.seatId}/${kind}`, prior = seen.get(key) ?? { live: new Set(), retired: new Set() };
      for (const id of prior.live) if (!values.includes(id)) prior.retired.add(id);
      for (const id of values) invariant(!prior.retired.has(id), `reused-${kind}-id`);
      prior.live = new Set(values); seen.set(key, prior);
    }
    if (seat.kind !== 'human') continue;
    const view = api.toPlayerView(state, seat.seatId, room.clock.now());
    noPrivate(view);
    const publicText = JSON.stringify(view);
    for (const id of orbIds) invariant(!publicText.includes(JSON.stringify(id)), 'private-orb-id');
  }
  // Card pool counts are physical resources too.
  for (const count of Object.values(state.pool.available ?? {})) invariant(Number.isSafeInteger(count) && count >= 0, 'negative-pool');
}
function candidates(api, match) {
  const units = match.preparation.units.filter(u => u.team === 'player');
  const unit = units[0], choice = match.pendingChoice;
  const list = [{ type: 'shopLock', locked: !match.shop.locked, generation: match.shop.generation }, { type: 'reroll' }, { type: 'buyXp' }];
  match.shop.slots.forEach((s, slot) => { if (s.status === 'available') list.push({ type: 'buy', slot, generation: match.shop.generation }); });
  if (choice) {
    for (const definitionId of choice.offers) list.push({ type: 'choose', choiceId: choice.choiceId, generation: choice.generation, definitionId });
    if (choice.step === 'target' && unit) list.push({ type: 'anomalyTarget', choiceId: choice.choiceId, generation: choice.generation, unitId: unit.id });
  }
  for (const orb of api.readLootView(match).unclaimedOrbs ?? []) if (!orb.queued) list.push({ type: 'claimOrb', round: match.round, orbId: orb.orbId });
  if (unit) {
    list.push({ type: 'sell', unitId: unit.id }, { type: 'openAnvil', unitId: unit.id }, { type: 'deploy', unitId: unit.id, target: { kind: 'board', cell: { col: 0, row: match.preparation.board.deploymentZones.player.firstRow } } });
    for (const item of match.items.filter(i => i.location.kind === 'inventory')) list.push({ type: 'equip', itemId: item.id, unitId: unit.id, slot: 0 });
    for (const tool of match.consumables) list.push({ type: 'useConsumable', consumableId: tool.consumableId, target: { kind: 'unit', unitId: unit.id } });
  }
  return list;
}
function invalids(match, other) {
  return [
    { type: 'buy', slot: 0, generation: match.shop.generation + 99 }, { type: 'buy', slot: 999, generation: match.shop.generation },
    { type: 'sell', unitId: 'missing-unit' }, { type: 'sell', unitId: other.preparation.units.find(u => u.team === 'player' && !match.preparation.units.some(own => own.id === u.id))?.id ?? 'missing-foreign-unit' },
    { type: 'deploy', unitId: 'missing-unit', target: { kind: 'bench', slot: 99 } },
    { type: 'equip', itemId: 'missing-item', unitId: 'missing-unit', slot: 0 },
    { type: 'choose', choiceId: 'expired-choice', generation: 999, definitionId: 'missing-offer' },
    { type: 'openAnvil', unitId: 'missing-anvil' },
    { type: 'useConsumable', consumableId: 'missing-tool', target: { kind: 'unit', unitId: 'missing-unit' } },
    { type: 'claimOrb', round: match.round, orbId: 'missing-orb' },
  ];
}
const MALFORMED = [null, [], {}, { type: 'buy', slot: '0', generation: 0 }, { type: 'deploy', unitId: 'u', target: null },
  { type: 'equip', itemId: 'i', unitId: 'u', slot: -1 }, { type: 'shopLock', locked: 1, generation: 0 },
  { type: 'choose', choiceId: 'x', generation: 0, definitionId: [] }, { type: 'claimOrb', round: 1, orbId: {} },
  { type: 'useConsumable', consumableId: 'x', target: { kind: 'unit' } }, { type: 'reroll', seatId: 's1' }];
function execute(api, context, op, stats, seen) {
  const { room, clock } = context, before = room.state, bytes = JSON.stringify(before);
  let result;
  if (op.kind === 'timer') { invariant(clock.runNext(), 'no-timer'); stats.timers++; }
  else if (op.kind === 'raw') {
    const parsed = api.parseClientMessage(op.raw);
    invariant(!parsed.ok, 'malformed-accepted'); invariant(room.state === before && JSON.stringify(room.state) === bytes, 'parser-mutated-room'); stats.malformed++;
  } else {
    result = room.handle(op.seatId, op.command);
    const type = op.command.type;
    stats.attempts[type] = (stats.attempts[type] ?? 0) + 1;
    if (result.ok) {
      invariant(!op.reject, `invalid-accepted:${type}`);
      stats.accepted[type] = (stats.accepted[type] ?? 0) + 1;
      if (room.state !== before) invariant(room.state.roomRevision > before.roomRevision, 'accepted-without-revision');
    } else {
      stats.rejected[result.reason] = (stats.rejected[result.reason] ?? 0) + 1;
      invariant(room.state === before && JSON.stringify(room.state) === bytes, `rejection-mutated:${type}`);
      if (result.events) invariant(result.events.length === 0, 'rejection-events');
    }
  }
  inspect(api, room, before, seen);
  return { ok: result?.ok, reason: result?.reason, state: digest(room.state) };
}
function runRoom(api, seed, options = {}) {
  const context = options.factory ? options.factory(seed) : createRoom(api, seed);
  const { room } = context, stats = { timers: 0, malformed: 0, attempts: {}, accepted: {}, rejected: {} }, trace = [], seen = new Map();
  const hash = createHash('sha256'), pick = picker(seed ^ 0xface1234);
  let bots;
  try {
    room.start(); seedAssets(room, api);
    bots = new api.BotDriver(room, seed, { maxSteps: 1, stepMs: 300 });
    const apply = op => { trace.push(op); hash.update(JSON.stringify(execute(api, context, op, stats, seen))); };
    if (options.trace) for (const op of options.trace) apply(op);
    else {
      for (let turn = 0; turn < (options.maxTurns ?? 120) && room.state.phase !== 'ended'; turn++) {
        const seatId = pick(['s0', 's1']), match = room.state.seats.find(s => s.seatId === seatId).match;
        const other = room.state.seats.find(s => s.seatId !== seatId).match;
        const type = pick(['candidate', 'candidate', 'invalid', 'raw', 'repeat', 'unknown']);
        let command;
        if (type === 'raw') apply({ kind: 'raw', raw: JSON.stringify({ protocolVersion: api.NET_PROTOCOL_VERSION, commandId: turn + 1, type: 'command', roomId: room.state.roomId, round: room.state.round, seatRevision: 0, command: pick(MALFORMED) }) });
        else {
          command = type === 'invalid' ? pick(invalids(match, other)) : pick(candidates(api, match));
          apply({ kind: 'command', seatId: type === 'unknown' ? 'nonexistent-seat' : seatId, command, reject: type === 'invalid' || type === 'unknown' });
          if (type === 'repeat') apply({ kind: 'command', seatId, command });
        }
        if (turn % 3 === 2) apply({ kind: 'timer' });
      }
    }
    return { seed, stats, trace, hash: hash.digest('hex'), phase: room.state.phase, round: room.state.round, error: null };
  } catch (error) { return { seed, stats, trace, phase: room.state.phase, round: room.state.round, error: error.message, stack: error.stack }; }
  finally { bots?.dispose(); room.dispose(); }
}
// Exercise the actual envelope gate, not a duplicate of the server's revision/auth logic.
async function runEnvelope(api, seed) {
  const clock = new api.ManualClock();
  const server = await api.createGameServer({ port: 0, host: '127.0.0.1', seed, roomId: 'qa-envelope', clock,
    limits: { maxMessagesPerWindow: 10000 } });
  const clients = [], receipts = [];
  try {
    for (let index = 0; index < 2; index++) {
      const client = await api.TestClient.connect(`ws://127.0.0.1:${server.port}`); clients.push(client);
      invariant((await client.join(`qa-${index}`)).ok, 'envelope-join');
    }
    const [a, b] = clients;
    invariant((await a.start()).ok, 'envelope-start');
    for (const client of clients) { await client.waitFor(m => m.type === 'state'); await client.waitFor(m => m.type === 'view'); }
    const room = server.room, own = room.state.seats.find(s => s.seatId === a.seatId);
    const command = { type: 'shopLock', locked: true, generation: own.match.shop.generation };
    const negatives = [
      { overrides: { seatRevision: own.seatRevision + 1 }, reason: 'seat-revision-mismatch' },
      { overrides: { round: room.state.round + 1 }, reason: 'stale-round' },
      { overrides: { round: room.state.round - 1 }, reason: 'stale-round' },
      { overrides: { roomId: 'obsolete-room' }, reason: 'wrong-room' },
    ];
    const pick = picker(seed);
    while (negatives.length) {
      const selected = pick(negatives); negatives.splice(negatives.indexOf(selected), 1);
      const before = room.state, bytes = JSON.stringify(before), receipt = await a.command(command, selected.overrides);
      invariant(!receipt.ok && receipt.reason === selected.reason, `envelope-refusal:${selected.reason}`);
      invariant(room.state === before && JSON.stringify(room.state) === bytes, 'envelope-rejection-mutated'); receipts.push(receipt);
    }
    const before = room.state, from = a.inbox.length, spoofId = a.commandCounter++;
    a.sendRaw(JSON.stringify({ protocolVersion: api.NET_PROTOCOL_VERSION, commandId: spoofId, type: 'command', roomId: before.roomId,
      round: before.round, seatRevision: own.seatRevision, seatId: b.seatId, command }));
    const spoof = await a.waitFor(m => m.type === 'receipt' && m.commandId === spoofId, undefined, from);
    invariant(!spoof.ok && spoof.reason === 'invalid-message' && room.state === before, 'envelope-spoof'); receipts.push(spoof);
    const id = a.commandCounter, revision = own.seatRevision;
    const accepted = await a.command(command, { seatRevision: revision }, id);
    invariant(accepted.ok, 'envelope-valid-refused'); receipts.push(accepted);
    await a.waitFor(m => m.type === 'state' && m.seatRevision === revision + 1);
    const published = room.state, bytes = JSON.stringify(published);
    const replay = await a.command(command, { seatRevision: revision }, id);
    invariant(JSON.stringify(replay) === JSON.stringify(accepted), 'envelope-dedupe-receipt');
    invariant(room.state === published && JSON.stringify(room.state) === bytes, 'envelope-repeat-mutated'); receipts.push(replay);
    const conflict = await a.command({ ...command, locked: false }, { seatRevision: revision }, id);
    invariant(!conflict.ok && conflict.reason === 'commandId-conflict' && room.state === published, 'envelope-conflict'); receipts.push(conflict);
    const stale = await a.command({ ...command, locked: false }, { seatRevision: revision });
    invariant(!stale.ok && stale.reason === 'seat-revision-mismatch' && room.state === published && JSON.stringify(room.state) === bytes, 'envelope-old-revision'); receipts.push(stale);
    const fresh = await a.command({ ...command, locked: false }); invariant(fresh.ok, 'envelope-fresh-refused'); receipts.push(fresh);
    invariant(room.state.seats.find(s => s.seatId === b.seatId).match === before.seats.find(s => s.seatId === b.seatId).match, 'envelope-other-seat-mutated');
    const latest = room.state.seats.find(s => s.seatId === a.seatId);
    await a.waitFor(m => m.type === 'state' && m.seatRevision === latest.seatRevision);
    for (const client of clients) {
      const ownSeat = room.state.seats.find(s => s.seatId === client.seatId);
      invariant(JSON.stringify(client.state) === JSON.stringify(api.toSeatPrivateView(ownSeat.match, ownSeat.choiceDeadline)), 'envelope-private-owner');
    }
    for (const client of clients) noPrivate(client.view);
    return { hash: digest({ receipts, state: room.state }), checks: receipts.length, error: null };
  } catch (error) { return { error: error.message, receipts, stack: error.stack }; }
  finally { for (const client of clients) if (client.isOpen) await client.close(); await server.close(); }
}
// One-minimal trace under single-operation deletion, not just a shortened prefix.
function minimize(api, failed) {
  if (runRoom(api, failed.seed, { trace: failed.trace }).error !== failed.error) return null;
  let trace = failed.trace, granularity = 2;
  while (trace.length >= 2) {
    const size = Math.ceil(trace.length / granularity); let reduced = false;
    for (let start = 0; start < trace.length; start += size) {
      const candidate = trace.slice(0, start).concat(trace.slice(start + size));
      if (runRoom(api, failed.seed, { trace: candidate }).error === failed.error) { trace = candidate; granularity = Math.max(2, granularity - 1); reduced = true; break; }
    }
    if (!reduced) { if (granularity >= trace.length) break; granularity = Math.min(trace.length, granularity * 2); }
  }
  return trace;
}
async function bundle() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'room-robustness-'));
  const outfile = path.join(dir, 'api.cjs');
  await require('esbuild').build({ stdin: { contents: `export { createGameServer } from './src/server/net/server'; export { TestClient } from './src/server/net/test-client'; export { readLootView } from './src/simulation/loot-view'; export { readG23Progress, writeG23Progress } from './src/simulation/g2-3-state'; export { G23_CONQUEROR_CHESTS, g23ConquerorReward } from './src/simulation/content/g2-3-policy'; export { openMechanicChoice } from './src/simulation/seat-mechanics/choices'; export { grantMechanicGold, grantMechanicItem, grantMechanicConsumable, grantMechanicUnit } from './src/simulation/seat-mechanics/grants'; export { Room, ROOM_TIMING_DEFAULTS } from './src/server/room/room'; export { ManualClock } from './src/server/room/clock'; export { TwoSidedBattleResolver } from './src/server/room/two-sided-resolver'; export { BotDriver } from './src/server/room/bot-driver'; export { toPlayerView, toSeatPrivateView } from './src/server/room/projection'; export { parseClientMessage, NET_PROTOCOL_VERSION } from './src/server/net/messages';`, resolveDir: ROOT, loader: 'ts' }, outfile, bundle: true, platform: 'node', format: 'cjs', target: 'node22', logLevel: 'silent' });
  return { file: outfile, api: require(outfile), close: () => fs.rmSync(dir, { recursive: true, force: true }) };
}
async function main(argv) {
  if (argv.includes('--help')) {
    process.stdout.write('用法：node scripts/room-command-robustness.cjs [--rooms 500] [--seed 230025] [--workers 4] [-o /tmp/v23-room-command-robustness.md]\n本机离线 QA；每房间120次随机操作和两次重放，另验证真实本机服务器信封。\n');
    return;
  }
  const get = (key, fallback) => { const i = argv.indexOf(key); return i < 0 ? fallback : argv[i + 1]; };
  const rooms = Number(get('--rooms', 500)), seed = Number(get('--seed', 230025)), output = get('-o', '/tmp/v23-room-command-robustness.md');
  assert(Number.isSafeInteger(rooms) && rooms > 0 && Number.isSafeInteger(seed));
  const built = await bundle(), results = [], failures = new Map();
  try {
    const { Worker } = require('node:worker_threads');
    const workers = Number(get('--workers', 4));
    assert(Number.isSafeInteger(workers) && workers > 0 && workers <= 16);
    await Promise.all(Array.from({ length: Math.min(workers, rooms) }, (_, index) => new Promise((resolve, reject) => {
      const worker = new Worker(__filename, { workerData: { file: built.file, seeds: Array.from({ length: rooms }, (_, i) => seed + i).filter((_, i) => i % Math.min(workers, rooms) === index) } });
      worker.on('message', result => { results.push(result); if (results.length % 25 === 0) process.stderr.write(`[robustness] ${results.length}/${rooms}\n`); });
      worker.on('error', reject); worker.on('exit', code => code === 0 ? resolve() : reject(new Error(`worker exit ${code}`)));
    })));
    invariant(results.length === rooms, 'incomplete-worker-results');
    results.sort((a, b) => a.seed - b.seed);
    for (const result of results) if (result.error && !failures.has(result.error)) {
      process.stderr.write(`[failure] seed=${result.seed} ${result.error} (${result.trace.length} operations)\n`);
      failures.set(result.error, { ...result, minimal: result.error === 'nondeterministic' ? result.trace : minimize(built.api, result) });
    }

  } finally { built.close(); }
  const totals = { attempts: {}, accepted: {}, rejected: {}, malformed: 0, timers: 0, envelopeChecks: 0 };
  for (const result of results) {
    for (const key of ['attempts', 'accepted', 'rejected']) for (const [name, count] of Object.entries(result.stats[key])) totals[key][name] = (totals[key][name] ?? 0) + count;
    totals.malformed += result.stats.malformed; totals.timers += result.stats.timers; totals.envelopeChecks += result.envelope?.checks ?? 0;
  }
  const report = { rooms, seed, totals, results: results.map(({ trace, stack, ...summary }) => summary), failures: [...failures.values()], scope: 'Offline Room + real parser + BotDriver + TwoSidedBattleResolver; synthetic starting resources; bounded 120-turn sessions; each seed also checks the real local-loopback server envelope twice.' };
  fs.writeFileSync(output.replace(/\.md$/, '') + '.json', JSON.stringify(report, null, 2) + '\n');
  const evidence = (file, needle) => `${file}:${fs.readFileSync(path.join(ROOT, file), 'utf8').split('\n').findIndex(line => line.includes(needle)) + 1}`;
  const validation = evidence('scripts/room-command-robustness.cjs', 'function inspect(');
  const envelope = evidence('scripts/room-command-robustness.cjs', 'async function runEnvelope(');
  fs.writeFileSync(output, `【完成】离线采样 ${rooms} 房间，每房间以相同 seed 重跑；发现 ${failures.size} 类失败。证据：${validation}。\n【完成】真实本机服务器信封 ${totals.envelopeChecks} 项检查并再次重放，证据：${envelope}；命令分类计数和最小失败轨迹见同名 JSON。\n【未完成】${failures.size ? '产品缺陷仅记录，按任务不修改 src。' : '驱动未自动执行 Vitest，定向回归须单独运行。'}\n【需要我决定】无，沿用 docs/S13_RULES_GAP.md 的 P，2026-10-25 验收约定。\n【风险】合成资源及每房间 120 次随机操作不代表整局或外部网络全局验收。\n【下一步】运行 tests/server/v23-room-command-robustness.test.ts，汇总其测试结果。\n`);
  process.stdout.write(JSON.stringify({ rooms, failures: [...failures.keys()], output }) + '\n');
  if (failures.size) process.exitCode = 1;
  return report;
}
module.exports = { runEnvelope, runRoom, minimize, bundle, createRoom, seedAssets, MALFORMED };
const { isMainThread, workerData, parentPort } = require('node:worker_threads');
if (!isMainThread && workerData?.file) {
  const api = require(workerData.file);
  (async () => { for (const seed of workerData.seeds) {
    const result = runRoom(api, seed), replay = runRoom(api, seed);
    if (!result.error && (replay.error || replay.hash !== result.hash)) result.error = 'nondeterministic';
    const envelope = await runEnvelope(api, seed), envelopeReplay = await runEnvelope(api, seed);
    result.envelope = envelope;
    if (!result.error && envelope.error) result.error = envelope.error;
    if (!result.error && (envelopeReplay.error || envelopeReplay.hash !== envelope.hash)) result.error = 'envelope-nondeterministic';
    parentPort.postMessage(result);
  } })().catch(error => { console.error(error); process.exitCode = 1; });
} else if (require.main === module) main(process.argv.slice(2)).catch(error => { console.error(error); process.exitCode = 1; });
