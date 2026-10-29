/**
 * Work order C19 item 1: a whole online match on the real game server (`?server=ws`), two humans (two browser
 * contexts, 甲 and 乙) + six bots, from 1-2 until the room publishes a unique ranking.
 *
 *   npm run build:game && node tests/server/e2e/c19-full-match.mjs
 *
 * The humans play through the page's own controls (shop cards, D/F, the 部署 tab, item cards and slots, 合成, the first
 * offer of every choice). What to do in a preparation is asked of the T7 bot policy (`decideBotAction` from
 * src/server-entry), so they play at bot strength and live long enough for the late rounds; each preparation runs bots
 * first, then 甲, then 乙, so a seed replays the same match. Every check compares what the server projected to the page (my private state, the public view, the
 * receipts) with what the page shows; nothing here computes a rule. Along the way, once each unless noted:
 *   ops      during one of 甲's battles: buy, reroll and buy XP through the docked shop; each receipt is applied, the
 *            replay keeps playing, and the gold/level chips and the shop cards show the pushed state. From the 2-1
 *            preparation until this check ran, 甲 skips its policy turn to keep the gold for it and sells one bench unit
 *            when the bench is full, so a battle starts with gold, an offer and bench space.
 *   T13-A    a component clicked onto an EMPTY slot of a board unit wearing one loose component (preparation): one equip,
 *            applied; afterwards the unit wears no loose component and the panel slot + token icons show what the
 *            projection says the unit wears.
 *   C18-A    an item put on a fighting unit during a battle: the panel slot is marked 下场生效, the token keeps its battle
 *            icons and lists the item as pending; in the next preparation the mark is gone and the icons show it.
 *   orbs     every PvE round, once its battle played out: one orb card per `revealedLoot.revealedOrbs` entry with the
 *            server's tier and status (both humans, all rounds); the tiers seen are reported, and the page's own presenter
 *            renders all four tiers (gray/blue/gold/prismatic) with their tier marks.
 *   claims   (v15) at the start of each preparation a human clicks every orb of its own in the orb dock; each claimOrb
 *            is applied and the orb leaves the pushed list.
 *   .4       with the shared carousel (the production default, C19_CAROUSEL=1): at every x-4 carousel a living human picks
 *            by hand on the ring once released; the server walks to the card and grants on contact, the view marks my slot, and the
 *            unit (on the bench, the board or the holding slot) and its item arrive in my state; no component choice opens
 *            at an x-4 round. With C19_CAROUSEL=0 (the pre-P7 x-4 supply): every supply pick: the dialog is the supply
 *            dialog with exactly the offered components; the picked one lands in my inventory.
 *   tools    a magnetic remover and a reforger (v16: reforges everything a unit wears) each used once by whichever human
 *            holds one, and a champion duplicator when one drops (its hero comes as an orb to claim):
 *            one useConsumable to a target the server's consumableTargets allows, receipt consumable-used, and the
 *            inventory cards and the tool shelf show the pushed state.
 *   income   every settlement: the income receipt summary shows the round record's interest and XP.
 *   reload   乙 reloads the page in a PvE settlement once its orbs are shown: after the reconnect the same orb cards,
 *            inventory cards and tool shelf are back, equal to the projection.
 *   overtime only when the match gets there (seed dependent): the room's round names after 6-7 (加时 N) are shown in the
 *            sidebar while the match goes on. A match decided by 6-7 skips it with the round it ended in; the display
 *            itself is always covered by c19-overtime-display.mjs (fixed projection).
 *   end      both pages show the ranking overlay: 8 entries, ranks 1..8 once each, in the order and with the names of the
 *            server's ranking.
 * Any other check the match did not offer the chance for (no tool dropped, say) fails with the reason; C19_SEED picks
 * another room seed. Screenshots and report go to artifacts/c19/ (not committed; C19_OUT names another folder under artifacts/).
 * C19_VITE_PORT (5208) / C19_WS_PORT (8801).
 */
import { writeFileSync } from 'node:fs';
import { build } from 'esbuild';
import { ROOT, click, collectErrors, createChecks, joinOnline, launchBrowser, onlineUrl, outDir, read, startGameServer, startVite, stopAll, trackCommands, waitRead } from './harness.mjs';
import { showDragEndpoints } from './c19-drag-geometry.mjs';

