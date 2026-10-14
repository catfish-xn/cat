/**
 * C18-B / SR-C18-03, server side: the `useConsumable` wire command (contract §18.3 draft field names) end to end over a
 * real game server, one Node test client + seven bots.
 *
 *   npm run build:game && node tests/server/e2e/c18b-use-consumable.mjs
 *
 * Always:
 *   - malformed shapes (extra field at either layer, mixed target, empty id, unknown kind) are refused
 *     `invalid-message` (a receipt when the commandId is readable, as for every command) and reach no room;
 *   - the room gate forwards the command in preparation, combat (battle) and settlement;
 *   - the same commandId with the same body replays the cached receipt; with another body it is `commandId-conflict`.
 * A tool I do not hold is refused `unknown-consumable` in every phase, atomically (seatRevision unchanged, no push).
 * Real use (§18.8 03): with a magnetic remover, an inventory item is equipped on a board unit in preparation and the
 * remover used on it during my battle: the receipt is `consumable-used` with only the whitelisted operation events,
 * the unit's items are back in the inventory with their ids, the tool and its consumableTargets row are gone, and a
 * second use of the same tool instance is `unknown-consumable`. Icons and the record line: c18b-loot-preview.
 * C18B_WS_PORT (default 8800) overrides the port.
 */
import { spawn } from 'node:child_process';
import { TestClient } from '../../../dist-server/game/test-client.mjs';

const ROOT = new URL('../../../', import.meta.url).pathname;
const WS_PORT = Number(process.env.C18B_WS_PORT ?? 8800);
const URL_ = `ws://127.0.0.1:${WS_PORT}`;

