/* Independent P-B5-31/P-B5-57 arithmetic (docs/MATCH_CONTRACT.md, 2026-10-27).
 * Observe from before the first H3 growth. Never seed expectations from growth
 * facts, readAugmentGrowth, production planners, restore, or server authority.
 * Inputs: observed seat rosters/items, round/settlement boundaries and checked
 * acquisition/merge facts. Retain detached checkpoints to catch joint edits.
 */
const assert = require('node:assert/strict');
const {isDeepStrictEqual} = require('node:util');
const {observedEqual,observedArray,extendObservedArray,identicalPrefix,freezeObservedNode,freezeObservation}=require('./observed-equal.cjs');
const IDS = ['no-scout-no-pivot', 'cooking-pot'];
const owners = s => s.augments.filter(a => IDS.includes(a.definitionId));
const roster = s => ({units:s.preparation.units.filter(u=>u.team==='player'),items:s.items});
const facts = s => s.augmentHistory?.facts ?? [];
const resources = s => s.resourceProvenance.entries;
const copy = structuredClone;
const order = (a,b) => a<b?-1:a>b?1:0;
const growthFields = ['healthFlat','healthBps','attackDamageBps','abilityPowerCenti'];
const zero = unitId => ({unitId,healthFlat:0,healthBps:0,attackDamageBps:0,abilityPowerCenti:0});
const receipt = f => ({kind:f.kind,seatId:f.seatId,round:f.round,roundId:f.roundId,choiceId:f.choiceId,receiptId:f.receiptId,deltas:f.deltas});
const checkpoint = s => ({roster:roster(s),round:s.round,roundId:s.roundDefinitionId,phase:s.phase,shop:s.shop,
  locked:!!s.multiplayer?.combatRosterLocked,roundKind:s.m8.round.kind,owners:owners(s),
  facts:facts(s),resources:resources(s),results:s.roundResults,receipts:s.multiplayer?.receipts??[]});
