/**
 * G1-P7 shared carousel acceptance against the real game server (`?server=ws`, carousel on: the production default).
 * Two humans + six bots. Human A plays in the browser; human B joins and drops before the first carousel and stays away.
 *
 *   npm run build:game && node tests/server/e2e/p7-carousel.mjs
 *
 * 1-1 (opening prelude): the match opens on the carousel with no free unit, no gold and no component. The ring shows nine
 * units with their item; release is in batches of two (HP ascending, seat order on a tie), nothing is takable before my
 * batch, my batch lights the free units up, a click is applied by the server and the slot shows as mine, units others
 * took are greyed. Bots pick when released; the dropped player B is picked for at the deadline (marked "自动"). The phase
 * holds to the deadline + 2 s, then 1-2 preparation opens with exactly one unit and one item per seat and a dealt shop.
 * 2-4: the release order follows the public HP (ascending, seat order on a tie); no component choice opens; A does not
 * click and is picked for at the deadline with the "已自动选取" hint, B is picked for while disconnected, bots before the
 * deadline; the round settles once and A holds one more item.
 * P7-1 switch: before my 1-1 batch I switch to my board (button), the ring hides and a compact bar keeps the countdown;
 * my release turns the bar into "轮到我"; Space brings the ring back with the same carousel and slots, and the pick works
 * from there. A side left on the board does not carry into the next carousel (2-4 opens on the ring).
 * Screenshots go to artifacts/p7-carousel/ (not committed). P7_WS_PORT / P7_VITE_PORT override the ports.
 */
