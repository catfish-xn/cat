/**
 * G1-P7 / P7-1 shared carousel acceptance against the real game server (`?server=ws`, carousel on: the production default).
 * Three humans + five bots. Human A plays in the browser; human B joins and drops before the first carousel and stays away;
 * human C stays connected and never picks.
 *
 *   npm run build:game && node tests/server/e2e/p7-carousel.mjs
 *
 * Opening (P7-1): no carousel; 1-2 preparation opens with the free Irelia and a dealt shop, like the pre-P7 opening.
 * Up to 2-4: in every preparation A deploys bench units onto its board up to its level and buys until its bench is full
 * (rerolling in stage 2 when needed), so at 2-4 both are full. No carousel opens before 2-4.
 * 2-4: the ring shows nine units with their item; the release order follows the public HP (ascending, seat order on a
 * tie), in batches of two every 6 s; nothing is takable before my batch. P7-1 switch: before my batch A switches to its
 * board (button), the ring hides and a compact bar keeps the countdown; the release turns the bar into "轮到我"; Space
 * brings the ring back with the same carousel and slots, and the pick works from there. A's pick lands in the holding
 * slot (临时位: bench and board full), not on the bench or the board. Bots pick when released; B (disconnected) and C
 * (connected, idle) are picked for at the deadline, C's ring says "已自动选取". The phase holds to the deadline + 2 s;
 * no component choice opens; 2-4 settles once.
 * 2-5: the held unit is still held (no place); A sells a bench unit and the server moves the held unit into the freed
 * bench slot at once; the holding slot disappears.
 * Screenshots go to artifacts/p7-carousel/ (not committed). P7_WS_PORT / P7_VITE_PORT override the ports.
 */
import { click, collectErrors, createChecks, joinOnline, launchBrowser, onlineUrl, outDir, pollRead, read, sleep, startGameServer, startVite, stopAll, trackCommands, waitRead } from './harness.mjs';

const OUT = outDir('p7-carousel');
const WS_PORT = Number(process.env.P7_WS_PORT ?? 8826);
const VITE_PORT = Number(process.env.P7_VITE_PORT ?? 5226);
const { check, finish } = createChecks();

const ring = page => page.evaluate(() => {
  const root = document.querySelector('#carousel-panel');
  if (!root || root.hidden) return null;
  return {
    canPick: root.hasAttribute('data-can-pick'), status: root.querySelector('.carousel-status')?.textContent ?? '', timer: root.querySelector('.carousel-timer')?.textContent ?? '',
    slots: [...root.querySelectorAll('.carousel-slot')].map(node => ({ slot: Number(node.dataset.slot), definitionId: node.dataset.definition, items: node.querySelector('.carousel-items')?.dataset.item ?? '',
      takable: node.classList.contains('takable'), taken: node.classList.contains('taken'), mine: node.classList.contains('mine'), disabled: node.disabled,
      pickedBy: node.dataset.pickedBy ?? null, auto: node.querySelector('.carousel-taker.auto') !== null })),
    batches: [...root.querySelectorAll('.carousel-batch')].map(node => [...node.querySelectorAll('.carousel-seat')].map(seat => seat.dataset.seat)),
  };
});
const bar = page => page.evaluate(() => {
  const root = document.querySelector('[data-debug="online:carousel-bar"]');
  if (!root || root.hidden) return null;
  return { timer: root.querySelector('.carousel-bar-timer')?.textContent ?? '', status: root.querySelector('.carousel-bar-status')?.textContent ?? '',
    myTurn: root.classList.contains('my-turn'), body: document.body.dataset.onlineCarousel ?? null };
});
const holding = page => page.evaluate(() => {
  const root = document.querySelector('[data-debug="online:carousel-holding"]');
  if (!root || root.hidden) return null;
  return [...root.querySelectorAll('.carousel-holding-unit')].map(card => ({ unitId: card.dataset.unit, definitionId: card.dataset.definition,
    idle: card.querySelector('.carousel-holding-idle')?.textContent ?? '', sellable: card.querySelector('.carousel-holding-sell')?.disabled === false }));
});
const myUnits = s => s.state.preparation.units.filter(unit => unit.team === 'player');
const placed = (s, kind) => myUnits(s).filter(unit => unit.location.kind === kind).length;
const heldOf = s => s?.state?.heldCarouselUnits ?? [];
const carouselOf = s => s?.m6?.carousel ?? null;

