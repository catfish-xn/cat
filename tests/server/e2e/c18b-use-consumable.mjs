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
 * second use of the same tool instance is `unknown-consumable`. P1: a later tool (any kind) is used for real during a
 * settlement on a target the server's consumableTargets allow, with the same receipt and inventory checks.
 * Icons and the record line: c18b-loot-preview.
 *
 * UI (P1, browser on its own server, run alongside): the tool card is dragged with the real mouse onto a unit token
 *   - combat: during my battle (replay playing) onto the board token of a unit wearing items;
 *   - settlement: onto a unit token (a bench unit when one wears a usable target, else a board unit);
 * an item tool (reforger) on a token is routed to an item that unit wears. Each drop sends exactly one useConsumable
 * with the target the server's consumableTargets allow, the receipt is `consumable-used`, the inventory and equipment
 * change at once (removed items back in the inventory with their ids / the reforged item replaced by a new inventory
 * item), the tool is gone and the status line keeps the success text ("已拆下" / "已重铸"), also in the settlement.
 * C18B_UI=0 skips it.
 *
 * C18B_WS_PORT (default 8800), C18B_UI_WS_PORT (8803) and C18B_UI_VITE_PORT (5209) override the ports.
 */
import { TestClient } from '../../../dist-server/game/test-client.mjs';
import { click, collectErrors, createChecks, joinOnline, launchBrowser, onlineUrl, outDir, read, sleep, startGameServer, startVite, stopAll, trackCommands } from './harness.mjs';

const WS_PORT = Number(process.env.C18B_WS_PORT ?? 8800);
const UI_WS_PORT = Number(process.env.C18B_UI_WS_PORT ?? 8803);
const UI_VITE_PORT = Number(process.env.C18B_UI_VITE_PORT ?? 5209);
const UI = process.env.C18B_UI !== '0';

const { check, failures, finish } = createChecks();

async function main() {
  const wsPort = await startGameServer(WS_PORT, { CAT_PREP_SEC: '6', CAT_CHOICE_SEC: '4', CAT_SETTLE_SEC: '6', CAT_BOT_STEP_MS: '150' });
  const client = await TestClient.connect(`ws://127.0.0.1:${wsPort}`, 8_000);
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
      // P8: a state pushed while sending makes the envelope stale (§18.3: refresh, resend), as step 4 already allows.
      if (!receipt.ok && ['seat-revision-mismatch', 'stale-round'].includes(receipt.reason)) { await sleep(250); continue; }
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
        // The freeze boundary shows as combat too; a state pushed while sending makes the envelope stale (§18.3: refresh, resend).
        if (!receipt.ok && ['wrong-phase', 'seat-revision-mismatch', 'stale-round'].includes(receipt.reason)) { await sleep(250); continue; }
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

      // 5. P1: a tool used for real during a settlement, on a target the server's consumableTargets allow.
      let settled = false;
      const settleUntil = Date.now() + 8 * 60_000;
      while (!settled && Date.now() < settleUntil) {
        const state = client.state;
        if (state?.phase === 'choice' && phase() === 'choice' && state.pendingChoice) { await client.command({ type: 'choose', choiceId: state.pendingChoice.choiceId, generation: state.pendingChoice.generation, definitionId: state.pendingChoice.offers[0] }).catch(() => null); await sleep(150); continue; }
        // Keep something worn on the board for a remover.
        if (phase() === 'preparation' && state && !state.items.some(item => item.location.kind === 'unit')) {
          const item = state.items.find(entry => entry.location.kind === 'inventory'), unit = mine().find(entry => entry.location.kind === 'board');
          if (item && unit) { await client.command({ type: 'equip', itemId: item.id, unitId: unit.id, slot: 0 }).catch(() => null); await sleep(300); continue; }
        }
        if (phase() !== 'settlement' || state?.phase !== 'settlement') { await sleep(150); continue; }
        const pick = state.consumableTargets.flatMap(row => row.targets.filter(entry => entry.allowed).map(entry => ({ row, entry })))[0];
        if (!pick) { await sleep(150); continue; }
        const tool = state.consumables.find(entry => entry.consumableId === pick.row.consumableId), tools = state.consumables.length;
        const receipt = await client.command({ type: 'useConsumable', consumableId: tool.consumableId, target: pick.entry.target });
        if (!receipt.ok && ['wrong-phase', 'seat-revision-mismatch', 'stale-round'].includes(receipt.reason)) { await sleep(250); continue; }
        check(receipt.ok && receipt.result.kind === 'consumable-used', `${tool.definitionId} on ${JSON.stringify(pick.entry.target)} during the settlement → ${receipt.ok ? receipt.result.kind : receipt.reason}`);
        if (receipt.ok) await client.waitFor(message => message.type === 'state' && message.seatRevision >= receipt.result.seatRevision, 10_000);
        const after = client.state, affected = pick.entry.affectedItemIds;
        if (tool.definitionId === 'magnetic-remover') check(affected.every(id => after.items.some(item => item.id === id && item.location.kind === 'inventory')), `settlement: removed items ${affected.join(', ')} are back in the inventory`);
        else check(affected.every(id => !after.items.some(item => item.id === id)) && after.items.length === state.items.length, `settlement: ${affected.join(', ')} reforged into a new item`);
        check(after.consumables.length === tools - 1, `settlement: the tool is used up (${tools} → ${after.consumables.length})`);
        settled = true;
      }
      check(settled, 'found a settlement with a usable tool');
    }
  } finally {
    client.close?.();
  }
}