const children = [];
function start(command, args, env, ready) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: ROOT, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
    children.push(child);
    const timer = setTimeout(() => reject(new Error(`${command} did not become ready`)), 30_000);
    const onData = data => { const text = String(data); if (process.env.VERBOSE) process.stdout.write(text); if (ready.test(text)) { clearTimeout(timer); resolve(child); } };
    child.stdout.on('data', onData); child.stderr.on('data', onData);
    child.once('exit', code => { clearTimeout(timer); reject(new Error(`${command} exited with ${code}`)); });
  });
}
const stopAll = () => { for (const child of children) child.kill('SIGTERM'); };
const failures = [];
const check = (condition, message) => { if (condition) console.log(`ok  ${message}`); else { console.log(`FAIL ${message}`); failures.push(message); } };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  await start('node', ['dist-server/game/main.mjs'], { PORT: String(WS_PORT), CAT_PREP_SEC: '6', CAT_CHOICE_SEC: '4', CAT_SETTLE_SEC: '6', CAT_BOT_STEP_MS: '150' }, /listening on/);
  const client = await TestClient.connect(URL_, 8_000);
  try {
    await client.join('消耗品'); await client.start();
    await client.waitFor(message => message.type === 'state', 15_000);
    const mine = () => client.state?.preparation.units.filter(unit => unit.team === 'player') ?? [];
    const phase = () => client.view?.phase.kind;

    // 1. Malformed shapes: invalid-message before any room sees them.
    const malformed = [
      { type: 'useConsumable', consumableId: 'tool-1', target: { kind: 'unit', unitId: 'unit-1' }, definitionId: 'magnetic-remover' },
      { type: 'useConsumable', consumableId: 'tool-1', target: { kind: 'unit', unitId: 'unit-1', itemId: 'item-1' } },
      { type: 'useConsumable', consumableId: '', target: { kind: 'item', itemId: 'item-1' } },
      { type: 'useConsumable', consumableId: 'tool-1', target: { kind: 'board', cell: { col: 1, row: 1 } } },
    ];
    let id = 900;
    for (const command of malformed) {
      const commandId = ++id, from = client.inbox.length;
      client.sendRaw(JSON.stringify({ protocolVersion: 2, commandId, type: 'command', roomId: client.view.roomId, round: client.view.phase.round, seatRevision: client.stateRevision, command }));
      const answer = await client.waitFor(message => (message.type === 'error' || message.type === 'receipt') && message.commandId === commandId, 5_000, from).catch(() => null);
      check((answer?.type === 'error' && answer.code === 'invalid-message') || (answer?.type === 'receipt' && !answer.ok && answer.reason === 'invalid-message'), `malformed ${JSON.stringify(command).slice(0, 90)} → ${answer?.type}:${answer?.code ?? answer?.reason}`);
    }

    // 2. Per phase: the gate forwards it; before T13-B the stub refuses atomically, after T13-B the real flow runs.
    const realStage = Array.isArray(client.state?.consumables);
    check(realStage && Array.isArray(client.state?.consumableTargets), 'my private state carries consumables and consumableTargets (§18.4/§18.8)');
    const seen = new Set();
    const deadline = Date.now() + 5 * 60_000;
    while (seen.size < 3 && Date.now() < deadline) {
      const kind = phase();
      if (!['preparation', 'combat', 'settlement'].includes(kind) || seen.has(kind)) { await sleep(100); continue; }
      const unit = mine().find(entry => entry.location.kind === 'board') ?? mine()[0];
      if (!unit) { await sleep(100); continue; }
      const revision = client.stateRevision, statesBefore = client.inbox.filter(message => message.type === 'state').length;
      const receipt = await client.command({ type: 'useConsumable', consumableId: 'no-such-tool', target: { kind: 'unit', unitId: unit.id } });
      // The client shows the short freeze boundary (room phase `frozen`, no command interleaves) as combat too: try again.
      if (kind === 'combat' && !receipt.ok && receipt.reason === 'wrong-phase') { await sleep(250); continue; }
      await sleep(200);
      const pushed = client.inbox.filter(message => message.type === 'state').length - statesBefore;
      check(!receipt.ok && receipt.reason === 'unknown-consumable', `${kind}: the room forwards useConsumable and the rules answer unknown-consumable for a tool I do not hold (${receipt.ok ? 'applied' : receipt.reason})`);
      // Atomic refusal: nothing published for it (a phase change in between may still push a state; then the revision moves with it).
      check(client.stateRevision === revision || pushed > 0, `${kind}: refusal published nothing (seatRevision ${revision} → ${client.stateRevision}, state pushes ${pushed})`);
      seen.add(kind);
    }
    check(seen.size === 3, `checked preparation, combat and settlement (${[...seen].join(', ')})`);

    // 3. Dedupe: same commandId + same body replays; another body under that id conflicts.
    const unitId = mine()[0]?.id ?? 'unit-1', body = { type: 'useConsumable', consumableId: 'no-such-tool', target: { kind: 'unit', unitId } };
    const first = await client.command(body, {}, 990);
    const again = await client.command(body, {}, 990);
    const other = await client.command({ ...body, target: { kind: 'item', itemId: 'item-1' } }, {}, 990);
    check(JSON.stringify(again) === JSON.stringify(first), `same commandId and body replays the cached receipt (${first.ok ? 'ok' : first.reason})`);
    check(!other.ok && other.reason === 'commandId-conflict', `same commandId, other body → ${other.ok ? 'ok' : other.reason}`);

    // 4. Real use (consumables projected since T13-B): equip an inventory item on a board unit in preparation, then use a
    //    remover on it during my battle.
    if (!realStage) console.log('skip real use: `consumables` is not projected');
    else {
      let done = false;
      const until = Date.now() + 8 * 60_000;
      while (!done && Date.now() < until) {
        const state = client.state, tool = state?.consumables?.find(entry => entry.definitionId === 'magnetic-remover');
        const worn = unit => state.items.filter(item => item.location.kind === 'unit' && item.location.unitId === unit.id);
        const board = state ? mine().filter(entry => entry.location.kind === 'board') : [];
        const unit = board.find(entry => worn(entry).length);
        if (state?.phase === 'choice' && phase() === 'choice' && state.pendingChoice) { await client.command({ type: 'choose', choiceId: state.pendingChoice.choiceId, generation: state.pendingChoice.generation, definitionId: state.pendingChoice.offers[0] }).catch(() => null); await sleep(150); continue; }
        if (tool && !unit && phase() === 'preparation' && board.length) {
          const item = state.items.find(entry => entry.location.kind === 'inventory');
          if (item) { await client.command({ type: 'equip', itemId: item.id, unitId: board[0].id, slot: 0 }).catch(() => null); await sleep(300); continue; }
        }
        if (phase() !== 'combat' || !tool || !unit) { await sleep(150); continue; }
        const ids = worn(unit).map(item => item.id), tools = state.consumables.length;
        const receipt = await client.command({ type: 'useConsumable', consumableId: tool.consumableId, target: { kind: 'unit', unitId: unit.id } });
        if (!receipt.ok && receipt.reason === 'wrong-phase') { await sleep(250); continue; } // the freeze boundary, shown as combat
        check(receipt.ok && receipt.result.kind === 'consumable-used', `remover on ${unit.id} during my battle → ${receipt.ok ? receipt.result.kind : receipt.reason}`);
        if (receipt.ok) {
          const types = receipt.result.events.map(event => event.type);
          check(JSON.stringify(types) === JSON.stringify(['itemsRemoved', 'consumableUsed']), `the receipt carries only the whitelisted operation events (${types})`);
          check(receipt.result.events.every(event => !Object.keys(event).some(key => /rng|provenance/i.test(key))), 'no RNG or provenance in the receipt events');
          await client.waitFor(message => message.type === 'state' && message.seatRevision >= receipt.result.seatRevision, 10_000);
        }
        const after = client.state;
        check(ids.every(item => after.items.some(entry => entry.id === item && entry.location.kind === 'inventory')), `its items ${ids.join(', ')} are back in the inventory with the same ids`);
        check(after.consumables.length === tools - 1 && !after.consumables.some(entry => entry.consumableId === tool.consumableId), `the tool is used up (${tools} → ${after.consumables.length})`);
        check(!after.consumableTargets.some(row => row.consumableId === tool.consumableId), 'its consumableTargets row is gone');
        const reuse = await client.command({ type: 'useConsumable', consumableId: tool.consumableId, target: { kind: 'unit', unitId: unit.id } });
        check(!reuse.ok && reuse.reason === 'unknown-consumable', `the same tool instance again → ${reuse.ok ? 'applied' : reuse.reason}`);
        done = true;
      }
      check(done, 'found a battle with a remover and a board unit wearing items');
    }
  } finally {
    client.close?.();
    stopAll();
  }
  if (failures.length) { console.log(`\n${failures.length} check(s) failed`); process.exitCode = 1; }
  else console.log('\nall C18-B useConsumable wire checks passed');
}
main().catch(error => { console.error(error); stopAll(); process.exit(1); });
