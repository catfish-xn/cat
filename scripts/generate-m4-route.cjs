/* Offline legal-route planner. Browser consumes this transcript only through real UI inputs. */
const assert = require('node:assert/strict');
const path = require('node:path');
module.exports = async function generateRoute() {
  const { createServer } = await import('vite');
  const server = await createServer({ root: path.resolve(__dirname, '..'), server: { middlewareMode: true, ws: false }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom' });
  try {
    const api = await server.ssrLoadModule('/src/simulation/match.ts');
    const { restoreMatch } = await server.ssrLoadModule('/src/simulation/serialization.ts');
    const { UNIT_DEFINITIONS } = await server.ssrLoadModule('/src/simulation/units.ts');
    const { deriveTraits } = await server.ssrLoadModule('/src/simulation/trait-snapshot.ts');
    const { expectedRound, expectedShop } = require('../tests/fixtures/m4/oracle.cjs');
    let state = api.createMatch(42); const initial = structuredClone(state), rounds = [], actions = [], allEvents = [];
    function dispatch(before, command) { return command.type === 'buy' ? api.buyUnit(before, command.slot, command.generation)
      : command.type === 'sell' ? api.sellUnit(before, command.id)
      : command.type === 'deploy' ? api.deployMatchUnit(before, command.id, command.target)
      : command.type === 'reroll' ? api.rerollShop(before) : command.type === 'buyXp' ? api.buyXp(before)
      : command.type === 'combine' ? api.combineItems(before, ...command.ids)
      : command.type === 'equip' ? api.equipItem(before, command.itemId, command.unitId, command.slot)
      : command.type === 'select' ? api.selectChoice(before, command.choiceId, command.generation, command.definitionId)
      : command.type === 'target' ? api.selectAnomalyTarget(before, command.choiceId, command.generation, command.unitId)
      : command.type === 'anomalyReroll' ? api.rerollAnomaly(before, command.choiceId, command.generation)
      : command.type === 'start' ? api.startMatchCombat(before) : api.nextRound(before, command.round); }
    function command(cmd, annotation) {
      const before = state, result = dispatch(state, cmd);
      assert(result.ok, `R${state.round} ${JSON.stringify(cmd)}: ${result.reason}`);
      state = result.state;
      assert.deepEqual(restoreMatch(JSON.stringify(state)), state, `restore after ${cmd.type}`);
      const entry = { command: cmd, annotation, before, after: state, events: result.events };
      actions.push(entry); allEvents.push(...result.events); return entry;
    }
    const buy = (slot, note) => command({ type: 'buy', slot, generation: state.shop.generation }, note);
    const deploy = (id, col, row = 4, note) => command({ type: 'deploy', id, target: { kind: 'board', cell: { col, row } } }, note);
    const select = (definitionId, note) => command({ type: 'select', choiceId: state.pendingChoice.choiceId, generation: state.pendingChoice.generation, definitionId }, note);
    let archerId, beaconId;
    while (state.phase !== 'gameOver' && state.round <= 20) {
      const actionStart = actions.length;
      while (state.phase === 'choice') {
        const choice = state.pendingChoice;
        if (choice.kind === 'augment') select(choice.offers[0], 'augment-confirmed');
        else if (choice.step === 'target') command({ type: 'target', choiceId: choice.choiceId, generation: choice.generation, unitId: 'unit-3' }, 'anomaly-target');
        else if (choice.rerollCount === 0) command({ type: 'anomalyReroll', choiceId: choice.choiceId, generation: choice.generation }, 'anomaly-paid-reroll');
        else select(choice.offers.includes('cycling-core') ? 'cycling-core' : choice.offers[0], 'anomaly-bound');
      }
      if (state.round === 1) {
        buy(0); buy(2, 'two-star-mystic'); buy(1, 'two-star-ranger');
        deploy('unit-1', 1); deploy('unit-2', 3); deploy('unit-3', 5, 4, 'trait-low-tier');
        command({ type: 'combine', ids: ['item-1','item-2'] }, 'normal-component-crafting');
        command({ type: 'equip', itemId: 'item-3', unitId: 'unit-3', slot: 0 }, 'equipment-carrier');
      }
      if (state.round === 2) {
        // Level3 round2 differs from level4: inspect the real deterministic shop before purchasing.
        for (const wanted of ['beacon','archer','binder']) {
          const slot = state.shop.slots.findIndex(x => x.definitionId === wanted);
          if (slot >= 0 && state.gold >= UNIT_DEFINITIONS[wanted].cost + 6) {
            const id = `unit-${state.nextUnitSerial}`; buy(slot, `trait-member-${wanted}`);
            if (wanted === 'beacon') beaconId = id; else archerId = id;
          }
        }
      }
      if ([2,4,6].includes(state.round)) {
        command({ type: 'reroll' }, `fast-chain-${state.round}-start`);
        const slot = state.shop.slots.findIndex(x => x.status === 'available' && UNIT_DEFINITIONS[x.definitionId].cost <= state.gold - 4
          && state.preparation.units.filter(u => u.team === 'player' && u.starLevel === 1 && u.definitionId === x.definitionId).length < 2);
        assert(slot >= 0, `affordable fast buy r${state.round}`);
        const id = `unit-${state.nextUnitSerial}`;
        buy(slot); command({ type: 'buyXp' }); command({ type: 'sell', id }, `fast-chain-${state.round}-end`);
      }
      // Buy two distinct conduit members from ordinary shops as population grows.
      for (const wanted of ['archer','binder','beacon']) {
        const distinct = new Set(state.preparation.units.filter(u=>u.team==='player').map(u=>u.definitionId));
        if ([...distinct].filter(id=>['sentinel','mystic','archer','binder','beacon','oracle'].includes(id)).length >= 4) break;
        const slot = state.shop.slots.findIndex(x=>x.definitionId===wanted);
        if (!distinct.has(wanted) && slot >= 0 && state.gold >= UNIT_DEFINITIONS[wanted].cost + (state.round < 7 ? 2 : 0)) {
          const id=`unit-${state.nextUnitSerial}`;buy(slot,`trait-member-${wanted}`);
          if(!beaconId)beaconId=id;else if(!archerId)archerId=id;
        }
      }
      for (const [id,col] of [[beaconId,2],[archerId,4]]) if(id) {
        const unit=state.preparation.units.find(u=>u.id===id);
        if(unit?.location.kind==='bench' && state.preparation.units.filter(u=>u.team==='player'&&u.location.kind==='board').length<state.level) deploy(id,col,5,'trait-population');
      }
      const traits = deriveTraits(state.preparation,'player');
      const before = state, start = command({ type:'start' },'start-combat');
      const atTick = new Map([[0,state]]), events=[...start.events];
      while(state.phase==='combat') { const next=api.stepMatch(state);state=next.state;assert.deepEqual(restoreMatch(JSON.stringify(state)),state); atTick.set(state.combat.tick,state);events.push(...next.events);allEvents.push(...next.events); }
      assert.deepEqual(state.roundResults.at(-1),expectedRound(before,state.combat));
      const settled=state;
      const preparationActions=actions.slice(actionStart,-1);
      let continuation;
      if(state.phase==='settlement') { continuation=command({type:'continue',round:state.round},'continue');assert.deepEqual({shop:state.shop,rngState:state.rngState},expectedShop(settled.rngState,settled.shop.generation+1,settled.level)); }
      rounds.push({ round:before.round, preparationActions,before,started:start.after,atTick,events,settled,continued:state,continuation,traits });
    }
    assert.equal(state.phase,'gameOver');
    assert(rounds.some(r=>r.traits.some(t=>t.traitId==='conduit'&&t.tier>=4)),'trait tier4');
    assert(rounds.filter(r=>r.round>=7&&r.started.anomalyBinding).length>=2,'two anomaly battles');
    return {initial,rounds,actions,allEvents,final:state};
  } finally {await server.close();}
};
if(require.main===module)module.exports().then(run=>console.log(JSON.stringify(run.rounds.map(r=>({round:r.round,hp:r.settled.playerHp,tick:r.settled.combat.tick,gold:r.settled.gold,traits:r.traits.filter(t=>t.tier).map(t=>[t.traitId,t.tier]),commands:r.preparationActions.map(a=>[a.command,a.annotation])})),null,2))).catch(e=>{console.error(e);process.exitCode=1});
