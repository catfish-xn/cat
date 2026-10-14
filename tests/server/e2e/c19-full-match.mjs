/**
 * Work order C19 item 1: a whole online match on the real game server (`?server=ws`), two humans (two browser
 * contexts, 甲 and 乙) + six bots, from 1-2 until the room publishes a unique ranking.
 *
 *   npm run build:game && node tests/server/e2e/c19-full-match.mjs
 *
 * The humans play like people (buy, deploy through the 部署 tab, put inventory items on board units, take the first offer
 * of every choice). Every check compares what the server projected to the page (my private state, the public view, the
 * receipts) with what the page shows; nothing here computes a rule. Along the way, once each unless noted:
 *   ops      during one of 甲's battles: buy, reroll and buy XP through the docked shop; each receipt is applied, the
 *            replay keeps playing, and the gold/level chips and the shop cards show the pushed state.
 *   T13-A    a component clicked onto an EMPTY slot of a board unit wearing one loose component (preparation): one equip,
 *            applied; afterwards the unit wears no loose component and the panel slot + token icons show what the
 *            projection says the unit wears.
 *   C18-A    an item put on a fighting unit during a battle: the panel slot is marked 下场生效, the token keeps its battle
 *            icons and lists the item as pending; in the next preparation the mark is gone and the icons show it.
 *   orbs     every PvE round, once its battle played out: one orb card per `revealedLoot.revealedOrbs` entry with the
 *            server's tier and status (both humans, all rounds); the tiers seen are reported, and the page's own presenter
 *            renders all four tiers (gray/blue/gold/prismatic) with their tier marks.
 *   .4       every supply pick: the dialog is the supply dialog with exactly the offered components; the picked one lands
 *            in my inventory.
 *   tools    a magnetic remover and a reforger (component or completed) each used once by whichever human holds one:
 *            one useConsumable to a target the server's consumableTargets allows, receipt consumable-used, and the
 *            inventory cards and the tool shelf show the pushed state.
 *   income   every settlement: the income receipt summary shows the round record's interest and XP.
 *   reload   乙 reloads the page in a PvE settlement once its orbs are shown: after the reconnect the same orb cards,
 *            inventory cards and tool shelf are back, equal to the projection.
 *   overtime the rooms' round names after 6-7 (加时 N) are shown in the sidebar while the match goes on.
 *   end      both pages show the ranking overlay: 8 entries, ranks 1..8 once each, in the order and with the names of the
 *            server's ranking.
 * A check the match did not offer the chance for (no tool dropped, no overtime) fails with the reason; C19_SEED picks
 * another room seed. Screenshots and report go to artifacts/c19/ (not committed). C19_VITE_PORT (5208) / C19_WS_PORT (8801).
 */
import { writeFileSync } from 'node:fs';
import { build } from 'esbuild';
import { ROOT, click, collectErrors, createChecks, joinOnline, launchBrowser, onlineUrl, outDir, read, startGameServer, startVite, stopAll, trackCommands, waitRead } from './harness.mjs';

const OUT = outDir('c19');
const VITE_PORT = Number(process.env.C19_VITE_PORT ?? 5208);
const WS_PORT = Number(process.env.C19_WS_PORT ?? 8801);
const SEED = process.env.C19_SEED ?? '20261012';
const NEXT_BATTLE = '下场生效';
const TIERS = ['gray', 'blue', 'gold', 'prismatic'];