import { collectErrors, createChecks, joinOnline, launchBrowser, onlineUrl, outDir, pollRead, read, sleep, startGameServer, startVite, stopAll, trackCommands, waitRead } from './harness.mjs';

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
const myUnits = s => s.state.preparation.units.filter(unit => unit.team === 'player');
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
    collectErrors(a, errors, 'A');
    const wire = trackCommands(a);
    await joinOnline(a, onlineUrl(base, wsPort), '选手A', { startMatch: false });
    await joinOnline(b, onlineUrl(base, wsPort), '掉线B', { startMatch: false });
    await a.click('[data-debug="online:start"]');
    await waitRead(b, s => s.m6.mode === 'active', 'B sees the match start');
    const bSeat = await b.evaluate(() => document.querySelector('.online-seat.me')?.dataset.debug?.replace('online:seat:', ''));
    await bContext.close(); // B drops before any release and never comes back
    let s = await waitRead(a, s => s.m6.mode === 'active' && carouselOf(s) !== null, '1-1 carousel');
    const me = await a.evaluate(() => document.querySelector('.online-seat.me')?.dataset.debug?.replace('online:seat:', ''));
    const bots = s.m6.seats.filter(seat => seat.kind === 'bot').map(seat => seat.seatId);

    /* ---------------- 1-1 ---------------- */
    let c = carouselOf(s);
    check(s.m6.phase.kind === 'carousel' && c.roundId === '1-1', `the match opens on the 1-1 carousel (${s.m6.phase.kind} ${c.roundId})`);
    check(myUnits(s).length === 0 && s.state.gold === 0 && s.state.items.length === 0, `no free opening unit, 0 gold, 0 components (${myUnits(s).length} units, ${s.state.gold} gold, ${s.state.items.length} items)`);
    check(c.slots.length === 9 && c.slots.every(slot => slot.items.length === 1 && slot.starLevel === 1 && slot.pickedBy === null), 'nine one-star units, one item each, none taken');
    check(c.releaseOrder.length === 8 && c.deadlineMs === 30_000, `eight seats released, deadline 30 s (${c.deadlineMs})`);
    const seatIndex = new Map(s.m6.seats.map((seat, index) => [seat.seatId, index]));
    const byHpThenSeat = [...s.m6.seats].sort((x, y) => x.hp - y.hp || seatIndex.get(x.seatId) - seatIndex.get(y.seatId)).map(seat => seat.seatId);
    check(JSON.stringify(c.releaseOrder) === JSON.stringify(byHpThenSeat), `1-1 release order: HP ascending, seat order on a tie (${c.releaseOrder.join(' ')})`);
    const releases = c.releaseOrder.map(id => c.releaseAtMs[id]);
    check(releases.every((at, index) => at === 6_000 + Math.floor(index / 2) * 6_000), `batches of two every 6 s from 6 s (${releases.join('/')})`);
    let r = await ring(a);
    check(r !== null && r.slots.length === 9 && r.batches.length === 4, `the ring shows 9 units and 4 release batches (${r?.batches.map(batch => batch.length).join('/')})`);
    const myAt = c.releaseAtMs[me];
    if (c.elapsedMs < myAt) check(!r.canPick && r.slots.every(slot => !slot.takable && slot.disabled), `before my batch nothing is takable (${r.status})`);
    check(s.state.phase !== 'choice' && !s.state.pendingChoice, 'no component choice at the opening');
    await a.screenshot({ path: `${OUT}/1-1-waiting.png` });

    /* P7-1: switch to my board and back while the carousel runs. */
    check(s.m6.carouselSide === 'carousel', `the carousel opens on the ring (${s.m6.carouselSide})`);
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
    await a.screenshot({ path: `${OUT}/1-1-board-side.png` });
    s = await waitRead(a, s => carouselOf(s)?.eligible === true, 'my 1-1 release', 40_000);
    for (let wait = 0; wait < 30 && !(b1 = await bar(a))?.myTurn; wait++) await sleep(100); // the bar refreshes on the next frame
    check(b1?.myTurn === true && /轮到我/.test(b1.status), `my release shows "轮到我" on the board side ("${b1?.status}")`);
    await a.screenshot({ path: `${OUT}/1-1-board-my-turn.png` });
    await a.evaluate(() => (document.activeElement instanceof HTMLElement) && document.activeElement.blur());
    await a.keyboard.press('Space');
    s = await read(a);
    r = await ring(a);
    check(r !== null && await bar(a) === null && s.m6.carouselSide === 'carousel', 'Space brings the ring back and hides the bar');
    check(r?.slots.length === 9 && takenBefore.every(slot => r.slots.find(chip => chip.slot === slot)?.taken) && s.m6.carousel.id === c.id,
      'the ring comes back with the same carousel and its taken slots');
    check(s.m6.seats.filter(seat => seat.kind === 'bot').length === bots.length, 'the seats and bots are unchanged by switching');
    r = await ring(a);
    const free = r.slots.filter(slot => !slot.taken);
    check(r.canPick && free.length > 0 && free.every(slot => slot.takable && !slot.disabled), `my batch: every free unit lights up (${free.length} takable, "${r.status}")`);
    await a.screenshot({ path: `${OUT}/1-1-my-turn.png` });
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
    check(sent && sent.carouselId === c.id && sent.slot === target.slot && !('seatId' in sent), 'the command carries carouselId, revision and slot only');
    s = await waitRead(a, s => carouselOf(s)?.pickedSlot === target.slot, 'my pick in the view');
    r = await ring(a);
    check(r.slots.find(slot => slot.slot === target.slot)?.mine && !r.canPick, 'my slot shows as mine, nothing else is takable');
    check(myUnits(s).length === 1 && myUnits(s)[0].definitionId === target.definitionId && s.state.items.length === 1, `the unit and its item are mine at once (${myUnits(s).map(unit => unit.definitionId)})`);

    // Bots pick on their release; the dropped human only at the deadline.
    s = await waitRead(a, s => bots.every(id => carouselOf(s)?.autoPicked.includes(id)) || carouselOf(s)?.status === 'closed', 'every bot picked', 40_000);
    c = carouselOf(s);
    check(bots.every(id => c.autoPicked.includes(id)) && c.status === 'open' && c.elapsedMs < c.deadlineMs, `bots picked on release, before the deadline (${c.autoPicked.join(' ')} at ${c.elapsedMs} ms)`);
    check(!c.slots.some(slot => slot.pickedBy === bSeat), 'the dropped player B is not picked for before the deadline');
    r = await ring(a);
    const others = r.slots.filter(slot => slot.taken && !slot.mine);
    check(others.length >= bots.length && others.every(slot => slot.disabled), `units others took are greyed and not clickable (${others.length})`);
    s = await waitRead(a, s => carouselOf(s)?.status === 'closed', '1-1 deadline', 15_000);
    c = carouselOf(s);
    check(c.autoPicked.includes(bSeat) && c.slots.some(slot => slot.pickedBy === bSeat), `at the deadline B is picked for (${bSeat})`);
    r = await ring(a);
    check(r.slots.filter(slot => slot.auto).length === c.autoPicked.length, 'auto picks are marked "自动" on the ring');
    check(c.slots.filter(slot => slot.pickedBy !== null).length === 8, 'eight of nine units taken, one goes back to the pool');
    await a.screenshot({ path: `${OUT}/1-1-closed.png` });
    check(s.m6.phase.kind === 'carousel', 'the phase holds after the close (departure)');
    // Leave the closed carousel on the board side: the bar goes with it, and the next carousel opens on the ring again.
    await a.click('[data-debug="online:carousel-to-board"]').catch(() => {});
    s = await waitRead(a, s => s.m6.phase.kind === 'preparation', '1-2 preparation', 10_000);
    check(await bar(a) === null && s.m6.carouselSide === null, 'the bar is gone with the carousel');
    check(s.state.roundDefinitionId === '1-2' && myUnits(s).length === 1 && s.state.items.length === 1, `1-2 opens with exactly my carousel unit and item (${myUnits(s).length}/${s.state.items.length})`);
    check(s.state.shop.slots.length > 0 && s.state.shop.generation > 0, 'the first shop is dealt after the carousel');
    check(await ring(a) === null, 'the carousel panel is gone');

    /* ---------------- up to 2-4 ---------------- */
    const answered = new Set();
    let sawComponentChoice = false;
    const until = Date.now() + 8 * 60_000;
    for (;;) {
      s = await read(a).catch(() => null);
      if (Date.now() > until) throw new Error(`2-4 carousel never opened (${s?.m6?.phase?.roundName})`);
      if (!s?.state || !s.m6?.phase) { await sleep(150); continue; }
      if (s.m6.phase.kind === 'ended') throw new Error('the match ended before 2-4');
      if (carouselOf(s)?.roundId === '2-4') break;
      const choice = s.state.phase === 'choice' ? s.state.pendingChoice : null;
      if (choice && !answered.has(`${choice.choiceId}:${choice.generation}`)) {
        answered.add(`${choice.choiceId}:${choice.generation}`);
        await a.evaluate(id => document.querySelector(`[data-debug="choice:${id}"]`)?.click(), choice.offers[0]);
      }
      await sleep(150);
    }

    /* ---------------- 2-4 ---------------- */
    c = carouselOf(s);
    const itemsBefore = s.state.items.length, resultsBefore = s.state.roundResults.length;
    const alive = s.m6.seats.filter(seat => seat.alive);
    const expected = [...alive].sort((x, y) => x.hp - y.hp || seatIndex.get(x.seatId) - seatIndex.get(y.seatId)).map(seat => seat.seatId);
    check(JSON.stringify(c.releaseOrder) === JSON.stringify(expected), `2-4 release order follows HP (${alive.map(seat => `${seat.name}:${seat.hp}`).join(' ')})`);
    check(c.slots.length === 9 && c.slots.every(slot => slot.items.length === 1), '2-4 ring: nine units, one item each');
    check(s.m6.carouselSide === 'carousel' && await ring(a) !== null, `2-4 opens on the ring, not on the side left at 1-1 (${s.m6.carouselSide})`);
    await a.screenshot({ path: `${OUT}/2-4-open.png` });
    // A does not click this time.
    for (;;) {
      s = await read(a).catch(() => null);
      if (s?.state?.phase === 'choice' && s.state.roundDefinitionId === '2-4') sawComponentChoice = true;
      const now = carouselOf(s);
      if (!now || now.status === 'closed') break;
      if (now.elapsedMs < now.deadlineMs) {
        const unattended = alive.filter(seat => seat.kind === 'bot' && now.releaseAtMs[seat.seatId] <= now.elapsedMs);
        if (unattended.some(seat => !now.autoPicked.includes(seat.seatId))) check(false, 'a released bot waits for the deadline');
      }
      await sleep(200);
    }
    c = carouselOf(s);
    check(c && c.status === 'closed', '2-4 carousel closed at its deadline');
    if (c) {
      check(c.autoPicked.includes(me) && c.pickedSlot !== null, `A did not click and was picked for (${c.pickedSlot})`);
      check(alive.some(seat => seat.seatId === bSeat) ? c.autoPicked.includes(bSeat) : true, 'the disconnected seat B was picked for');
      check(alive.filter(seat => seat.kind === 'bot').every(seat => c.autoPicked.includes(seat.seatId)), 'every alive bot picked');
      const status = (await ring(a))?.status ?? '';
      check(/已自动选取/.test(status), `the auto-pick hint shows ("${status}")`);
      await a.screenshot({ path: `${OUT}/2-4-auto.png` });
    }
    check(!sawComponentChoice, 'no component choice opened at 2-4 (the carousel replaces the supply)');
    s = await waitRead(a, s => s.m6.phase.kind !== 'carousel' && s.state.roundResults.length > resultsBefore, '2-4 settled', 20_000);
    check(s.state.items.length >= itemsBefore + 1, `my carousel item arrived (${itemsBefore} → ${s.state.items.length})`);
    check(s.state.roundResults.filter(result => result.roundId === '2-4').length === 1, '2-4 settled exactly once');
    check(await pollRead(a, s => s.m6.phase.kind === 'preparation' && s.state.roundDefinitionId === '2-5', 30_000) !== null, 'the match goes on to 2-5');
    check(errors.length === 0, `no page errors (${errors.slice(0, 3).join(' | ')})`);
  } finally {
    await browser.close().catch(() => {});
  }
}

main().then(() => { stopAll(); finish('P7 carousel'); }).catch(error => { console.error(error); stopAll(); process.exit(1); });