async function main() {
  const wsPort = await startGameServer(WS_PORT, { CAT_PREP_SEC: '6', CAT_CHOICE_SEC: '4', CAT_SETTLE_SEC: '3', CAT_BOT_STEP_MS: '120', CAT_CAROUSEL: '1' });
  const base = await startVite(VITE_PORT);
  const browser = await launchBrowser();
  const errors = [];
  try {
    const a = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
    const bContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const b = await bContext.newPage();
    const c = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
    collectErrors(a, errors, 'A'); collectErrors(c, errors, 'C');
    const wire = trackCommands(a);
    await joinOnline(a, onlineUrl(base, wsPort), '选手A', { startMatch: false });
    await joinOnline(b, onlineUrl(base, wsPort), '掉线B', { startMatch: false });
    await joinOnline(c, onlineUrl(base, wsPort), '旁观C', { startMatch: false });
    await a.click('[data-debug="online:start"]');
    await waitRead(b, s => s.m6.mode === 'active', 'B sees the match start');
    const seatOf = page => page.evaluate(() => document.querySelector('.online-seat.me')?.dataset.debug?.replace('online:seat:', ''));
    const bSeat = await seatOf(b);
    await bContext.close(); // B drops before any carousel and never comes back

    /* ---------------- opening (P7-1: no carousel) ---------------- */
    let s = await waitRead(a, s => s.m6.mode === 'active' && s.m6.phase.kind === 'preparation', '1-2 preparation');
    const me = await seatOf(a), cSeat = await seatOf(c);
    const bots = s.m6.seats.filter(seat => seat.kind === 'bot').map(seat => seat.seatId);
    const seatIndex = new Map(s.m6.seats.map((seat, index) => [seat.seatId, index]));
    check(s.state.roundDefinitionId === '1-2' && carouselOf(s) === null && await ring(a) === null, `the match opens on 1-2 preparation without a carousel (${s.m6.phase.kind} ${s.state.roundDefinitionId})`);
    check(myUnits(s).length === 1 && myUnits(s)[0].definitionId === 'irelia' && myUnits(s)[0].starLevel === 1, `the free opening Irelia is mine (${myUnits(s).map(unit => unit.definitionId)})`);
    check(s.state.shop.generation > 0 && s.state.shop.slots.some(slot => slot.status === 'available'), 'the first shop is dealt');
    check(s.state.items.length === 0 && heldOf(s).length === 0 && await holding(a) === null, 'no component, nothing held at the opening');
    await a.screenshot({ path: `${OUT}/1-2-opening.png` });

    /* ---------------- up to 2-4: fill the bench (and so the board) ---------------- */
    const answered = new Set();
    let sawEarlyCarousel = null;
    const cost = slot => a.evaluate(at => Number(document.querySelector(`[data-debug="mobile:buy-${at}"]`)?.dataset.cost ?? 99), slot);
    /** One purchase my gold allows (in stage 2 a reroll first when nothing is); false when nothing could be bought. */
    const buyOne = async () => {
      for (let rolls = 0; rolls < 4; rolls++) {
        s = await read(a);
        for (let slot = 0; slot < 5; slot++) {
          if (s.state.shop.slots[slot]?.status !== 'available' || s.state.gold < await cost(slot)) continue;
          const mark = wire.mark();
          if (await click(a, `mobile:buy-${slot}`) && await wire.receiptSince(mark, 'buy', 2_000) === 'applied') { await sleep(150); return true; }
        }
        if (!s.state.roundDefinitionId.startsWith('2-') || s.state.gold < 3 || !(await click(a, 'mobile:reroll'))) return false;
        await sleep(250);
      }
      return false;
    };
    /** Deploys one bench unit to the first free cell of my zone (a level up left a board place); true when applied. */
    const deployOne = async () => {
      const unit = myUnits(s).find(candidate => candidate.location.kind === 'bench');
      const { board } = s.state.preparation, zone = board.deploymentZones.player;
      const taken = new Set(myUnits(s).filter(other => other.location.kind === 'board').map(other => `${other.location.cell.col},${other.location.cell.row}`));
      let cell = null;
      for (let row = zone.firstRow; row <= zone.lastRow && !cell; row++) for (let col = 0; col < board.columns && !cell; col++) if (!taken.has(`${col},${row}`)) cell = `${col},${row}`;
      if (!unit || !cell) return false;
      await click(a, 'panel:units'); await sleep(80);
      if (!(await click(a, `mobile:unit:${unit.id}`))) return false;
      const mark = wire.mark();
      return await click(a, `deploy:${cell}`) && await wire.receiptSince(mark, 'deploy', 2_000) === 'applied';
    };
    /**
     * Fills my board up to my level from the bench, then the bench up to 9 from the shop (a third copy merges, so it
     * loops), so the preparation deadline has nothing to deploy and the bench stays full into 2-4.
     */
    const fillUp = async () => {
      for (let step = 0; step < 20; step++) {
        s = await read(a);
        if (!s?.state || s.state.phase !== 'preparation' || s.m6.phase.kind !== 'preparation') return;
        if (placed(s, 'board') < s.state.level && placed(s, 'bench') > 0) { if (!(await deployOne())) return; await sleep(150); continue; }
        if (placed(s, 'bench') >= 9 || !(await buyOne())) return;
      }
    };
    let lastRound = '';
    const until = Date.now() + 8 * 60_000;
    for (;;) {
      s = await read(a).catch(() => null);
      if (Date.now() > until) throw new Error(`2-4 carousel never opened (${s?.m6?.phase?.roundName})`);
      if (!s?.state || !s.m6?.phase) { await sleep(150); continue; }
      if (s.m6.phase.kind === 'ended') throw new Error('the match ended before 2-4');
      const open = carouselOf(s);
      if (open?.roundId === '2-4') break;
      if (open && !sawEarlyCarousel) sawEarlyCarousel = open.roundId;
      const choice = s.state.phase === 'choice' ? s.state.pendingChoice : null;
      if (choice && !answered.has(`${choice.choiceId}:${choice.generation}`)) {
        answered.add(`${choice.choiceId}:${choice.generation}`);
        await a.evaluate(id => document.querySelector(`[data-debug="choice:${id}"]`)?.click(), choice.offers[0]);
      }
      if (s.state.roundDefinitionId !== lastRound) {
        lastRound = s.state.roundDefinitionId;
        console.log(`note ${lastRound}: bench ${placed(s, 'bench')}, board ${placed(s, 'board')}/${s.state.level}, gold ${s.state.gold}`);
      }
      const short = placed(s, 'bench') < 9 || placed(s, 'board') < s.state.level;
      if (short && s.m6.phase.kind === 'preparation' && s.state.phase === 'preparation') await fillUp();
      await sleep(150);
    }
    check(sawEarlyCarousel === null, `no carousel opened before 2-4 (${sawEarlyCarousel ?? 'none'})`);

    /* ---------------- 2-4 ---------------- */
    let cv = carouselOf(s);
    // The x-4 component supply must not open: every snapshot read from here to the settlement is checked.
    let sawComponentChoice = false;
    const watch = predicate => snapshot => { if (snapshot.state?.phase === 'choice' && snapshot.state.roundDefinitionId === '2-4') sawComponentChoice = true; return predicate(snapshot); };
    const unitsBefore = myUnits(s).map(unit => unit.id), itemsBefore = s.state.items.length, resultsBefore = s.state.roundResults.length;
    check(placed(s, 'bench') === 9 && placed(s, 'board') === s.state.level, `A enters 2-4 with bench and board full (bench ${placed(s, 'bench')}, board ${placed(s, 'board')}/${s.state.level}, gold ${s.state.gold}; ${myUnits(s).map(unit => `${unit.definitionId}*${unit.starLevel}`).join(' ')})`);
    check(s.m6.phase.kind === 'carousel' && s.m6.phase.roundName === '2-4', `2-4 runs as the carousel phase (${s.m6.phase.kind} ${s.m6.phase.roundName})`);
    check(cv.slots.length === 9 && cv.slots.every(slot => slot.items.length === 1 && slot.starLevel === 1 && slot.pickedBy === null), 'nine one-star units, one item each, none taken');
    const alive = s.m6.seats.filter(seat => seat.alive);
    const byHpThenSeat = [...alive].sort((x, y) => x.hp - y.hp || seatIndex.get(x.seatId) - seatIndex.get(y.seatId)).map(seat => seat.seatId);
    check(JSON.stringify(cv.releaseOrder) === JSON.stringify(byHpThenSeat), `release order: HP ascending, seat order on a tie (${alive.map(seat => `${seat.name}:${seat.hp}`).join(' ')})`);
    const releases = cv.releaseOrder.map(id => cv.releaseAtMs[id]);
    check(releases.every((at, index) => at === 6_000 + Math.floor(index / 2) * 6_000) && cv.deadlineMs === 30_000, `batches of two every 6 s from 6 s, deadline 30 s (${releases.join('/')})`);
    let r = await ring(a);
    check(r !== null && r.slots.length === 9 && r.batches.length === 4, `the ring shows 9 units and 4 release batches (${r?.batches.map(batch => batch.length).join('/')})`);
    if (cv.elapsedMs < cv.releaseAtMs[me]) check(!r.canPick && r.slots.every(slot => !slot.takable && slot.disabled), `before my batch nothing is takable (${r.status})`);
    check(s.m6.carouselSide === 'carousel', `the carousel opens on the ring (${s.m6.carouselSide})`);
    await a.screenshot({ path: `${OUT}/2-4-waiting.png` });

    /* P7-1: switch to my board and back while the carousel runs. */
    const takenBefore = r.slots.filter(slot => slot.taken).map(slot => slot.slot);
    await a.click('[data-debug="online:carousel-to-board"]');
    let b1 = await bar(a);
    s = await read(a);
    check(await ring(a) === null && b1 !== null && b1.body === 'board' && s.m6.carouselSide === 'board', `the switch hides the ring and shows the board with the bar (${JSON.stringify(b1)})`);
    check(/^\d+$/.test(b1?.timer ?? ''), `the bar keeps the countdown (${b1?.timer})`);
    if (!carouselOf(s).eligible) {
      check(!b1.myTurn && /放行|选秀/.test(b1.status), `before my batch the bar says when I am released ("${b1.status}")`);
      await sleep(1_200);
      const b2 = await bar(a);
      check(b2 && Number(b2.timer) < Number(b1.timer), `the bar countdown runs on the board side (${b1.timer} → ${b2?.timer})`);
    }
    await a.screenshot({ path: `${OUT}/2-4-board-side.png` });
    s = await waitRead(a, watch(s => carouselOf(s)?.eligible === true), 'my 2-4 release', 40_000);
    for (let wait = 0; wait < 30 && !(b1 = await bar(a))?.myTurn; wait++) await sleep(100); // the bar refreshes on the next frame
    check(b1?.myTurn === true && /轮到我/.test(b1.status), `my release shows "轮到我" on the board side ("${b1?.status}")`);
    await a.screenshot({ path: `${OUT}/2-4-board-my-turn.png` });
    await a.evaluate(() => (document.activeElement instanceof HTMLElement) && document.activeElement.blur());
    await a.keyboard.press('Space');
    s = await read(a);
    r = await ring(a);
    check(r !== null && await bar(a) === null && s.m6.carouselSide === 'carousel', 'Space brings the ring back and hides the bar');
    check(r?.slots.length === 9 && takenBefore.every(slot => r.slots.find(chip => chip.slot === slot)?.taken) && s.m6.carousel.id === cv.id,
      'the ring comes back with the same carousel and its taken slots');
    check(s.m6.seats.filter(seat => seat.kind === 'bot').length === bots.length, 'the seats and bots are unchanged by switching');
    r = await ring(a);
    const free = r.slots.filter(slot => !slot.taken);
    check(r.canPick && free.length > 0 && free.every(slot => slot.takable && !slot.disabled), `my batch: every free unit lights up (${free.length} takable, "${r.status}")`);
    await a.screenshot({ path: `${OUT}/2-4-my-turn.png` });
    // Under load my view may lag behind a pick another seat made: the server answers slot-taken and I click another one.
    let target = free[0], before = wire.mark(), receipt = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      before = wire.mark();
      await a.click(`[data-debug="online:carousel-slot:${target.slot}"]`);
      receipt = await wire.receiptSince(before, 'carousel-pick', 5_000);
      if (receipt !== 'refused:slot-taken') break;
      console.log(`note slot ${target.slot} was taken before my click reached the server; picking another`);
      await sleep(300); r = await ring(a);
      target = r.slots.find(slot => slot.takable) ?? target;
    }
    check(receipt === 'applied', `clicking slot ${target.slot} sends carousel-pick and the server applies it (${receipt})`);
    const sent = wire.commandsSince(before, 'carousel-pick')[0];
    check(sent && sent.carouselId === cv.id && sent.slot === target.slot && !('seatId' in sent), 'the command carries carouselId, revision and slot only');
    s = await waitRead(a, s => carouselOf(s)?.pickedSlot === target.slot, 'my pick in the view');
    r = await ring(a);
    check(r.slots.find(slot => slot.slot === target.slot)?.mine && !r.canPick, 'my slot shows as mine, nothing else is takable');
    // P7-1: bench and board full → the unit waits in the holding slot; its item is mine at once (my state push may follow the view).
    s = await pollRead(a, s => heldOf(s).length === 1 && s.state.items.length === itemsBefore + 1, 3_000) ?? await read(a);
    const held = heldOf(s)[0] ?? { unitId: null, definitionId: null };
    check(held.definitionId === target.definitionId && !myUnits(s).some(unit => unit.id === held.unitId), `the unit goes to my holding slot, not the bench or the board (${held.definitionId})`);
    check(JSON.stringify(myUnits(s).map(unit => unit.id).sort()) === JSON.stringify([...unitsBefore].sort()) && s.state.items.length === itemsBefore + 1,
      `bench and board unchanged, the item arrived (${itemsBefore} → ${s.state.items.length})`);
    const heldDuring = await holding(a);
    check(heldDuring === null || heldDuring.every(card => !card.sellable), `during the carousel the held unit cannot be sold (${JSON.stringify(heldDuring)})`);

    // Bots pick on their release; the dropped B and the idle C only at the deadline.
    s = await waitRead(a, watch(s => bots.every(id => carouselOf(s)?.autoPicked.includes(id)) || carouselOf(s)?.status === 'closed'), 'every bot picked', 40_000);
    cv = carouselOf(s);
    check(bots.every(id => cv.autoPicked.includes(id)) && cv.status === 'open' && cv.elapsedMs < cv.deadlineMs, `bots picked on release, before the deadline (${cv.autoPicked.join(' ')} at ${cv.elapsedMs} ms)`);
    check(!cv.slots.some(slot => slot.pickedBy === bSeat || slot.pickedBy === cSeat), 'B and C are not picked for before the deadline');
    r = await ring(a);
    const others = r.slots.filter(slot => slot.taken && !slot.mine);
    check(others.length >= bots.length && others.every(slot => slot.disabled), `units others took are greyed and not clickable (${others.length})`);
    s = await waitRead(a, watch(s => carouselOf(s)?.status === 'closed'), '2-4 deadline', 20_000);
    cv = carouselOf(s);
    check(cv.autoPicked.includes(bSeat) && cv.slots.some(slot => slot.pickedBy === bSeat), `at the deadline B (disconnected) is picked for (${bSeat})`);
    check(cv.autoPicked.includes(cSeat) && cv.slots.some(slot => slot.pickedBy === cSeat), `at the deadline C (connected, idle) is picked for (${cSeat})`);
    check(!cv.autoPicked.includes(me), 'my own pick is not marked automatic');
    r = await ring(a);
    check(r.slots.filter(slot => slot.auto).length === cv.autoPicked.length, 'auto picks are marked "自动" on the ring');
    check(cv.slots.filter(slot => slot.pickedBy !== null).length === 8, 'eight of nine units taken, one goes back to the pool');
    let cStatus = '';
    for (let wait = 0; wait < 15 && !/已自动选取/.test(cStatus); wait++) { cStatus = (await ring(c))?.status ?? ''; if (!/已自动选取/.test(cStatus)) await sleep(100); }
    check(/已自动选取/.test(cStatus), `C's ring says it was picked for ("${cStatus}")`);
    await a.screenshot({ path: `${OUT}/2-4-closed.png` });
    await c.screenshot({ path: `${OUT}/2-4-auto.png` });
    check(s.m6.phase.kind === 'carousel', 'the phase holds after the close (departure)');
    // Leave the closed carousel on the board side: the bar goes with it.
    await click(a, 'online:carousel-to-board');
    s = await waitRead(a, watch(s => s.m6.phase.kind !== 'carousel'), 'the end of the departure', 10_000);
    check(await bar(a) === null && s.m6.carouselSide === null && await ring(a) === null, 'the bar and the ring are gone with the carousel');
    s = await waitRead(a, watch(s => s.m6.phase.kind !== 'carousel' && s.state.roundResults.length > resultsBefore), '2-4 settled', 20_000);
    check(!sawComponentChoice, 'no component choice opened at 2-4 (the carousel replaces the supply)');
    check(s.state.roundResults.filter(result => result.roundId === '2-4').length === 1, '2-4 settled exactly once');

    /* ---------------- 2-5: the held unit moves in once a bench slot frees up ---------------- */
    s = await waitRead(a, s => s.m6.phase.kind === 'preparation' && s.state.roundDefinitionId === '2-5', '2-5 preparation', 30_000);
    let h = await holding(a);
    check(heldOf(s).length === 1 && heldOf(s)[0].unitId === held.unitId, `2-5 opens with the unit still held (bench ${placed(s, 'bench')}, board ${placed(s, 'board')}/${s.state.level})`);
    check(h?.length === 1 && h[0].unitId === held.unitId && /不参战/.test(h[0].idle) && h[0].sellable, `the holding slot shows it: idle, sellable in preparation (${JSON.stringify(h)})`);
    await a.screenshot({ path: `${OUT}/2-5-holding.png` });
    const sold = myUnits(s).find(unit => unit.location.kind === 'bench');
    await click(a, 'panel:units'); await sleep(80);
    const selected = await click(a, `mobile:unit:${sold.id}`);
    before = wire.mark();
    const sellClicked = selected && await click(a, 'mobile:sell');
    const sellReceipt = sellClicked ? await wire.receiptSince(before, 'sell', 5_000) : 'not-clicked';
    check(sellReceipt === 'applied', `selling bench unit ${sold.definitionId} is applied (${sellReceipt})`);
    s = await waitRead(a, s => heldOf(s).length === 0, 'the held unit moving in', 10_000);
    const moved = myUnits(s).find(unit => unit.id === held.unitId);
    check(moved?.location.kind === 'bench' && moved.location.slot === sold.location.slot, `the server moved the held unit into the freed bench slot (${JSON.stringify(moved?.location)})`);
    h = await holding(a);
    check(h === null, 'the holding slot is gone');
    await a.screenshot({ path: `${OUT}/2-5-moved-in.png` });
    check(errors.length === 0, `no page errors (${errors.slice(0, 3).join(' | ')})`);
  } finally {
    await browser.close().catch(() => {});
  }
}

main().then(() => { stopAll(); finish('P7 carousel'); }).catch(error => { console.error(error); stopAll(); process.exit(1); });