const { check, failures, finish } = createChecks();
const mine = state => state.preparation.units.filter(unit => unit.team === 'player');
const inventory = state => state.items.filter(item => item.location.kind === 'inventory');
const wornBy = (state, unitId) => state.items.filter(item => item.location.kind === 'unit' && item.location.unitId === unitId);
const inBattle = s => s?.m6?.phase?.kind === 'combat' && s.state.phase === 'combat';
const inPreparation = s => s?.m6?.phase?.kind === 'preparation' && s.state.phase === 'preparation';
const settled = s => s?.state && s.state.roundResults.at(-1)?.round === s.state.round;
const cellKey = cell => `${cell.col},${cell.row}`;
const sorted = list => [...list].sort();
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** What the page shows, read from the DOM only. */
const screen = page => page.evaluate(() => {
  const all = selector => Array.from(document.querySelectorAll(selector));
  const chip = kind => document.querySelector(`.hud-${kind} strong`)?.textContent ?? null;
  return {
    gold: chip('gold'), level: chip('level'),
    shop: all('[data-debug^="mobile:buy-"]').map(node => ({ slot: Number(node.dataset.debug.slice('mobile:buy-'.length)), name: node.querySelector('.shop-name')?.textContent ?? '', cost: node.dataset.cost ?? null })),
    inventory: all('.item-inventory [data-item-id]').map(node => ({ id: node.dataset.itemId, definitionId: node.dataset.itemDef })),
    tools: all('[data-debug^="consumable:"]').map(node => ({ id: node.dataset.debug.slice('consumable:'.length), definitionId: node.dataset.consumableDef })),
    slots: all('[data-equip-unit]').map(node => ({ unit: node.dataset.equipUnit, slot: Number(node.dataset.equipSlot), itemId: node.dataset.itemId ?? null, definitionId: node.dataset.itemDef ?? null, pending: node.dataset.pending ?? null, text: node.textContent, title: node.title })),
    orbs: (() => {
      const panel = document.querySelector('[data-debug="orb-loot"]');
      if (!panel || panel.closest('[hidden]')) return null;
      return Array.from(panel.querySelectorAll('[data-debug^="orb:"]')).filter(card => card.dataset.debug !== 'orb:other').map(card => ({ orbId: card.dataset.debug.slice(4), tier: card.dataset.tier ?? null, status: card.dataset.status ?? null,
        entries: Array.from(card.querySelectorAll('.orb-entry')).map(entry => entry.dataset.debug.slice('orb-entry:'.length)) }));
    })(),
    receipt: document.querySelector('[data-debug="income-receipt"] summary')?.textContent ?? null,
    choice: (() => {
      const dialog = document.querySelector('.choice-dialog');
      if (!dialog || dialog.closest('[hidden]')) return null;
      return { source: dialog.dataset.choiceSource ?? null, title: dialog.querySelector('h2')?.textContent ?? '', offers: Array.from(dialog.querySelectorAll('[data-debug^="choice:"]')).map(node => node.dataset.debug.slice('choice:'.length)) };
    })(),
    round: document.querySelector('.online-round')?.textContent ?? null,
    countdown: document.querySelector('.countdown-round')?.textContent ?? null,
    ranking: (() => {
      const overlay = document.querySelector('#ranking-root');
      if (!overlay || overlay.hidden) return null;
      return Array.from(overlay.querySelectorAll('.ranking-entry')).map(entry => ({ rank: entry.querySelector('.ranking-rank')?.textContent ?? '', name: entry.querySelector('.ranking-name')?.textContent ?? '' }));
    })(),
  };
});
/** One card per revealed orb, in order, with the server's tier, status and revealed entries. */
const expectedOrbs = loot => loot.revealedOrbs.map(orb => ({ orbId: orb.orbId, tier: orb.tier, status: orb.status, entries: orb.entryDropIds.filter(id => loot.revealedDrops.some(drop => drop.dropId === id)) }));
const inventoryOf = state => sorted(inventory(state).map(item => `${item.id}:${item.definitionId}`));
const shownInventory = view => sorted(view.inventory.map(item => `${item.id}:${item.definitionId}`));
const toolsOf = state => sorted((state.consumables ?? []).map(tool => `${tool.consumableId}:${tool.definitionId}`));
const shownTools = view => sorted(view.tools.map(tool => `${tool.id}:${tool.definitionId}`));

/** Display names straight from the content tables the page uses (never re-implemented here). */
async function loadTables() {
  const outfile = `${OUT}/tables.mjs`;
  await build({
    stdin: { contents: "export { ITEM_DEFINITIONS } from './src/simulation/content/items.ts';\nexport { getHeroIdentity } from './src/presentation/hero-identity.ts';", resolveDir: ROOT, loader: 'ts' },
    bundle: true, format: 'esm', platform: 'node', outfile, logLevel: 'warning',
  });
  return import(`${outfile}?${Date.now()}`);
}

const report = { ops: null, autoCombine: null, pending: null, pendingNext: null, orbs: [], tiersSeen: [], tierPresenter: null, supply: [], tools: {}, income: [], reload: null, overtime: [], ranking: {}, rounds: {} };
/** Global once-only tasks; a human claims one synchronously before awaiting anything. */
const claimed = new Set();
const claim = task => { if (claimed.has(task)) return false; claimed.add(task); return true; };

