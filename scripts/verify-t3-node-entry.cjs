/** Build with build:server first; exercises only the shipped Node entry. */
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
async function main() {
  assert.equal(process.versions.node.split('.')[0], '22');
  for (const name of ['window', 'document', 'navigator', 'Phaser']) {
    Object.defineProperty(globalThis, name, { configurable: true, get() { throw new Error(`Browser global: ${name}`); } });
  }
  Math.random = () => { throw new Error('Implicit RNG'); };
  Date.now = () => { throw new Error('Implicit clock'); };
  const r = await import(pathToFileURL(path.resolve(__dirname, '../dist-server/index.mjs')).href);
  const accepted = result => { assert.equal(result.ok, true, result.reason); return result.state; };
  let state = accepted(r.enableMultiplayerSettlement(r.createMatch(5), 'A'));
  for (let steps = 0; state.roundDefinitionId !== '2-1' || state.phase === 'choice'; steps++) {
    assert.ok(steps < 4000);
    if (state.phase === 'choice') state = accepted(r.forfeitPendingChoice(state, state.round, state.pendingChoice.choiceId, state.pendingChoice.generation));
    else if (state.phase === 'preparation') state = accepted(r.startMatchCombat(state));
    else if (state.phase === 'combat') state = r.stepMatch(state).state;
    else state = accepted(r.nextRound(accepted(r.claimOrDiscardLoot(state, state.round)), state.round));
  }
  const b = {...state, multiplayer:{...state.multiplayer,seatId:'B'}};
  const battle = r.resolveTwoSidedBattle(r.compileBattle(r.snapshotForBattle(state,'A'),r.snapshotForBattle(b,'B'),42,{battleId:'node-t3'}),1201);
  const p = r.proposeSettlement(battle).a;
  const receipt = {version:r.ROUND_SETTLEMENT_VERSION,settlementId:'node-t3:A',battleId:battle.battleId,
    seatId:p.seatId,round:state.round,roundId:state.roundDefinitionId,settlementEligible:p.settlementEligible,
    result:p.result,damage:p.damage,baseDamage:p.baseDamage,opposingSurvivors:p.opposingSurvivors,growth:p.growth,
    combatTicks:battle.terminal.tick,combatEventCount:battle.events.length};
  const result = r.applyRoundSettlement(state,receipt), next = accepted(result);
  assert.equal(next.roundResults.length,4); assert.equal(result.events.length,1);
  assert.deepEqual(r.applyRoundSettlement(next,receipt),{ok:false,state:next,reason:'duplicate-settlement'});
  assert.equal(accepted(r.nextRound(next,4)).round,5);
  assert.equal(r.applyRoundSettlement(state,{...receipt,settlementEligible:false}).reason,'mirror-settlement');
  console.log(JSON.stringify({node:process.version,round:next.round,receipt:next.multiplayer.receipts[0].settlementId,
    checks:'public opening, timeout, T2 battle, T3 commit, dedupe, mirror rejection, next round, pure Node'}));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