/* ---------------- UI (P1): the tool dragged onto a unit token in combat and in the settlement ---------------- */

async function ui() {
  const OUT = outDir('c18b-use');
  const wsPort = await startGameServer(UI_WS_PORT, { CAT_PREP_SEC: '8', CAT_CHOICE_SEC: '5', CAT_SETTLE_SEC: '10', CAT_BOT_STEP_MS: '150' });
  const base = await startVite(UI_VITE_PORT);
  const browser = await launchBrowser();
  const errors = [];
  try {
    // Tall enough for the item bench, the equipment rows and the board together (see c16).
    const page = await (await browser.newContext({ viewport: { width: 1440, height: 2200 } })).newPage();
    collectErrors(page, errors, 'ui');
    const wire = trackCommands(page);
    await joinOnline(page, onlineUrl(base, wsPort), '工具');
    const status = () => page.evaluate(() => document.querySelector('.panel-status')?.textContent ?? '');
    const answered = new Set(), done = new Set(), misses = {};
    const worn = (state, unitId) => state.items.filter(item => item.location.kind === 'unit' && item.location.unitId === unitId)
      .sort((a, b) => a.location.slot - b.location.slot);
    /** What the server allows `tool` on for `unit`: its unit target (remover) or an item it wears (reforger), in slot order. */
    const allowedOn = (state, tool, unit) => {
      const targets = state.consumableTargets.find(row => row.consumableId === tool.consumableId)?.targets.filter(entry => entry.allowed) ?? [];
      const unitTarget = targets.find(entry => entry.target.kind === 'unit' && entry.target.unitId === unit.id);
      if (unitTarget) return unitTarget;
      return worn(state, unit.id).map(item => targets.find(entry => entry.target.kind === 'item' && entry.target.itemId === item.id)).find(Boolean) ?? null;
    };
    const deadline = Date.now() + 12 * 60_000;
    while (!(done.has('combat') && done.has('settlement')) && Date.now() < deadline) {
      const s = await read(page).catch(() => null);
      if (!s?.state) { await sleep(100); continue; }
      const kind = s.m6?.phase?.kind;
      if (kind === 'ended' || s.state.phase === 'gameOver') break;
      const choice = s.state.phase === 'choice' ? s.state.pendingChoice : null;
      if (choice && !answered.has(`${choice.choiceId}:${choice.generation}`)) { answered.add(`${choice.choiceId}:${choice.generation}`); await click(page, `choice:${choice.offers[0]}`); continue; }
      const mine = s.state.preparation.units.filter(unit => unit.team === 'player');
      if (kind === 'preparation') {
        // Keep an item on a board unit and, when there is one, on a bench unit (a click on the card, then on a slot: C16).
        for (const where of ['board', 'bench']) {
          const now = await read(page), units = now.state.preparation.units.filter(unit => unit.team === 'player' && unit.location.kind === where);
          if (!units.length || units.some(unit => worn(now.state, unit.id).length)) continue;
          const item = now.state.items.find(entry => entry.location.kind === 'inventory');
          await click(page, 'panel:items'); await sleep(100);
          const bounds = (await read(page)).strategy.bounds, card = item && bounds[`item:${item.id}`], slot = bounds[`equipment:${units[0].id}:0`];
          if (!card || !slot) continue;
          await page.mouse.click(card.centerX, card.centerY); await sleep(100);
          await page.mouse.click(slot.centerX, slot.centerY); await sleep(300);
        }
        await sleep(150); continue;
      }
      // P8: past the opening walk (the first 20 ticks move every token across the board) with ≥ 60 ticks (3 s) left for a retry.
      const branch = kind === 'combat' && s.state.phase === 'combat' && s.replay?.playingBack && (s.replay.tick ?? 0) >= 20 && (s.replay.terminalTick ?? 0) - (s.replay.tick ?? 0) >= 60 ? 'combat'
        : kind === 'settlement' && s.state.phase === 'settlement' ? 'settlement' : null;
      if (!branch || done.has(branch)) { await sleep(60); continue; }
      // Combat: a board unit that fights in the shown battle. Settlement: a bench unit first, else a board unit.
      const fighting = new Set(s.combatView?.units.map(unit => unit.id));
      const candidates = branch === 'combat' ? mine.filter(unit => unit.location.kind === 'board') : [...mine.filter(unit => unit.location.kind === 'bench'), ...mine.filter(unit => unit.location.kind === 'board')];
      const pick = s.state.consumables.flatMap(tool => candidates.map(unit => ({ tool, unit, target: allowedOn(s.state, tool, unit) })))
        .find(({ unit, target }) => target && s.tokens.some(token => token.owner === unit.id && token.visible && (branch !== 'combat' || fighting.has(token.id))));
      if (!pick) { await sleep(100); continue; }
      await click(page, 'panel:items'); await sleep(120);
      const now = await read(page), { tool, unit, target } = pick;
      const tokenOf = state => state.tokens.find(token => token.owner === unit.id && token.visible && (branch !== 'combat' || fighting.has(token.id)));
      const card = now.strategy.bounds[`consumable:${tool.consumableId}`], token = tokenOf(now);
      if (!card || !token) { await sleep(60); continue; }
      const before = wire.mark(), tools = now.state.consumables.length, items = now.state.items.length;
      await page.mouse.move(card.centerX, card.centerY); await page.mouse.down();
      await page.mouse.move(token.screenX, token.screenY, { steps: 8 });
      // A fighting token walks: aim again where it stands now right before letting go (as c17 does).
      for (let aim = 0; aim < 2; aim++) { const standing = tokenOf(await read(page)); if (standing) await page.mouse.move(standing.screenX, standing.screenY, { steps: 2 }); }
      const hover = await status();
      await page.mouse.up();
      const receipt = await wire.receiptSince(before, 'useConsumable', 5_000);
      await sleep(300);
      const after = await read(page), shown = await status(), commands = wire.commandsSince(before, 'useConsumable');
      // P8: the token steps to the next cell between the last aim and the release (diagnostics: where it is now). A
      // miss is a non-event, as for a player: no command left the page and nothing changed; drop again, at most 3 times.
      const beside = after.tokens.filter(entry => entry.owner === unit.id && entry.visible).map(entry => ({ id: entry.id, dx: Math.round(entry.screenX - token.screenX), dy: Math.round(entry.screenY - token.screenY) }));
      if (commands.length === 0 && receipt === null && (misses[branch] ?? 0) < 3) {
        misses[branch] = (misses[branch] ?? 0) + 1;
        check(after.state.consumables.length === tools && after.state.items.length === items && /未使用/.test(shown), `${branch}: missed drop ${misses[branch]} sent nothing and changed nothing (token moved ${JSON.stringify(beside)}); dropping again`);
        continue;
      }
      await page.screenshot({ path: `${OUT}/${branch}-drop.png` });
      const label = `${branch}: ${tool.definitionId} dragged onto ${unit.location.kind} token ${unit.id}`;
      console.log(JSON.stringify({ branch, tool: tool.definitionId, unit: unit.id, where: unit.location.kind, target: target.target, hover, shown, receipt, commands, beside, misses: misses[branch] ?? 0 }));
      check(commands.length === 1 && commands[0].consumableId === tool.consumableId && JSON.stringify(commands[0].target) === JSON.stringify(target.target), `${label}: one useConsumable for ${JSON.stringify(target.target)} (${JSON.stringify(commands)})`);
      check(receipt === 'consumable-used', `${label}: receipt consumable-used (${receipt}; hover "${hover}")`);
      if (tool.definitionId === 'magnetic-remover') check(target.affectedItemIds.every(id => after.state.items.some(item => item.id === id && item.location.kind === 'inventory')) && worn(after.state, unit.id).length === 0, `${label}: its items ${target.affectedItemIds.join(', ')} are back in the inventory at once`);
      else {
        const fresh = after.state.items.filter(item => !now.state.items.some(old => old.id === item.id));
        check(target.affectedItemIds.every(id => !after.state.items.some(item => item.id === id)) && after.state.items.length === items && fresh.length === 1 && fresh[0].location.kind === 'inventory', `${label}: ${target.affectedItemIds.join(', ')} reforged, the new item ${fresh.map(item => item.id)} is in the inventory at once`);
      }
      check(after.state.consumables.length === tools - 1, `${label}: the tool is used up (${tools} → ${after.state.consumables.length})`);
      check(/已拆下|已重铸/.test(shown), `${label}: the status keeps the success text ("${shown}")`);
      done.add(branch);
    }
    check(done.has('combat'), 'UI: found a battle with a tool usable on a fighting unit');
    check(done.has('settlement'), 'UI: found a settlement with a tool usable on a unit');
    check(errors.length === 0, `UI: no page errors (${errors.slice(0, 3).join(' | ')})`);
  } finally {
    await browser.close().catch(() => {});
  }
}

Promise.all([main(), UI ? ui() : null])
  .then(() => { stopAll(); finish('C18-B useConsumable wire + UI'); })
  .catch(error => { console.error(error); stopAll(); process.exit(1); });