async function main() {
  const tables = await loadTables();
  const kindOf = definitionId => tables.ITEM_DEFINITIONS[definitionId]?.kind;
  const wsPort = await startGameServer(WS_PORT, { CAT_SEED: SEED, CAT_PREP_SEC: '8', CAT_CHOICE_SEC: '6', CAT_SETTLE_SEC: '8', CAT_BOT_STEP_MS: '100', CAT_TAKEOVER_SEC: '600' });
  const base = await startVite(VITE_PORT);
  const browser = await launchBrowser();
  const errors = [];
  try {
    const open = async name => {
      // Tall enough for the item bench, the equipment rows and the board together (see c16).
      const context = await browser.newContext({ viewport: { width: 1440, height: 2200 } });
      const page = await context.newPage();
      collectErrors(page, errors, name);
      return { name, page, wire: trackCommands(page) };
    };
    const jia = await open('甲'), yi = await open('乙');
    await joinOnline(jia.page, onlineUrl(base, wsPort), '甲', { startMatch: false });
    await joinOnline(yi.page, onlineUrl(base, wsPort), '乙', { startMatch: false });
    await jia.page.click('[data-debug="online:start"]');
    for (const human of [jia, yi]) await waitRead(human.page, x => x.m6?.mode === 'active' && x.state?.phase === 'preparation', `${human.name}: match start`);
    await Promise.all([play(jia, tables, kindOf, { ops: true, reload: false }), play(yi, tables, kindOf, { ops: false, reload: true })]);

    /* ---------------- whole-match checks ---------------- */
    const seen = new Set(report.orbs.map(entry => entry.tiers).flat());
    report.tiersSeen = TIERS.filter(tier => seen.has(tier));
    check(report.orbs.length > 0 && report.orbs.every(entry => entry.ok), `orb cards equal revealedOrbs in all ${report.orbs.length} PvE settlements (${report.orbs.filter(entry => !entry.ok).map(entry => `${entry.human} ${entry.roundId}`).join(', ') || 'none differ'}); tiers seen live: ${report.tiersSeen.join('/') || 'none'}`);
    // All four tiers through the page's own presenter (one live match cannot be made to drop every tier).
    report.tierPresenter = await jia.page.evaluate(async tiers => {
      const { orbLootSection } = await import('/src/presentation/orb-loot.ts');
      const drop = (orb, payload) => ({ orbId: orb, entryOrdinal: 0, dropId: `${orb}:0`, encounterId: 'e', sourceUnitId: 's', roundId: '2-7', payload, status: 'granted', receiptId: 'r', allowedActions: [] });
      const loot = { roundId: '2-7', revealedDrops: tiers.map(tier => drop(tier, { kind: 'gold', quantity: 1 })),
        revealedOrbs: tiers.map(tier => ({ orbId: tier, tier, status: 'claimed', entryDropIds: [`${tier}:0`] })) };
      const section = orbLootSection(loot, { sourceName: () => '野怪' });
      return Array.from(section.querySelectorAll('[data-debug^="orb:"]')).map(card => ({ tier: card.dataset.tier, mark: card.querySelector('strong')?.textContent ?? '', className: card.className }));
    }, TIERS);
    check(same(report.tierPresenter.map(card => card.tier), TIERS) && new Set(report.tierPresenter.map(card => card.mark)).size === 4 && report.tierPresenter.every(card => card.mark && card.className.includes(`orb-${card.tier}`)),
      `the orb presenter renders all four tiers with distinct marks (${report.tierPresenter.map(card => `${card.tier}:${card.mark}`).join(' ')})`);
    check(report.supply.length > 0 && report.supply.every(entry => entry.ok), `every .4 supply dialog showed exactly the offered components and the pick landed in the inventory (${report.supply.map(entry => `${entry.human} ${entry.roundId}${entry.ok ? '' : ' ✗'}`).join(', ') || 'no supply pick'})`);
    check(report.income.length > 0 && report.income.every(entry => entry.ok), `every settlement receipt shows the record's interest and XP (${report.income.length} settlements${report.income.some(entry => !entry.ok) ? `; differ: ${JSON.stringify(report.income.filter(entry => !entry.ok).slice(0, 3))}` : ''})`);
    check(report.ops !== null, `in-battle buy/reroll/buyXp ran (${report.ops ? report.ops.roundId : 'no battle with gold, an offer and bench space'})`);
    check(report.autoCombine !== null, `T13-A auto-combine ran (${report.autoCombine ? report.autoCombine.roundId : 'never a component and a unit wearing one loose component'})`);
    check(report.pending !== null && report.pendingNext !== null, `C18-A next-battle equipment ran and was followed into the next preparation (${report.pending?.roundId ?? 'none'} → ${report.pendingNext?.roundId ?? 'none'})`);
    check(Boolean(report.tools.remover), `a magnetic remover was used (${report.tools.remover ? `${report.tools.remover.human} ${report.tools.remover.roundId}` : 'no human held a remover and a unit wearing items'})`);
    check(Boolean(report.tools.reforger), `a reforger was used (${report.tools.reforger ? `${report.tools.reforger.human} ${report.tools.reforger.roundId} ${report.tools.reforger.definitionId}` : 'no human held a reforger with an allowed target'})`);
    check(report.reload !== null, `乙 reloaded in a PvE settlement (${report.reload ? report.reload.roundId : 'never'})`);
    check(report.overtime.length > 0 && report.overtime.every(entry => entry.ok), `overtime after 6-7 was played and shown (${report.overtime.map(entry => `${entry.roundName}${entry.ok ? '' : ' ✗'}`).join(', ') || 'the match ended before overtime'})`);
    check(errors.length === 0, `no page errors (${errors.slice(0, 3).join(' | ')})`);
  } finally {
    writeFileSync(`${OUT}/report.json`, JSON.stringify({ ...report, failures }, null, 2));
    await browser.close().catch(() => {});
    stopAll();
  }
  finish('C19');
}