const OUT = outDir(process.env.C19_OUT ?? 'c19');
const VITE_PORT = Number(process.env.C19_VITE_PORT ?? 5208);
const WS_PORT = Number(process.env.C19_WS_PORT ?? 8801);
// Seed 1 dropped a reforger to 乙 at 2-7 (see the report); other seeds may not.
const SEED = process.env.C19_SEED ?? '1';
// The shared carousel at the x-4 rounds is the server default (CAT_CAROUSEL); 0 runs the pre-P7 component supply instead.
const CAROUSEL = process.env.C19_CAROUSEL !== '0';
const NEXT_BATTLE = '下场生效';
const TIERS = ['gray', 'blue', 'gold', 'prismatic'];
/** The in-battle ops run from the 2-1 battle on (round ordinal 5). */
const OPS_FROM_ROUND = 5;
const OPS_GOLD = 12;

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
    shop: all('[data-debug^="mobile:buy-"]').filter(node => /^mobile:buy-\d+$/.test(node.dataset.debug)).map(node => ({ slot: Number(node.dataset.debug.slice('mobile:buy-'.length)), name: node.querySelector('.shop-name')?.textContent ?? '', cost: node.dataset.cost ?? null })),
    inventory: all('.item-inventory [data-item-id]').map(node => ({ id: node.dataset.itemId, definitionId: node.dataset.itemDef })),
    // A stacked card (×N) lists every copy it holds.
    tools: all('[data-debug^="consumable:"]').flatMap(node => node.dataset.consumableIds.split(' ').map(id => ({ id, definitionId: node.dataset.consumableDef }))),
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
    fault: (() => { const node = document.querySelector('[data-debug="online:fault"]'); return node && !node.hidden ? node.textContent : null; })(),
    ranking: (() => {
      const overlay = document.querySelector('#ranking-root');
      if (!overlay || overlay.hidden) return null;
      return Array.from(overlay.querySelectorAll('.ranking-entry')).map(entry => ({ rank: entry.querySelector('.ranking-rank')?.textContent ?? '', name: entry.querySelector('.ranking-name')?.textContent ?? '' }));
    })(),
  };
});
/** Whole seconds left on the phase countdown the page shows (0 when none). */
const secondsLeft = page => page.evaluate(() => Number(document.querySelector('[data-debug="online:timer"]')?.textContent) || 0);
/** One card per revealed orb, in order, with the server's tier, status and revealed entries. */
const expectedOrbs = loot => loot.revealedOrbs.map(orb => ({ orbId: orb.orbId, tier: orb.tier, status: orb.status, entries: orb.entryDropIds.filter(id => loot.revealedDrops.some(drop => drop.dropId === id)) }));
const inventoryOf = state => sorted(inventory(state).map(item => `${item.id}:${item.definitionId}`));
const shownInventory = view => sorted(view.inventory.map(item => `${item.id}:${item.definitionId}`));
const toolsOf = state => sorted((state.consumables ?? []).map(tool => `${tool.consumableId}:${tool.definitionId}`));
const shownTools = view => sorted(view.tools.map(tool => `${tool.id}:${tool.definitionId}`));

/** Display names from the content tables the page uses, and the T7 bot policy the humans consult (never re-implemented here). */
async function loadTables() {
  const outfile = `${OUT}/tables.mjs`;
  await build({
    stdin: { contents: "export { ITEM_DEFINITIONS } from './src/simulation/content/items.ts';\nexport { getHeroIdentity } from './src/presentation/hero-identity.ts';\nexport { decideBotAction, BOT_MAX_STEPS } from './src/server-entry/index.ts';", resolveDir: ROOT, loader: 'ts' },
    bundle: true, format: 'esm', platform: 'node', outfile, logLevel: 'warning',
  });
  return import(`${outfile}?${Date.now()}`);
}

const report = { claims: [], ops: null, autoCombine: null, pending: null, pendingNext: null, orbs: [], tiersSeen: [], tierPresenter: null, supply: [], carousel: [], x4Choices: [], tools: {}, income: [], reload: null, overtime: [], ranking: {}, rounds: {} };
/** Global once-only tasks; a human claims one synchronously before awaiting anything. */
const claimed = new Set();
const claim = task => { if (claimed.has(task)) return false; claimed.add(task); return true; };
/** Preparation turns: 甲 marks its round done so 乙 follows. */
const turns = new Map();