const histories = {facts:'facts',resources:'merge facts',results:'settlements',receipts:'online settlements'};
// References are only a fast path. Detached values remain the authority: a new
// reference (e.g. a restored/cloned test state) must still equal the old value.
// Copy the reference arrays themselves so splice/pop on a live array cannot
// also rewrite our remembered length/order. Never clone this cache as history.
const references = c => Object.fromEntries(Object.keys(histories).map(k=>[k,c[k].slice()]));
const current = c => Object.fromEntries(Object.entries(c).filter(([k])=>!(k in histories)));
function retained(old,refs,next,full,message,exact=false) {
  // sameRefs is only a construction hint for the detached snapshot. A shortened
  // or boundary journal still deep-equals here, and a replaced row that is not
  // identical still fails with the original whole-prefix diagnostic.
  let sameRefs=!full&&(exact?next.length===old.length:next.length>=old.length);
  if(full||(exact?next.length!==old.length:next.length<old.length))
    assert.deepEqual(exact?next:next.slice(0,old.length),old,message);
  else if(!(refs&&refs.length===old.length&&identicalPrefix(next,refs))){
    sameRefs=false;
    for(let i=0;i<old.length;i++)if(next[i]!==refs?.[i]&&!isDeepStrictEqual(next[i],old[i]))
      assert.deepEqual(next.slice(0,old.length),old,message);
  }
  return {rows:next.slice(old.length),sameRefs};
}
// Not part of the ledger value compared with the v25 baseline.
const journalStable=new WeakMap();
// Growth receipts are sparse. Remember the fact objects already classified so a
// deaths-only suffix is not filtered again. receipt() still reads the live
// objects, so an in-place delta edit fails the same assertion.
const growthFactsCache=new WeakMap();
function prefix(memory,c,key,full) {
  const kept=retained(memory.observed[key],memory.references?.[key],c[key],full,`H3 retained ${histories[key]}`);
  let flags=journalStable.get(memory);if(!flags)journalStable.set(memory,flags={});
  flags[key]=kept.sameRefs;
  return kept.rows;
}
function observe(memory,c,full) {
  if(full) { assert.deepEqual(c,memory.observed,'H3 independent observed checkpoint');return; }
  try {
    observedEqual(current(c),current(memory.observed),'H3 independent observed checkpoint');
    for(const k of Object.keys(histories))retained(memory.observed[k],memory.references?.[k],c[k],full,
      'H3 independent observed checkpoint',true);
  } catch(error) {
    // Keep the original whole-checkpoint diagnostic on the failure path.
    assert.deepEqual(c,memory.observed,'H3 independent observed checkpoint');throw error;
  }
}
// Read-only closing/checkpoint audit: the original whole detached checkpoint
// comparison, independent of reference-cache hits or round/phase/lock changes.
// Call at route ends (including truncated routes) and explicit reconnect points.
function auditH3(memory,state) {
  assert.deepEqual(checkpoint(state),memory.observed,'H3 independent observed checkpoint');
}
// Reuse only detached ORACLE-owned branches after the before observation and
// retained prefixes pass. Never adopt a live production node as an expectation.
function copyChanged(before,after,observed,freezeInputs) {
  if(before===after)return observed;
  if(after===null||typeof after!=='object')return after;
  if(Array.isArray(after)) {
    const snapshot=observedArray(after,(value,i)=>copyChanged(before?.[i],value,observed?.[i],freezeInputs),observed);
    if(freezeInputs&&after.length<=64)freezeObservedNode(after);
    return snapshot;
  }
  const snapshot=freezeObservation(Object.fromEntries(Object.keys(after).map(key=>[key,copyChanged(before?.[key],after[key],observed?.[key],freezeInputs)])),true);
  if(freezeInputs)freezeObservedNode(after);
  return snapshot;
}
function saveObserved(memory,before,c) {
  // Changed current branches use F5's detached observation reuse. Journal rows
  // retain their detached values even if a live reference was edited in place;
  // only the new suffix is cloned. A boundary or audit still compares all rows.
  // v26 records a deaths fact on every combat tick once history exists (a
  // history-owner augment, or a prismatic 4-2 offer). Rebuilding that whole
  // detached array each tick was quadratic. prefix() already proved a
  // reference-stable prefix, so those rows are reused and only the suffix is cloned.
  const observed=copyChanged(current(before),current(c),current(memory.observed),memory.freezeInputs);
  const stable=journalStable.get(memory);
  return freezeObservedNode({...observed,...Object.fromEntries(Object.keys(histories).map(k=>{
    const old=memory.observed[k],live=c[k],prev=before[k];
    let snapshot;
    if(live===prev&&live.length===old.length)snapshot=old;
    else if(stable?.[k]===true&&live.length>=old.length){
      if(live.length===old.length)snapshot=old;
      else{
        const suffix=[];
        for(let i=old.length;i<live.length;i++)suffix.push(copyChanged(undefined,live[i],undefined,memory.freezeInputs));
        snapshot=extendObservedArray(old,suffix);
      }
    }else snapshot=observedArray(live,(value,i)=>{
      if(i>=old.length)return copyChanged(undefined,value,undefined,memory.freezeInputs);
      if(memory.freezeInputs&&value!==prev?.[i])freezeObservation(value);
      return old[i];
    },old);
    if(memory.freezeInputs&&live!==prev&&live.length<=64)freezeObservedNode(live);
    return [k,snapshot];
  }))});
}