/** One human from the first preparation until the ranking. */
async function play(human, tables, kindOf, role) {
  const { name, page, wire } = human;
  const answered = new Set(), settlementsSeen = new Set(), orbsSeen = new Set(), overtimeSeen = new Set();
  let pending = null, lastPrep = 0;
  const started = Date.now();
  const deadline = Date.now() + 75 * 60_000;
  const act = async (control, type) => {
    const before = wire.mark();
    if (!(await click(page, control))) return 'disabled';
    return wire.receiptSince(before, type);
  };
  /** The state push after an applied receipt reaches the page (10 s), else null. */
  const pushed = async (predicate, timeout = 10_000) => {
    const until = Date.now() + timeout;
    for (;;) {
      const s = await read(page).catch(() => null);
      if (s?.state && predicate(s)) return s;
      if (Date.now() > until) return null;
      await page.waitForTimeout(50);
    }
  };
  const items = async () => { await click(page, 'panel:items'); await page.waitForTimeout(120); };

  for (;;) {
    if (Date.now() > deadline) throw new Error(`${name}: the match did not end within 75 minutes`);
    try { if (await step()) return; }
    catch (error) {
      // A reload (乙) or a push replacing the page state mid-step: read again. Anything else is a real failure.
      if (!/Execution context was destroyed|navigation|reading '(state|strategy|tokens)'/.test(String(error?.message))) throw error;
      console.log(`${name}: step retried (${String(error.message).split('\n')[0]})`);
      await page.waitForTimeout(200);
    }
  }

  /** One look at the page and at most one action; true once the ranking was checked. */
  async function step() {
    const s = await read(page).catch(() => null);
    if (!s?.state || !s.m6) { await page.waitForTimeout(100); return false; }
    const phase = s.m6.phase;
    if (report.rounds[name] !== phase?.roundName) {
      report.rounds[name] = phase?.roundName ?? null;
      if (name === '甲') console.log(`[${Math.round((Date.now() - started) / 1000)}s] ${phase?.roundName} hp ${s.m6.seats.map(seat => `${seat.name}:${seat.hp}`).join(' ')}`);
    }

    /* end: the ranking overlay equals the server's ranking */
    if (phase?.kind === 'ended') {
      const view = await pushed(x => x.m6.ranking !== null, 5_000) ?? s;
      await page.waitForTimeout(400);
      const shown = (await screen(page)).ranking;
      const ranking = view.m6.ranking ?? [];
      await page.screenshot({ path: `${OUT}/${name}-ranking.png` });
      report.ranking[name] = { server: ranking.map(seat => ({ seatId: seat.seatId, name: seat.name, rank: seat.rank })), shown };
      check(ranking.length === 8 && same(sorted(ranking.map(seat => seat.rank)), [1, 2, 3, 4, 5, 6, 7, 8]), `${name}: the server ranking has ranks 1..8 once each (${ranking.map(seat => `${seat.rank}:${seat.name}`).join(' ')})`);
      check(shown !== null && same(shown, ranking.map(seat => ({ rank: String(seat.rank), name: seat.name }))), `${name}: the ranking overlay shows that ranking in order (${JSON.stringify(shown)})`);
      return true;
    }

    /* overtime: the sidebar shows the room's round name */
    if (phase && /^加时 \d+$/.test(phase.roundName) && !overtimeSeen.has(phase.roundName)) {
      overtimeSeen.add(phase.roundName);
      const view = await screen(page);
      const ok = view.round === phase.roundName && Boolean(view.countdown?.includes(phase.roundName));
      report.overtime.push({ human: name, roundName: phase.roundName, shown: view.round, countdown: view.countdown, ok });
      if (overtimeSeen.size === 1) await page.screenshot({ path: `${OUT}/${name}-${phase.roundName}.png` });
    }

    const me = s.m6.seats.find(seat => seat.name === name);
    if (me && !me.alive) { await page.waitForTimeout(250); return false; } // spectating until the end

    /* choices: supply (.4) dialogs are checked, every other choice takes the first offer */
    const choice = s.state.phase === 'choice' ? s.state.pendingChoice : null;
    if (choice) {
      const key = `${choice.choiceId}:${choice.step}:${choice.generation}`;
      if (!answered.has(key)) {
        if (choice.step === 'target') { const unit = mine(s.state)[0]; if (unit && await click(page, `anomaly-target:${unit.id}`)) answered.add(key); }
        else if (choice.kind === 'component' && s.state.m8.round.kind === 'supply') {
          await page.waitForTimeout(150);
          const dialog = (await screen(page)).choice, pick = choice.offers[0], before = new Set(inventory(s.state).map(item => item.id));
          const receipt = await act(`choice:${pick}`, 'choose');
          if (receipt === 'disabled') { await page.waitForTimeout(100); return false; }
          answered.add(key);
          const after = await pushed(x => inventory(x.state).some(item => !before.has(item.id) && item.definitionId === pick));
          await items();
          const shown = after ? await screen(page) : null;
          const ok = dialog?.source === 'component' && dialog.title.startsWith('补给') && same(dialog.offers, choice.offers) && receipt === 'applied' && after !== null && same(shownInventory(shown), inventoryOf((await read(page)).state));
          report.supply.push({ human: name, roundId: s.state.roundDefinitionId, dialog, offers: choice.offers, pick, receipt, ok });
        } else if (await click(page, `choice:${choice.offers[0]}`)) answered.add(key);
        await page.waitForTimeout(100);
        return false;
      }
    }

    /* settlement: income receipt, orb cards, the reload */
    if (settled(s) && (s.state.phase === 'settlement' || s.state.phase === 'choice') && !s.replay?.playingBack) {
      const record = s.state.roundResults.at(-1);
      if (!settlementsSeen.has(record.round)) {
        settlementsSeen.add(record.round);
        await page.waitForTimeout(200);
        const view = await screen(page);
        const ok = view.receipt !== null && view.receipt.includes(`利息 ${record.incomeBreakdown.interest}`) && view.receipt.includes(`经验 +${record.xpAwarded}`) && view.receipt.includes(`+${record.income} 金币`);
        report.income.push({ human: name, roundId: record.roundId, shown: view.receipt, interest: record.incomeBreakdown.interest, xp: record.xpAwarded, income: record.income, ok });
      }
      const loot = s.state.revealedLoot;
      if (loot?.revealedOrbs?.length && !orbsSeen.has(loot.roundId)) {
        const view = await screen(page);
        if (view.orbs?.length) {
          orbsSeen.add(loot.roundId);
          const ok = same(view.orbs, expectedOrbs(loot));
          report.orbs.push({ human: name, roundId: loot.roundId, tiers: loot.revealedOrbs.map(orb => orb.tier), shown: view.orbs, ok });
          if (!ok) console.log(`${name} ${loot.roundId}: orb cards ${JSON.stringify(view.orbs)} vs ${JSON.stringify(expectedOrbs(loot))}`);
          // 乙 reloads once, right here: the same cards, inventory and tools must come back.
          if (role.reload && claim('reload') && s.state.phase === 'settlement') {
            await items();
            const before = await screen(page), state = (await read(page)).state;
            await page.screenshot({ path: `${OUT}/reload-before.png` });
            await page.reload();
            const back = await pushed(x => x.state.round === state.round && !x.replay?.playingBack && x.state.revealedLoot?.revealedOrbs?.length > 0, 25_000);
            if (back) await items();
            await page.waitForTimeout(300);
            const after = back ? await screen(page) : null, now = back ? (await read(page)).state : null;
            await page.screenshot({ path: `${OUT}/reload-after.png` });
            report.reload = { roundId: loot.roundId, phaseAfter: now?.phase ?? null, before: { orbs: before.orbs, inventory: shownInventory(before), tools: shownTools(before) },
              after: after && { orbs: after.orbs, inventory: shownInventory(after), tools: shownTools(after) } };
            check(back !== null, `乙 ${loot.roundId}: the page reconnected to the same round after the reload`);
            if (after) {
              check(same(after.orbs, before.orbs) && same(after.orbs, expectedOrbs(now.revealedLoot)), `乙 ${loot.roundId}: the same orb cards are back, equal to the projection (${after.orbs?.length ?? 0} cards)`);
              check(same(shownInventory(after), shownInventory(before)) && same(shownInventory(after), inventoryOf(now)), `乙 ${loot.roundId}: the same inventory cards are back, equal to the projection (${shownInventory(after).join(', ') || 'empty'})`);
              check(same(shownTools(after), shownTools(before)) && same(shownTools(after), toolsOf(now)), `乙 ${loot.roundId}: the same tool shelf is back, equal to the projection (${shownTools(after).join(', ') || 'empty'})`);
            }
            return false;
          }
        }
      }
    }

    /* C18-A follow-up: the first preparation after the pending equip */
    if (pending && pending.human === name && inPreparation(s) && s.state.round > pending.round && !report.pendingNext) {
      await items(); await page.waitForTimeout(150);
      const now = await read(page), view = await screen(page);
      const token = now.tokens.find(entry => entry.owner === pending.unitId && entry.visible);
      const worn = now.state.items.find(item => item.id === pending.itemId);
      report.pendingNext = { roundId: now.state.roundDefinitionId, worn: worn?.location ?? null, marks: view.slots.filter(slot => slot.pending), equipped: token?.equipped, pendingEquipped: token?.pendingEquipped };
      check(view.slots.every(slot => !slot.pending && !slot.text.includes(NEXT_BATTLE)), `C18-A ${now.state.roundDefinitionId}: no slot is marked ${NEXT_BATTLE} in the next preparation`);
      check(Boolean(worn && token && token.equipped.includes(worn.definitionId) && token.pendingEquipped.length === 0), `C18-A ${now.state.roundDefinitionId}: the token's icons now include ${worn?.definitionId} and nothing is pending (${token?.equipped} / ${token?.pendingEquipped})`);
      pending = null;
      return false;
    }

    /* tools: a remover on a unit wearing items, a reforger on an allowed item (any phase the server allows) */
    const tools = s.state.consumables ?? [];
    const toolTask = tools.map(tool => ({ tool, task: tool.definitionId === 'magnetic-remover' ? 'remover' : 'reforger' })).find(entry => !claimed.has(entry.task)
      && (s.state.consumableTargets ?? []).find(row => row.consumableId === entry.tool.consumableId)?.targets.some(target => target.allowed && (entry.task === 'reforger' || wornBy(s.state, target.target.unitId).length > 0)));
    if (toolTask && !s.replay?.playingBack && ['preparation', 'settlement'].includes(s.state.phase)) {
      await items();
      const now = await read(page);
      const tool = (now.state.consumables ?? []).find(entry => entry.consumableId === toolTask.tool.consumableId);
      const row = tool && now.state.consumableTargets.find(entry => entry.consumableId === tool.consumableId);
      const target = row?.targets.find(entry => entry.allowed && (toolTask.task === 'reforger' || wornBy(now.state, entry.target.unitId).length > 0)
        && now.strategy.bounds[entry.target.kind === 'unit' ? `equipment:${entry.target.unitId}:0` : itemBoundsKey(now.state, entry.target.itemId)]);
      const from = tool && now.strategy.bounds[`consumable:${tool.consumableId}`];
      if (target && from && claim(toolTask.task)) {
        const to = now.strategy.bounds[target.target.kind === 'unit' ? `equipment:${target.target.unitId}:0` : itemBoundsKey(now.state, target.target.itemId)];
        const affected = target.target.kind === 'unit' ? wornBy(now.state, target.target.unitId).map(item => item.id) : [target.target.itemId];
        const before = wire.mark();
        await page.mouse.move(from.centerX, from.centerY); await page.mouse.down();
        await page.mouse.move(to.centerX, to.centerY, { steps: 8 }); await page.waitForTimeout(60); await page.mouse.up();
        const receipt = await wire.receiptSince(before, 'useConsumable');
        const after = await pushed(x => !(x.state.consumables ?? []).some(entry => entry.consumableId === tool.consumableId));
        await page.waitForTimeout(200);
        const shown = await screen(page), state = (await read(page)).state;
        const commands = wire.commandsSince(before, 'useConsumable');
        report.tools[toolTask.task] = { human: name, roundId: now.state.roundDefinitionId, phase: now.state.phase, definitionId: tool.definitionId, target: target.target, affected, receipt, commands,
          inventory: shownInventory(shown), tools: shownTools(shown) };
        await page.screenshot({ path: `${OUT}/${toolTask.task}.png` });
        check(commands.length === 1 && same(commands[0].target, target.target) && commands[0].consumableId === tool.consumableId, `${name} ${tool.definitionId}: one useConsumable to an allowed target (${JSON.stringify(commands)})`);
        check(receipt === 'consumable-used' && after !== null, `${name} ${tool.definitionId}: receipt ${receipt}, state pushed`);
        check(same(shownInventory(shown), inventoryOf(state)) && same(shownTools(shown), toolsOf(state)), `${name} ${tool.definitionId}: inventory cards and tool shelf equal the projection (${shownInventory(shown).join(', ')} | ${shownTools(shown).join(', ') || 'no tools'})`);
        if (toolTask.task === 'remover') check(affected.every(id => state.items.some(item => item.id === id && item.location.kind === 'inventory')) && affected.every(id => shown.inventory.some(item => item.id === id)),
          `${name} remover: the unit's items ${affected.join(', ')} are back in the inventory, projected and shown`);
        else check(!state.items.some(item => item.id === target.target.itemId) && !shown.inventory.some(item => item.id === target.target.itemId), `${name} reforger: ${target.target.itemId} is gone from the projection and the cards`);
        return false;
      }
    }

    /* in-battle ops (甲, once): buy, reroll, buy XP during a battle */
    if (role.ops && !report.ops && inBattle(s) && s.replay?.playingBack && (s.replay.terminalTick ?? 0) >= 120 && (s.replay.tick ?? 0) < 40 && s.state.round >= 5) {
      const state = s.state;
      const slot = state.shop.slots.findIndex(offer => offer.status === 'available');
      const benchFree = mine(state).filter(unit => unit.location.kind === 'bench').length < state.preparation.benchSize;
      if (slot >= 0 && benchFree && state.gold >= 12 && claim('ops')) {
        const superseded = s.replay.superseded;
        const units0 = mine(state).length, gen0 = state.shop.generation, level0 = state.level * 1000 + state.xp;
        const buy = await act(`mobile:buy-${slot}`, 'buy');
        const afterBuy = await pushed(x => mine(x.state).length > units0);
        const reroll = await act('mobile:reroll', 'reroll');
        const afterReroll = await pushed(x => x.state.shop.generation > gen0);
        const xp = await act('mobile:buy-xp', 'buyXp');
        const afterXp = await pushed(x => x.state.level * 1000 + x.state.xp > level0);
        await page.waitForTimeout(200);
        const now = await read(page), view = await screen(page);
        const names = now.state.shop.slots.map(offer => offer.status === 'available' ? tables.getHeroIdentity(offer.definitionId).name : null);
        report.ops = { roundId: state.roundDefinitionId, receipts: { buy, reroll, xp }, gold: [state.gold, now.state.gold], shown: { gold: view.gold, level: view.level, shop: view.shop }, replay: now.replay };
        await page.screenshot({ path: `${OUT}/ops-${state.roundDefinitionId}.png` });
        check(buy === 'applied' && reroll === 'applied' && xp === 'applied' && afterBuy && afterReroll && afterXp, `ops ${state.roundDefinitionId}: buy/reroll/buyXp during the battle applied and pushed (${buy}, ${reroll}, ${xp})`);
        check(view.gold === String(now.state.gold) && view.level?.startsWith(String(now.state.level)), `ops ${state.roundDefinitionId}: the chips show the pushed gold ${now.state.gold} and level ${now.state.level} (${view.gold}, ${view.level})`);
        check(same(view.shop.map(card => card.slot), names.map((_, index) => index)) && view.shop.every(card => names[card.slot] === null ? !card.cost : card.name === names[card.slot]),
          `ops ${state.roundDefinitionId}: the shop cards show the pushed offers (${view.shop.map(card => card.name).join(' / ')})`);
        check(inBattle(now) && now.replay.superseded === superseded, `ops ${state.roundDefinitionId}: the battle replay keeps playing (tick ${now.replay.tick}/${now.replay.terminalTick})`);
        return false;
      }
    }

    /* C18-A: an item put on a fighting unit during the battle (甲 or 乙, once) */
    if (!pending && !claimed.has('pending') && inBattle(s) && s.replay?.playingBack && (s.replay.terminalTick ?? 0) >= 120 && (s.replay.tick ?? 0) < 40 && inventory(s.state).length) {
      await items();
      const now = await read(page), fighting = new Set(now.combatView?.units.map(unit => unit.id));
      const token = now.tokens.find(entry => entry.visible && fighting.has(entry.id) && entry.owner && mine(now.state).some(unit => unit.id === entry.owner && unit.location.kind === 'board'));
      const unitId = token?.owner;
      const empty = unitId === undefined ? undefined : [0, 1, 2].find(slot => !wornBy(now.state, unitId).some(item => item.location.slot === slot) && now.strategy.bounds[`equipment:${unitId}:${slot}`]);
      const item = inventory(now.state).find(entry => now.strategy.bounds[`item:${entry.id}`]);
      if (inBattle(now) && token && empty !== undefined && item && claim('pending')) {
        const iconsBefore = token.equipped, wornBefore = new Set(wornBy(now.state, unitId).map(entry => entry.id));
        const before = wire.mark();
        const card = now.strategy.bounds[`item:${item.id}`];
        await page.mouse.click(card.centerX, card.centerY); await page.waitForTimeout(100);
        const slotButton = (await read(page)).strategy.bounds[`equipment:${unitId}:${empty}`];
        await page.mouse.click(slotButton.centerX, slotButton.centerY);
        const receipt = await wire.receiptSince(before, 'equip');
        const after = await pushed(x => !inventory(x.state).some(entry => entry.id === item.id));
        await page.waitForTimeout(200);
        const latest = await read(page), view = await screen(page);
        const added = wornBy(latest.state, unitId).find(entry => !wornBefore.has(entry.id) || entry.definitionId !== now.state.items.find(old => old.id === entry.id)?.definitionId);
        const mark = added && view.slots.find(slot => slot.unit === unitId && slot.slot === added.location.slot);
        const tokenAfter = latest.tokens.find(entry => entry.owner === unitId && entry.visible);
        report.pending = { human: name, roundId: now.state.roundDefinitionId, unitId, item: item.id, receipt, added, mark, iconsBefore, iconsAfter: tokenAfter?.equipped, pendingEquipped: tokenAfter?.pendingEquipped };
        await page.screenshot({ path: `${OUT}/pending-${now.state.roundDefinitionId}.png` });
        check(receipt === 'applied' && after !== null && inBattle(latest), `C18-A ${now.state.roundDefinitionId}: ${item.id} put on ${unitId} during the battle (${receipt})`);
        check(Boolean(added && mark?.itemId === added.id && mark.pending === 'next-battle' && mark.text.includes(NEXT_BATTLE)), `C18-A: the panel slot holding the projected ${added?.definitionId} is marked ${NEXT_BATTLE} (${JSON.stringify(mark)})`);
        check(same(tokenAfter?.equipped, iconsBefore) && Boolean(added && tokenAfter?.pendingEquipped.includes(added.definitionId)), `C18-A: the token keeps its battle icons (${iconsBefore} → ${tokenAfter?.equipped}) and lists ${added?.definitionId} as pending (${tokenAfter?.pendingEquipped})`);
        if (receipt === 'applied' && added) pending = { human: name, round: now.state.round, unitId, itemId: added.id };
        return false;
      }
    }

    /* preparation: buy, deploy, equip (T13-A check on the first unit wearing one loose component) */
    if (inPreparation(s) && s.state.round !== lastPrep) {
      lastPrep = s.state.round;
      await prepare(page, act, pushed);
      await equipAll(human, tables, kindOf, act, pushed, items);
      return false;
    }
    await page.waitForTimeout(80);
    return false;
  }
}