async function main() {
  const tables = await loadTables();
  const kindOf = definitionId => tables.ITEM_DEFINITIONS[definitionId]?.kind;
  const wsPort = await startGameServer(WS_PORT, { CAT_SEED: SEED, CAT_PREP_SEC: '16', CAT_CHOICE_SEC: '6', CAT_SETTLE_SEC: '18', CAT_BOT_STEP_MS: '50', CAT_TAKEOVER_SEC: '600', CAT_CAROUSEL: CAROUSEL ? '1' : '0' });
  const base = await startVite(VITE_PORT);
  const browser = await launchBrowser();
  const errors = [];
  try {
    const open = async name => {
      // Tall enough for the item bench, the equipment rows and the board together (see c16).
      const context = await browser.newContext({ viewport: { width: 1440, height: 2200 } });
      const page = await context.newPage();
      collectErrors(page, errors, name);
      return { name, page, wire: trackCommands(page), rng: name === '甲' ? 0x0c19a001 : 0x0c19a002 };
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
    const claimFailures = report.claims.filter(entry => entry.receipt !== 'applied' || !entry.pushed);
    check(report.claims.length > 0 && claimFailures.length === 0, `orbs claimed through the dock: ${report.claims.length} claim(s), all applied and pushed (${JSON.stringify(claimFailures)})`);
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
    if (CAROUSEL) {
      check(report.carousel.length > 0 && report.carousel.every(entry => entry.ok), `every x-4 carousel pick by hand was applied, marked mine, and its unit and item arrived (${report.carousel.map(entry => `${entry.human} ${entry.roundId}${entry.ok ? '' : ` ✗ ${entry.receipt}`}`).join(', ') || 'no carousel pick'})`);
      check(report.x4Choices.length === 0 && report.supply.length === 0, `no component choice opened at an x-4 round with the carousel on (${report.x4Choices.map(entry => `${entry.human} ${entry.roundId} ${entry.kind}`).join(', ') || 'none'})`);
    } else check(report.supply.length > 0 && report.supply.every(entry => entry.ok), `every .4 supply dialog showed exactly the offered components and the pick landed in the inventory (${report.supply.map(entry => `${entry.human} ${entry.roundId}${entry.ok ? '' : ' ✗'}`).join(', ') || 'no supply pick'})`);
    check(report.income.length > 0 && report.income.every(entry => entry.ok), `every settlement receipt shows the record's interest and XP (${report.income.length} settlements${report.income.some(entry => !entry.ok) ? `; differ: ${JSON.stringify(report.income.filter(entry => !entry.ok).slice(0, 3))}` : ''})`);
    check(report.ops !== null, `in-battle buy/reroll/buyXp ran (${report.ops ? report.ops.roundId : 'no battle with gold, an offer and bench space'})`);
    check(report.autoCombine !== null, `T13-A auto-combine ran (${report.autoCombine ? report.autoCombine.roundId : 'never a component and a unit wearing one loose component'})`);
    check(report.pending !== null && report.pendingNext !== null, `C18-A next-battle equipment ran and was followed into the next preparation (${report.pending?.roundId ?? 'none'} → ${report.pendingNext?.roundId ?? 'none'})`);
    check(Boolean(report.tools.remover), `a magnetic remover was used (${report.tools.remover ? `${report.tools.remover.human} ${report.tools.remover.roundId}` : 'no human held a remover and a unit wearing items'})`);
    // A drag that sent nothing is a failed use, not a use: it needs the server's receipt and exactly one command.
    // No reforger with an allowed target in this match is a coverage gap, reported apart from gesture failures.
    const reforger = report.tools.reforger;
    if (reforger) check(reforger.receipt === 'consumable-used' && reforger.commands.length === 1, `a reforger was used (${reforger.human} ${reforger.roundId} ${reforger.definitionId}: receipt ${reforger.receipt}, ${reforger.commands.length} command(s))`);
    else check(false, 'coverage gap (检查机会不足): no human held a reforger with an allowed target');
    check(report.reload !== null, `乙 reloaded in a PvE settlement and came back before it ended (${report.reload ? `${report.reload.roundId}, back after ${report.reload.backAfterMs} ms` : 'never'})`);
    if (report.overtime.length > 0) check(report.overtime.every(entry => entry.ok), `overtime after 6-7 was played and shown (${report.overtime.map(entry => `${entry.roundName}${entry.ok ? '' : ' ✗'}`).join(', ')})`);
    else console.log(`skip overtime: the match was decided in ${Object.values(report.ranking)[0]?.roundName ?? 'an unknown round'} (display covered by c19-overtime-display.mjs)`);
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
  const answered = new Set(), carouselsPicked = new Set(), settlementsSeen = new Set(), orbsSeen = new Set(), overtimeSeen = new Set();
  let pending = null, lastPrep = 0;
  const reloadAttempts = [], prepSeen = new Map();
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
      const ended = await screen(page), shown = ended.ranking;
      const ranking = view.m6.ranking ?? [];
      await page.screenshot({ path: `${OUT}/${name}-ranking.png` });
      report.ranking[name] = { roundName: phase.roundName, server: ranking.map(seat => ({ seatId: seat.seatId, name: seat.name, rank: seat.rank })), shown, fault: ended.fault };
      check(ended.fault === null, `${name}: the room ended normally (${ended.fault ?? 'no fault shown'}, last round ${phase.roundName})`);
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

    /* x-4 carousel: once released, pick by hand on the ring (the first unit still standing) */
    const carousel = s.m6.carousel ?? null;
    if (phase?.kind === 'carousel' && carousel?.status === 'open' && carousel.eligible && carousel.pickedSlot === null && !carouselsPicked.has(carousel.id)) {
      carouselsPicked.add(carousel.id);
      await carouselPick(human, s, carousel, pushed);
      return false;
    }

    /* choices: supply (.4) dialogs are checked, every other choice takes the first offer */
    const choice = s.state.phase === 'choice' ? s.state.pendingChoice : null;
    if (choice) {
      const key = `${choice.choiceId}:${choice.step}:${choice.generation}`;
      if (!answered.has(key)) {
        if (choice.step === 'target') { const unit = mine(s.state)[0]; if (unit && await click(page, `anomaly-target:${unit.id}`)) answered.add(key); }
        else if (choice.kind === 'component' && s.state.m8.round.kind === 'supply') {
          if (CAROUSEL) report.x4Choices.push({ human: name, roundId: s.state.roundDefinitionId, kind: choice.kind, offers: choice.offers });
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
          if (role.reload && !report.reload && reloadAttempts.length < 4 && s.state.phase === 'settlement') {
            await items();
            const before = await screen(page), state = (await read(page)).state, reloadedAt = Date.now();
            await page.screenshot({ path: `${OUT}/reload-before.png` });
            await page.reload();
            // Back on the seat, then (when the room is still in this settlement) the battle replayed and the orbs shown.
            const back = await pushed(x => x.m6?.mode === 'active' && x.state.round >= state.round, 25_000);
            const again = back && await pushed(x => (x.state.round === state.round && !x.replay?.playingBack && x.state.revealedLoot?.revealedOrbs?.length > 0) || x.state.round > state.round, 25_000);
            const attempt = { roundId: loot.roundId, backAfterMs: back ? Date.now() - reloadedAt : null, round: again?.state.round ?? null, phase: again?.m6.phase?.kind ?? null };
            reloadAttempts.push(attempt);
            console.log(`乙 reload in ${loot.roundId} settlement: ${JSON.stringify(attempt)}`);
            if (!again || again.state.round !== state.round) return false; // the settlement ended first: try in a later PvE settlement
            await items(); await page.waitForTimeout(300);
            // The projection read on both sides of the screen read: a round change in between is a missed attempt, not a mismatch.
            const now = (await read(page)).state, after = await screen(page), still = (await read(page)).state;
            if (now.round !== state.round || fingerprint(still) !== fingerprint(now) || JSON.stringify(still.revealedLoot) !== JSON.stringify(now.revealedLoot)) {
              attempt.late = true; console.log('乙 reload: the settlement ended while reading the page; trying in a later PvE settlement'); return false;
            }
            await page.screenshot({ path: `${OUT}/reload-after.png` });
            report.reload = { ...attempt, before: { orbs: before.orbs, inventory: shownInventory(before), tools: shownTools(before) }, after: { orbs: after.orbs, inventory: shownInventory(after), tools: shownTools(after) } };
            const orbsBack = same(after.orbs, before.orbs) && same(after.orbs, expectedOrbs(now.revealedLoot));
            check(orbsBack, `乙 ${loot.roundId}: after the reload the same orb cards are back, equal to the projection (${orbsBack ? `${after.orbs.length} cards` : `before ${JSON.stringify(before.orbs)}, after ${JSON.stringify(after.orbs)}, projected ${JSON.stringify(expectedOrbs(now.revealedLoot))}`})`);
            check(same(shownInventory(after), shownInventory(before)) && same(shownInventory(after), inventoryOf(now)), `乙 ${loot.roundId}: the same inventory cards are back, equal to the projection (${shownInventory(after).join(', ') || 'empty'})`);
            check(same(shownTools(after), shownTools(before)) && same(shownTools(after), toolsOf(now)), `乙 ${loot.roundId}: the same tool shelf is back, equal to the projection (${shownTools(after).join(', ') || 'empty'})`);
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

    /* tools: a remover or a reforger on a unit wearing items, a duplicator on any allowed unit (any phase the server allows) */
    const tools = s.state.consumables ?? [];
    // A target the server allows; never the unit or item a pending C18-A check still follows.
    const usable = (task, state, target) => target.allowed && task !== 'other' && (task === 'duplicator' || wornBy(state, target.target.unitId).length > 0)
      && !(pending && (target.target.unitId === pending.unitId || target.target.itemId === pending.itemId));
    const toolTask = tools.map(tool => ({ tool, task: TOOL_TASKS[tool.definitionId] ?? 'other' })).find(entry => !claimed.has(entry.task)
      && (s.state.consumableTargets ?? []).find(row => row.consumableId === entry.tool.consumableId)?.targets.some(target => usable(entry.task, s.state, target)));
    if (toolTask && !s.replay?.playingBack && ['preparation', 'settlement'].includes(s.state.phase) && await secondsLeft(page) >= 4) {
      await items();
      const now = await read(page);
      const tool = (now.state.consumables ?? []).find(entry => entry.consumableId === toolTask.tool.consumableId);
      const row = tool && now.state.consumableTargets.find(entry => entry.consumableId === tool.consumableId);
      const target = row?.targets.find(entry => usable(toolTask.task, now.state, entry)
        && now.strategy.bounds[entry.target.kind === 'unit' ? `equipment:${entry.target.unitId}:0` : itemBoundsKey(now.state, entry.target.itemId)]);
      const from = tool && now.strategy.bounds[`consumable:${tool.consumableId}`];
      if (target && from && claim(toolTask.task)) {
        const sourceKey = `consumable:${tool.consumableId}`;
        const targetKey = target.target.kind === 'unit' ? `equipment:${target.target.unitId}:0` : itemBoundsKey(now.state, target.target.itemId);
        // Docked, the unit slots fold into 单位装备 (#264); a player unfolds it before dragging a tool onto a slot or a worn item.
        await page.evaluate(() => { const fold = document.querySelector('details.equip-details'); if (fold && !fold.open) fold.querySelector('summary')?.click(); });
        await page.waitForTimeout(120);
        await showDragEndpoints(page, sourceKey, targetKey);
        const positioned = await read(page);
        const from = positioned.strategy.bounds[sourceKey], to = positioned.strategy.bounds[targetKey];
        const affected = target.target.kind === 'unit' ? wornBy(now.state, target.target.unitId).map(item => item.id) : [target.target.itemId];
        const before = wire.mark();
        await page.mouse.move(from.centerX, from.centerY); await page.mouse.down();
        await page.mouse.move(to.centerX, to.centerY, { steps: 8 }); await page.waitForTimeout(60); await page.mouse.up();
        const receipt = await wire.receiptSince(before, 'useConsumable');
        // The phase ended between the read and the drop (the deadline freeze takes no command): use it later.
        if (receipt === 'refused:wrong-phase') { claimed.delete(toolTask.task); console.log(`${name} ${tool.definitionId}: refused at a phase boundary, retrying later`); return false; }
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
        // v16 reforge-all: every worn item comes off, each reforged (or, with no other candidate, returned) into the inventory.
        else if (toolTask.task === 'reforger') check(wornBy(state, target.target.unitId).length === 0 && inventoryOf(state).length === inventoryOf(now.state).length + affected.length,
          `${name} reforger: ${target.target.unitId} wears nothing and its ${affected.length} item(s) came back reforged into the inventory (${inventoryOf(now.state).length} → ${inventoryOf(state).length})`);
        else check((state.unclaimedOrbs ?? []).length > (now.state.unclaimedOrbs ?? []).length, `${name} duplicator: a hero orb to claim appeared (${(now.state.unclaimedOrbs ?? []).length} → ${(state.unclaimedOrbs ?? []).length})`);
        return false;
      }
    }

    /* in-battle ops (甲, once): buy, reroll, buy XP during a battle */
    if (role.ops && !report.ops && inBattle(s) && s.replay?.playingBack && (s.replay.terminalTick ?? 0) >= 120 && (s.replay.tick ?? 0) < 40 && s.state.round >= OPS_FROM_ROUND) {
      const state = s.state;
      const slot = state.shop.slots.findIndex(offer => offer.status === 'available');
      const benchFree = mine(state).filter(unit => unit.location.kind === 'bench').length < state.preparation.benchSize;
      if (slot >= 0 && benchFree && state.gold >= OPS_GOLD && state.level < 9 && claim('ops')) {
        const superseded = s.replay.superseded;
        // Each applied receipt is followed by its state push: wait for the state to change before the next control.
        let print = fingerprint(state);
        const step = async (control, type) => {
          const receipt = await act(control, type), before = print;
          const after = receipt === 'applied' ? await pushed(x => fingerprint(x.state) !== before) : null;
          if (after) print = fingerprint(after.state);
          return [receipt, after];
        };
        const [buy, afterBuy] = await step(`mobile:buy-${slot}`, 'buy');
        const [reroll, afterReroll] = await step('mobile:reroll', 'reroll');
        const [xp, afterXp] = await step('mobile:buy-xp', 'buyXp');
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
      // Bots act first (50 ms steps, done within ~3.5 s), then 甲, then 乙: the same order on every run of a seed.
      if (!prepSeen.has(s.state.round)) prepSeen.set(s.state.round, Date.now());
      const waited = Date.now() - prepSeen.get(s.state.round), jia = s.m6.seats.find(seat => seat.name === '甲');
      const ready = name === '甲' ? waited > 3_500 : turns.get(s.state.round) === 'done' || !jia?.alive || waited > 10_000;
      if (!ready) { await page.waitForTimeout(80); return false; }
      lastPrep = s.state.round;
      await claimOrbs(human, pushed);
      await autoCombineCheck(human, kindOf, pushed, items);
      // Until the in-battle ops ran, 甲 keeps its gold for them and makes room on the bench (see the header).
      if (role.ops && !report.ops && s.state.round >= OPS_FROM_ROUND) await keepForOps(human, act, items);
      else await policyTurn(human, tables, act, pushed, items);
      if (name === '甲') turns.set(s.state.round, 'done');
      return false;
    }
    await page.waitForTimeout(80);
    return false;
  }
}

/** Which tool check a consumable feeds (v16: one unified reforger, two champion duplicators). */
const TOOL_TASKS = { 'magnetic-remover': 'remover', reforger: 'reforger', TFT_Consumable_NeekosHelp: 'duplicator', TFT_Consumable_ChampionDuplicator_III: 'duplicator' };

/** Clicks the orb dock's button for one orb (orb ids hold quotes, so it is matched by dataset, not a selector). */
const clickOrb = (page, orbId) => page.evaluate(id => {
  const node = [...document.querySelectorAll('[data-debug^="orb-claim:"]')].find(button => button.dataset.debug === `orb-claim:${id}`);
  if (node && !node.disabled) { node.click(); return true; }
  return false;
}, orbId);

/**
 * v15: orbs stay on the board until clicked. At the start of each preparation a human claims every orb the server lists
 * as its own through the orb dock's button; each claim must be applied and the orb leave the pushed list.
 */
async function claimOrbs(human, pushed) {
  const s = await read(human.page);
  for (const orb of s.state.unclaimedOrbs ?? []) {
    const before = human.wire.mark();
    const receipt = await clickOrb(human.page, orb.orbId) ? await human.wire.receiptSince(before, 'claimOrb') : 'no button';
    const after = receipt === 'applied' ? await pushed(x => !(x.state.unclaimedOrbs ?? []).some(entry => entry.orbId === orb.orbId)) : null;
    report.claims.push({ human: human.name, roundId: s.state.roundDefinitionId, tier: orb.tier, receipt, pushed: after !== null });
  }
}

/**
 * 甲's preparation while the in-battle ops wait for their battle: no policy turn (the gold stays), and with a full bench
 * one bench unit is sold through the page so the battle's buy has a place to land. The sell is the page's own control.
 */
async function keepForOps(human, act, items) {
  const s = await read(human.page);
  if (!inPreparation(s)) return;
  const bench = mine(s.state).filter(unit => unit.location.kind === 'bench');
  if (bench.length < s.state.preparation.benchSize) return;
  const outcome = await perform(human, { type: 'sell', unitId: bench[0].id }, act, items);
  console.log(`甲 ${s.state.roundDefinitionId}: bench full, sold ${bench[0].id} to keep room for the in-battle buy (${outcome})`);
}

/**
 * One x-4 carousel pick by hand: the ring is brought up when the page sits on the board side, the first unit still
 * standing is clicked (another one when the server answers slot-taken under load), and the pick must be applied, shown
 * as mine and arrive in my state with its item. The rules decide everything; nothing here names a slot for the server.
 */
async function carouselPick(human, s, carousel, pushed) {
  const { name, page, wire } = human;
  const ringFree = () => page.evaluate(() => {
    const root = document.querySelector('#carousel-panel');
    if (!root || root.hidden) return null;
    return [...root.querySelectorAll('.carousel-slot')].filter(node => node.classList.contains('takable') && !node.disabled).map(node => Number(node.dataset.slot));
  });
  if (s.m6.carouselSide !== 'carousel') {
    await page.evaluate(() => (document.activeElement instanceof HTMLElement) && document.activeElement.blur());
    await page.keyboard.press('Space');
  }
  const unitsBefore = new Set(mine(s.state).map(unit => unit.id)), itemsBefore = new Set(s.state.items.map(item => item.id));
  const heldBefore = new Set((s.state.heldCarouselUnits ?? []).map(unit => unit.unitId));
  let free = null;
  for (let wait = 0; wait < 30 && !(free = await ringFree())?.length; wait++) await page.waitForTimeout(100);
  let slot = free?.[0], receipt = null, shown = null, before = wire.mark();
  for (let attempt = 0; slot !== undefined && attempt < 3; attempt++) {
    before = wire.mark();
    // The card may disappear before the pointer lands; a sent walk must reach physical contact before the grant.
    const box = await page.locator(`[data-debug="online:carousel-slot:${slot}"]`).boundingBox({ timeout: 1_000 }).catch(() => null);
    if (box) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    shown = box ? await pushed(x => x.m6.carousel?.pickedSlot === slot, 5_000) : null;
    const sent = wire.commandsSince(before, 'walk');
    receipt = shown && sent.some(walk => walk.scene === 'carousel' && walk.slot === slot) && wire.commandsSince(before, 'carousel-pick').length === 0 ? 'contact-granted' : 'taken-before-contact';
    if (receipt === 'contact-granted') break;
    await page.waitForTimeout(300);
    slot = (await ringFree())?.[0] ?? slot;
  }
  const picked = slot === undefined ? null : carousel.slots.find(entry => entry.slot === slot);
  const mineShown = shown && await page.evaluate(chip => document.querySelector(`[data-debug="online:carousel-slot:${chip}"]`)?.classList.contains('mine') ?? false, slot);
  // The unit lands on the bench or the board (a new unit, or a star-up of one I own) or waits in the holding slot; its item is mine.
  const arrived = shown && await pushed(x => {
    const units = mine(x.state), held = x.state.heldCarouselUnits ?? [];
    const unit = held.some(entry => !heldBefore.has(entry.unitId) && entry.definitionId === picked.definitionId)
      || units.some(entry => entry.definitionId === picked.definitionId && (!unitsBefore.has(entry.id) || entry.starLevel > (s.state.preparation.units.find(old => old.id === entry.id)?.starLevel ?? 0)));
    return unit && x.state.items.some(item => !itemsBefore.has(item.id));
  }, 10_000);
  const ok = receipt === 'contact-granted' && Boolean(shown) && mineShown === true && Boolean(arrived);
  report.carousel.push({ human: name, roundId: carousel.roundId, slot, definitionId: picked?.definitionId ?? null, items: picked?.items ?? [], receipt, mineShown, arrived: Boolean(arrived), ok });
  if (!ok) await page.screenshot({ path: `${OUT}/${name}-carousel-${carousel.roundId}.png` });
  console.log(`${name} ${carousel.roundId} carousel: slot ${slot} ${picked?.definitionId} (${receipt}${ok ? '' : ', ✗'})`);
}

/** The bounds key of an item: its inventory card, else the equipment slot that holds it. */
function itemBoundsKey(state, itemId) {
  const item = state.items.find(entry => entry.id === itemId);
  if (!item) return null;
  return item.location.kind === 'unit' ? `equipment:${item.location.unitId}:${item.location.slot}` : `item:${itemId}`;
}

/**
 * One preparation turn of a human: the T7 policy (`decideBotAction`, the bots' own brain from src/server-entry) names one
 * intention at a time and the test carries it out through the page's controls (shop cards, D/F, 部署 tab, item cards
 * and slots, 合成). A refused or unreachable intention ends the turn, as for a bot (contract §13.3). The humans thus play
 * at bot strength and live long enough for the late checks; nothing here decides a rule.
 */
async function policyTurn(human, brain, act, pushed, items) {
  const { name, page } = human;
  let stepsTaken = 0, lastFailure;
  for (;;) {
    const s = await read(page);
    if (!inPreparation(s)) return;
    const self = s.m6.seats.find(seat => seat.name === name);
    // The page's display copy fills the id serials the seat view does not carry with placeholders (seat-view-adapter);
    // the policy's previews only need them past every id in use to name a candidate. The server picks the real ids.
    const after = (ids, prefix) => Math.max(0, ...ids.filter(id => id.startsWith(prefix)).map(id => Number(id.slice(prefix.length)) || 0)) + 1;
    const input = { ...s.state, nextUnitSerial: Math.max(s.state.nextUnitSerial, after(s.state.preparation.units.map(unit => unit.id), 'unit-')),
      nextItemSerial: Math.max(s.state.nextItemSerial, after(s.state.items.map(item => item.id), 'item-')) };
    let decision;
    try { decision = brain.decideBotAction(input, { difficulty: 'basic', stepsTaken, maxSteps: brain.BOT_MAX_STEPS, self: { seatId: self.seatId, hp: s.state.playerHp, round: s.state.round }, ...(lastFailure ? { lastFailure } : {}) }, human.rng); }
    catch (error) { console.log(`${name} ${s.state.roundDefinitionId}: the policy could not read the display state (${error.message}); turn ends`); return; }
    human.rng = decision.rng;
    const action = decision.action;
    if (action === 'done') return;
    stepsTaken++;
    const before = fingerprint(s.state);
    const outcome = await perform(human, action, act, items);
    if (outcome !== 'applied') { lastFailure = { action, reason: outcome ?? 'no-receipt' }; continue; }
    await pushed(x => fingerprint(x.state) !== before, 3_000);
  }
}
/** What a command changes in my state; a push after an applied receipt changes it. */
const fingerprint = state => JSON.stringify([state.gold, state.level, state.xp, state.shop, state.preparation.units.map(unit => [unit.id, unit.location, unit.starLevel]),
  state.items.map(item => [item.id, item.location]), state.pendingChoice?.choiceId ?? null]);
/** Carries out one policy intention through the page; the receipt kind, `refused:<reason>`, or 'disabled'/'unmapped'. */
async function perform(human, action, act, items) {
  const { page, wire } = human;
  const units = async () => { await click(page, 'panel:units'); await page.waitForTimeout(80); };
  /** A real click in the middle of a panel node (item cards select on pointer up, not on a synthetic click). */
  const press = async key => { const box = (await read(page)).strategy.bounds[key]; if (!box) return false; await page.mouse.click(box.centerX, box.centerY); await page.waitForTimeout(80); return true; };
  switch (action.type) {
    case 'buy': return act(`mobile:buy-${action.slot}`, 'buy');
    case 'reroll': return act('mobile:reroll', 'reroll');
    case 'buyXp': return act('mobile:buy-xp', 'buyXp');
    case 'shopLock': return act('shop-lock', 'shopLock');
    case 'sell': await units(); if (!(await click(page, `mobile:unit:${action.unitId}`))) return 'disabled'; return act('mobile:sell', 'sell');
    case 'deploy': {
      await units();
      if (!(await click(page, `mobile:unit:${action.unitId}`))) return 'disabled';
      return act(action.target.kind === 'board' ? `deploy:${cellKey(action.target.cell)}` : `mobile:bench:${action.target.slot}`, 'deploy');
    }
    case 'combine': {
      await items();
      for (const id of [action.a, action.b]) if (!(await press(`item:${id}`))) return 'disabled';
      return act('combine-items', 'combine');
    }
    case 'equip': {
      await items();
      const before = wire.mark();
      if (!(await press(`item:${action.itemId}`)) || !(await press(`equipment:${action.unitId}:${action.slot}`))) return 'disabled';
      return wire.receiptSince(before, 'equip');
    }
    default: return 'unmapped';
  }
}

/**
 * T13-A, once: with two components at hand, one is put on a board unit wearing nothing, then the other is clicked onto an
 * EMPTY slot of that unit (card, then slot: the C16 path). The policy turn does everything else.
 */
async function autoCombineCheck(human, kindOf, pushed, items) {
  const { name, page, wire } = human;
  if (report.autoCombine) return;
  await items();
  for (let guard = 0; guard < 3 && !report.autoCombine; guard++) {
    const now = await read(page);
    if (!inPreparation(now)) return;
    const board = mine(now.state).filter(unit => unit.location.kind === 'board');
    const loose = unit => wornBy(now.state, unit.id).filter(item => kindOf(item.definitionId) === 'component');
    const emptySlot = unit => [0, 1, 2].find(slot => !wornBy(now.state, unit.id).some(item => item.location.slot === slot) && now.strategy.bounds[`equipment:${unit.id}:${slot}`]);
    const components = inventory(now.state).filter(entry => now.strategy.bounds[`item:${entry.id}`] && kindOf(entry.definitionId) === 'component');
    const wearer = board.find(entry => loose(entry).length === 1 && emptySlot(entry) !== undefined);
    if (!components.length || (!wearer && components.length < 2)) return;
    const item = components[0];
    const unit = wearer ?? board.find(entry => wornBy(now.state, entry.id).length === 0 && emptySlot(entry) !== undefined);
    if (!unit) return;
    const slot = emptySlot(unit), autoCombine = Boolean(wearer);
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