function createH3Ledger(initial,heroes,{freezeInputs=true}={}) {
  assert(!facts(initial).some(f=>f.kind==='growth'||f.kind==='pvp-roster'), 'H3 oracle needs an observed pre-growth origin');
  const actual=checkpoint(initial),observed=copy(actual);
  if(freezeInputs)freezeObservation(actual);freezeObservation(observed,true);
  return {kind:'h3-oracle-v1',freezeInputs,heroes:[...heroes],seatId:initial.multiplayer?.seatId??'solo',
    observed,references:references(actual),battles:[],merges:[],expected:[]};
}
// Odd-row offset -> doubled axial coordinates. Deliberately independent of board.ts.
function distance(a,b) {
  const dx=(2*a.col-a.row+(a.row%2))-(2*b.col-b.row+(b.row%2)),dy=a.row-b.row;
  return (Math.abs(dx)+Math.abs(2*dy)+Math.abs(dx+2*dy))/4;
}
function cooking(roster,heroes) {
  const units=roster.units.filter(u=>u.team==='player'&&u.location.kind==='board'&&heroes.includes(u.definitionId)),counts=new Map();
  for(const holder of units) {
    if(!roster.items.some(i=>['spatula','frying-pan'].includes(i.definitionId)&&i.location.kind==='unit'&&i.location.unitId===holder.id))continue;
    const target=units.filter(u=>u.id!==holder.id).sort((a,b)=>distance(holder.location.cell,a.location.cell)-distance(holder.location.cell,b.location.cell)||order(a.id,b.id))[0];
    if(target)counts.set(target.id,(counts.get(target.id)??0)+1);
  }
  return [...counts].sort(([a],[b])=>order(a,b)).map(([id,n])=>({...zero(id),healthFlat:50*n}));
}
function descendant(id,merges) { for(const e of merges)if(e.consumedIds.includes(id))id=e.survivorId;return id; }
function retention(u) {
  const l=u.location;return l?.kind==='board'?[0,l.cell.row,l.cell.col]:l?.kind==='bench'?[1,l.slot,0]:[2,0,0];
}
function compareUnits(a,b) { const x=retention(a),y=retention(b);return x[0]-y[0]||x[1]-y[1]||x[2]-y[2]||order(a.id,b.id); }
function checkedMerges(before,after,suffix) {
  const units=new Map(roster(before).units.map(u=>[u.id,copy(u)])),merges=[];
  for(const f of suffix) {
    if(f.kind==='unit-acquired') {
      let definitionId,starLevel=1;
      if(f.source.kind==='shop') {
        assert.equal(f.source.generation,before.shop.generation,'H3 merge acquisition generation');
        const offer=before.shop.slots[f.source.slotIndex];assert.equal(offer?.status,'available','H3 merge acquisition slot');
        definitionId=offer.definitionId;starLevel=offer.starLevel??1;
        assert.equal(f.source.definitionId,definitionId,'H3 merge acquisition definition');
        assert.equal(f.source.starLevel??1,starLevel,'H3 merge acquisition star');
      } else if(f.source.kind==='mechanic') {
        const r=after.seatMechanics?.receipts.find(r=>r.receiptId===f.source.receiptId&&r.kind==='unit'&&r.unitId===f.unitId);
        assert(r,'H3 merge acquisition gift');definitionId=r.definitionId;starLevel=r.starLevel??1;
      } else if(f.source.kind==='loot') {
        const r=after.m8.loot.receipts.find(r=>r.receiptId===f.source.receiptId&&r.grantedUnitIds.includes(f.unitId));
        assert(r,'H3 merge acquisition loot');definitionId=r.payload.definitionId;starLevel=r.payload.starLevel??1;
      } else if(f.source.kind==='carousel') {
        const r=after.carousel?.receipts.find(r=>r.id===f.source.receiptId&&r.unitId===f.unitId);
        assert(r,'H3 merge acquisition carousel');definitionId=r.definitionId;
      } else assert.fail('H3 unexpected opening acquisition');
      assert(!units.has(f.unitId),'H3 duplicate acquisition');
      units.set(f.unitId,{id:f.unitId,definitionId,starLevel,team:'player',location:null});
    }
    if(['unit-sold','unit-removed','anvil-opened'].includes(f.kind))units.delete(f.unitId);
    const upgrades=['unit-upgraded','unit-upgraded-after-combat'].includes(f.kind)?[f.event]:
      ['carousel-preparation-settled','carousel-unit-claimed'].includes(f.kind)?f.upgrades:[];
    for(const e of upgrades) {
      const ids=[e.survivorId,...e.consumedIds];
      assert.equal(ids.length,3,'H3 three merge candidates');assert.equal(new Set(ids).size,3,'H3 distinct merge candidates');
      assert([1,2].includes(e.fromStar)&&e.toStar===e.fromStar+1,'H3 merge star progression');
      for(const id of ids) { const u=units.get(id);assert(u&&u.definitionId===e.definitionId&&u.starLevel===e.fromStar,'H3 merge candidate lineage'); }
      const group=[...units.values()].filter(u=>u.definitionId===e.definitionId&&u.starLevel===e.fromStar&&
        !(before.multiplayer?.combatRosterLocked&&f.kind!=='unit-upgraded-after-combat'&&u.location?.kind==='board')).sort(compareUnits).slice(0,3);
      assert.equal(e.survivorId,group[0]?.id,'H3 independent merge survivor');
      assert.deepEqual(e.location,group[0]?.location,'H3 independent merge location');
      assert.deepEqual([...e.consumedIds].sort(),group.slice(1).map(u=>u.id).sort(),'H3 independent consumed candidates');
      units.set(e.survivorId,{...units.get(e.survivorId),starLevel:e.toStar});e.consumedIds.forEach(id=>units.delete(id));
      merges.push({event:copy(e),deferred:f.kind==='unit-upgraded-after-combat'});
    }
  }
  // Do not accept a forged merge plus a matching growth receipt without the actual survivor.
  if(merges.length)assert.deepEqual(new Map(roster(after).units.map(u=>[u.id,[u.definitionId,u.starLevel]])),
    new Map([...units].map(([id,u])=>[id,[u.definitionId,u.starLevel]])),'H3 merge resulting roster');
  return merges;
}
function checkH3Growth(memory,before,after,command) {
  // A phase change includes freeze/settlement/terminal boundaries, even when a
  // pending choice delays the round increment. Check BOTH sides before saving
  // anything, so a joint in-place edit cannot become the next trusted snapshot.
  const full=before.round!==after.round||before.phase!==after.phase||
    !!before.multiplayer?.combatRosterLocked!==!!after.multiplayer?.combatRosterLocked,
    beforeCheckpoint=checkpoint(before),afterCheckpoint=checkpoint(after);
  observe(memory,beforeCheckpoint,full);
  const added=prefix(memory,afterCheckpoint,'facts',full);
  const suffix=prefix(memory,afterCheckpoint,'resources',full);
  const settled=prefix(memory,afterCheckpoint,'results',full);
  const online=prefix(memory,afterCheckpoint,'receipts',full);
  assert.equal(after.multiplayer?.seatId??'solo',memory.seatId,'H3 observed seat');
  assert(settled.length<=1&&online.length<=1,'H3 one settlement per observation');
  for(const r of online)assert(settled.some(s=>s.settlementId===r.settlementId&&s.round===r.round),'H3 required online round result');
  const ending=s=>s.phase==='settlement'||s.phase==='gameOver'||s.phase==='choice'&&s.pendingChoice?.returnPhase==='settlement';
  if(owners(before).length&&before.round===after.round&&!ending(before)&&ending(after))
    assert.equal(settled.length,1,'H3 required settlement boundary');
  const next={...memory,battles:[...memory.battles],merges:[...memory.merges],expected:[...memory.expected]},newOwners=owners(after).filter(a=>!owners(before).some(b=>b.choiceId===a.choiceId));
  assert.deepEqual(owners(after).filter(a=>!newOwners.includes(a)),owners(before),'H3 retained owners');
  for(const a of newOwners) {
    assert(['select','choose'].includes(command?.type)&&command.definitionId===a.definitionId&&
      before.pendingChoice?.choiceId===a.choiceId&&before.pendingChoice.offers.includes(a.definitionId)&&a.acquiredRound===before.round,'H3 acquisition command');
  }
  if(owners(after).length)assert(after.augmentHistory,'H3 required history');
  for(const f of added) {
    assert.equal(f.sequence,facts(after).indexOf(f),'H3 fact sequence');assert.equal(f.seatId,memory.seatId,'H3 fact seat');
    assert.equal(f.round,after.round,'H3 fact round');assert.equal(f.roundId,after.roundDefinitionId,'H3 fact round ID');
    assert(Number.isInteger(f.resourcePrefix)&&f.resourcePrefix>=resources(before).length&&f.resourcePrefix<=resources(after).length,'H3 fact resource prefix');
  }
  const merges=owners(after).length?checkedMerges(before,after,suffix):[];
  // PvP observations are checked at the freeze boundary, then copied. Later live
  // bench purchases/equipment edits cannot change the eligible combat roster.
  const frozen=added.filter(f=>f.kind==='pvp-roster');
  const freezing=before.augmentHistory&&after.m8.round.kind==='pvp'&&(after.multiplayer
    ? !before.multiplayer?.combatRosterLocked&&after.multiplayer.combatRosterLocked
    : !before.combat&&after.combat);
  assert.equal(frozen.length,freezing?1:0,'H3 required PvP freeze boundary');
  for(const f of frozen) {
    assert.equal(after.m8.round.kind,'pvp','H3 PvP boundary');
    assert(!next.battles.some(b=>b.battleId===f.battleId||b.round===f.round),'H3 duplicate PvP freeze');
    const own=f.seats.filter(s=>s.seatId===memory.seatId);assert.equal(own.length,1,'H3 frozen seat');
    assert.deepEqual({units:own[0].units,items:own[0].items},roster(before),'H3 independent frozen roster');
    next.battles.push({battleId:f.battleId,round:before.round,roster:copy(roster(before))});
  }
  const entries=added.filter(f=>f.kind==='round-entry');
  if(after.round!==before.round&&before.augmentHistory) {
    assert.equal(after.round,before.round+1,'H3 natural entry');assert.equal(before.phase,'settlement','H3 entry after settlement');
    assert.equal(entries.length,1,'H3 required entry');assert.deepEqual(entries[0].roster,roster(before),'H3 independent entry equipment/roster');
  } else assert.equal(entries.length,0,'H3 unexpected entry');
  const add=(owner,key,deltas)=>next.expected.push({kind:'growth',seatId:memory.seatId,round:after.round,roundId:after.roundDefinitionId,choiceId:owner.choiceId,receiptId:JSON.stringify(key),deltas});
  const pot=owners(before).find(a=>a.definitionId==='cooking-pot');
  if(pot&&after.round>before.round&&pot.acquiredRound<after.round)add(pot,['cooking-pot',pot.choiceId,after.round],cooking(roster(before),memory.heroes));
  const scout=owners(before).find(a=>a.definitionId==='no-scout-no-pivot');
  for(const result of settled.filter(r=>r.roundKind==='pvp'))if(scout&&result.round>=scout.acquiredRound) {
    const b=next.battles.find(b=>b.round===result.round);assert(b,'H3 missing independently frozen PvP roster');
    if(after.multiplayer)assert(online.some(r=>r.round===result.round&&r.battleId===b.battleId&&r.settlementEligible),'H3 eligible online settlement');
    else assert.equal(after.combat?.combatId,b.battleId,'H3 settled battle');
    const lineage=[...memory.merges,...merges.filter(m=>!m.deferred).map(m=>m.event)],counts=new Map();
    for(const u of b.roster.units)if(u.team==='player'&&u.location.kind==='board'&&memory.heroes.includes(u.definitionId)) {
      const id=descendant(u.id,lineage);counts.set(id,(counts.get(id)??0)+1);
    }
    add(scout,['no-scout-no-pivot',scout.choiceId,b.battleId],[...counts].sort(([a],[b])=>order(a,b)).map(([id,n])=>({...zero(id),healthFlat:20*n,attackDamageBps:150*n,abilityPowerCenti:150*n})));
  }
  const liveFacts=facts(after),cachedGrowth=growthFactsCache.get(memory);
  let growthFacts;
  if(cachedGrowth&&identicalPrefix(liveFacts,cachedGrowth.facts)){
    growthFacts=cachedGrowth.rows;
    for(let i=cachedGrowth.facts.length;i<liveFacts.length;i++)if(liveFacts[i].kind==='growth')growthFacts=growthFacts.concat(liveFacts[i]);
  }else growthFacts=liveFacts.filter(f=>f.kind==='growth');
  assert.deepEqual(growthFacts.map(receipt),next.expected,'H3 independent complete growth receipts');
  growthFactsCache.set(next,{facts:liveFacts,rows:growthFacts});
  next.merges.push(...merges.map(m=>m.event));next.observed=saveObserved(memory,beforeCheckpoint,afterCheckpoint);
  next.references=references(afterCheckpoint);return next;
}
function h3GrowthForUnit(memory,unitId) {
  const value=zero(unitId);
  for(const f of memory.expected)for(const d of f.deltas)if(descendant(d.unitId,memory.merges)===unitId)
    for(const k of growthFields)value[k]+=d[k];
  return value;
}
module.exports={createH3Ledger,checkH3Growth,auditH3,h3GrowthForUnit};