/** The bounds key of an item: its inventory card, else the equipment slot that holds it. */
function itemBoundsKey(state, itemId) {
  const item = state.items.find(entry => entry.id === itemId);
  if (!item) return null;
  return item.location.kind === 'unit' ? `equipment:${item.location.unitId}:${item.location.slot}` : `item:${itemId}`;
}

/** Buy what keeps the board filled (and some XP with spare gold), then deploy bench units up to the level through 部署. */
async function prepare(page, act, pushed) {
  let state = (await read(page)).state;
  if (state.phase !== 'preparation') return;
  if (state.gold >= 24 && state.level < 8) { await act('mobile:buy-xp', 'buyXp'); state = (await read(page)).state; }
  const owned = new Set(mine(state).map(unit => unit.definitionId));
  for (let slot = 0; slot < state.shop.slots.length; slot++) {
    state = (await read(page)).state;
    if (state.phase !== 'preparation') return;
    const offer = state.shop.slots[slot], units = mine(state);
    if (offer?.status !== 'available' || units.filter(unit => unit.location.kind === 'bench').length >= state.preparation.benchSize - 1) continue;
    const wanted = owned.has(offer.definitionId) || units.filter(unit => unit.location.kind === 'board').length + units.filter(unit => unit.location.kind === 'bench').length < state.level + 1;
    if (wanted && state.gold >= 12) { const count = units.length; if (await act(`mobile:buy-${slot}`, 'buy') === 'applied') await pushed(x => mine(x.state).length !== count, 3_000); }
  }
  await click(page, 'panel:units');
  for (let i = 0; i < 9; i++) {
    state = (await read(page)).state;
    if (state.phase !== 'preparation') return;
    const units = mine(state), bench = units.filter(unit => unit.location.kind === 'bench');
    if (!bench.length || units.length - bench.length >= state.level) break;
    const taken = new Set(state.preparation.units.filter(unit => unit.location.kind === 'board').map(unit => cellKey(unit.location.cell)));
    const zone = state.preparation.board.deploymentZones.player;
    let cell = null;
    for (let row = zone.firstRow; row <= zone.lastRow && !cell; row++) for (let col = 0; col < state.preparation.board.columns && !cell; col++) if (!taken.has(`${col},${row}`)) cell = `${col},${row}`;
    if (!cell) break;
    const placed = units.length - bench.length;
    await click(page, `mobile:unit:${bench[0].id}`); await click(page, `deploy:${cell}`);
    await pushed(x => mine(x.state).filter(unit => unit.location.kind === 'board').length > placed, 3_000);
  }
}

/**
 * Puts inventory items on board units by clicking the card, then a slot (the C16 path). A component goes first to a unit
 * wearing one loose component, clicked on an EMPTY slot: the first time this is the T13-A check.
 */
async function equipAll(human, tables, kindOf, act, pushed, items) {
  const { name, page, wire } = human;
  await items();
  for (let guard = 0; guard < 6; guard++) {
    const now = await read(page);
    if (!inPreparation(now)) return;
    const board = mine(now.state).filter(unit => unit.location.kind === 'board');
    const loose = unit => wornBy(now.state, unit.id).filter(item => kindOf(item.definitionId) === 'component');
    const emptySlot = unit => [0, 1, 2].find(slot => !wornBy(now.state, unit.id).some(item => item.location.slot === slot) && now.strategy.bounds[`equipment:${unit.id}:${slot}`]);
    const candidates = inventory(now.state).filter(entry => now.strategy.bounds[`item:${entry.id}`] && ['component', 'completed'].includes(kindOf(entry.definitionId)));
    // Once T13-A ran, one item stays in the inventory until the C18-A check has put one on a fighting unit.
    if (!candidates.length || (report.autoCombine && !claimed.has('pending') && inventory(now.state).length <= 1)) return;
    const combining = board.some(entry => loose(entry).length === 1 && emptySlot(entry) !== undefined);
    const item = (combining && candidates.find(entry => kindOf(entry.definitionId) === 'component')) || candidates[0];
    const component = kindOf(item.definitionId) === 'component';
    const unit = (component ? board.find(entry => loose(entry).length === 1 && emptySlot(entry) !== undefined) : undefined) ?? board.find(entry => wornBy(now.state, entry.id).length === 0 && emptySlot(entry) !== undefined)
      ?? board.find(entry => !loose(entry).length && emptySlot(entry) !== undefined);
    if (!unit) return;
    const slot = emptySlot(unit), autoCombine = component && loose(unit).length === 1 && !report.autoCombine;
    const looseBefore = loose(unit)[0];
    const before = wire.mark();
    const card = now.strategy.bounds[`item:${item.id}`];
    await page.mouse.click(card.centerX, card.centerY); await page.waitForTimeout(100);
    const target = (await read(page)).strategy.bounds[`equipment:${unit.id}:${slot}`];
    if (!target) return;
    await page.mouse.click(target.centerX, target.centerY);
    const receipt = await wire.receiptSince(before, 'equip');
    const after = await pushed(x => !inventory(x.state).some(entry => entry.id === item.id), 3_000);
    if (receipt !== 'applied' || !after) return;
    if (autoCombine && claim('autoCombine')) {
      await page.waitForTimeout(200);
      const latest = await read(page), view = await screen(page);
      const worn = wornBy(latest.state, unit.id).sort((a, b) => a.location.slot - b.location.slot);
      const token = latest.tokens.find(entry => entry.owner === unit.id && entry.visible);
      const shownSlots = view.slots.filter(entry => entry.unit === unit.id && entry.itemId).map(entry => `${entry.slot}:${entry.definitionId}`);
      report.autoCombine = { human: name, roundId: latest.state.roundDefinitionId, unitId: unit.id, clickedSlot: slot, component: item.definitionId, loose: looseBefore && `${looseBefore.location.slot}:${looseBefore.definitionId}`,
        commands: wire.commandsSince(before, 'equip'), worn: worn.map(entry => `${entry.location.slot}:${entry.definitionId}`), shownSlots, icons: token?.equipped };
      await page.screenshot({ path: `${OUT}/auto-combine-${latest.state.roundDefinitionId}.png` });
      const combined = worn.find(entry => entry.location.slot === looseBefore.location.slot);
      check(wire.commandsSince(before, 'equip').length === 1, `T13-A ${latest.state.roundDefinitionId}: one equip for ${item.definitionId} on empty slot ${slot} of ${unit.id} (${JSON.stringify(report.autoCombine.commands)})`);
      check(worn.filter(entry => kindOf(entry.definitionId) === 'component').length === 0 && combined && kindOf(combined.definitionId) === 'completed',
        `T13-A: the projection shows ${unit.id} wearing no loose component; slot ${looseBefore.location.slot} holds ${combined?.definitionId} (${report.autoCombine.worn.join(', ')})`);
      check(same(sorted(shownSlots), sorted(report.autoCombine.worn)), `T13-A: the panel slots show the projected loadout (${shownSlots.join(', ')})`);
      check(same(sorted(token?.equipped ?? []), sorted(worn.map(entry => entry.definitionId))), `T13-A: the token's icons show the projected loadout (${token?.equipped})`);
    }
  }
}

main().catch(error => { console.error(error); stopAll(); process.exit(1); });
