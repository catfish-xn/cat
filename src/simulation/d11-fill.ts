/** D11 compilers and exactly-once acquisition. Live combat and settlement are
 * wired by strategy-snapshot, combat-s13 and the common G23 facts envelope. */
import type { Effect, OwnedAugment } from './strategy-types';
import type { Unit } from './unit-types';
import type { MatchState } from './match-types';
import type { CombatEvent, CombatState, CombatBankSample } from './combat-types';
import type { UnitLootPolicy } from './loot-runtime';
import type { ItemProgram } from './m8/item-program';
import { amount, modifier, periodic } from './content/item-programs';
import { D11_FILL_SOURCE } from './content/d11-fill-source';
import type { D11AugmentId } from './content/d11-fill';
import { UNIT_DEFINITIONS } from './units';
import { SHOP_CATALOG_BY_COST } from './match-rules';
import { nextRandom } from './rng';
import { grantMechanicGold, grantMechanicUnit } from './seat-mechanics/grants';

const source = 'd11-fill';
const integer = (n:number) => {
  if (!Number.isSafeInteger(n) || n < 0) throw new RangeError('Invalid D11 input');
  return n;
};
const isChampion = (u:Unit) => !!UNIT_DEFINITIONS[u.definitionId] && !UNIT_DEFINITIONS[u.definitionId].summon
  && UNIT_DEFINITIONS[u.definitionId].unitKind !== 'neutral';
export interface D11UnitGrant { readonly unitId:string; readonly effects:readonly Effect[]; readonly program:ItemProgram }

/** Compile before resolveEffects, bind each returned program to the augment's
 * own source. Only Trifecta consumes the explicitly supplied opening stream.
 * Spirit Link samples player HP at combat start, as existing strategy inputs do. */
export function compileD11Augment(id:D11AugmentId, board:readonly Unit[], playerHp:number, openingRngState:number, maxPlayerHp=100):
  { readonly grants:readonly D11UnitGrant[]; readonly rngState:number; readonly rngDraws:number } {
  integer(playerHp); integer(openingRngState); integer(maxPlayerHp);
  if (playerHp > maxPlayerHp || openingRngState > 0xffffffff || new Set(board.map(u=>u.id)).size !== board.length)
    throw new RangeError('Invalid D11 opening');
  const allies = board.filter(u=>u.team==='player' && u.location.kind==='board').sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
  let rngState=openingRngState, rngDraws=0;
  const selected=new Set<string>();
  if (id==='trifecta-i') {
    const candidates=allies.filter(u=>isChampion(u)&&UNIT_DEFINITIONS[u.definitionId].cost===3).map(u=>u.id);
    for (let i=0;i<Math.min(D11_FILL_SOURCE[id].values.BuffedNumber,candidates.length);i++) {
      const draw=nextRandom(rngState); rngState=draw.state; rngDraws++;
      const j=i+draw.word%(candidates.length-i); [candidates[i],candidates[j]]=[candidates[j],candidates[i]];
      selected.add(candidates[i]);
    }
  }
  const uniqueOnes=new Set(allies.filter(u=>isChampion(u)&&UNIT_DEFINITIONS[u.definitionId].cost===1).map(u=>u.definitionId)).size;
  const grants=allies.map((u):D11UnitGrant=>{
    if (id==='all-for-one-i') {
      const v=D11_FILL_SOURCE[id].values;
      return {unitId:u.id,effects:[{kind:'statPercentBps',stat:'maxHp',bps:Math.round(v.PercHP*10000)*uniqueOnes}],
        program:{modifiers:[modifier('damageAmp',Math.round(v.DamageAmp*10000)*uniqueOnes,'bps')]}};
    }
    if (id==='trifecta-i') {
      const v=D11_FILL_SOURCE[id].values;
      return {unitId:u.id,effects:selected.has(u.id)?[{kind:'statFlat',stat:'maxHp',amount:v.Health},{kind:'attackSpeedBps',bps:Math.round(v.AttackSpeed*10000)}]:[],program:{}};
    }
    const v=D11_FILL_SOURCE['spirit-link'].values;
    // Raw gives 0.5 percentage points for every full ten missing HP. Integer
    // groups and start-of-combat sampling are explicit integration conventions.
    const bps=Math.round(v.BaseRegenBonus*10000)+Math.floor((maxPlayerHp-playerHp)/10)*Math.round(v.RegenPerMissingHP*100);
    return {unitId:u.id,effects:[],program:{periodic:[periodic(v.RegenPeriod*20,[{kind:'heal',amount:amount({maxHpBps:bps})}])]}};
  });
  return {grants,rngState,rngDraws};
}

export interface D11Gift { readonly receiptId:string; readonly definitionId:string }
/** Same source-bound independent planning model as P2; a full bench can retry
 * without changing the planned heroes or consuming any live RNG stream. */
export function d11GiftPlan(state:Pick<MatchState,'seed'|'multiplayer'>, a:OwnedAugment):readonly D11Gift[] {
  const tier=a.definitionId==='all-for-one-i'?1:a.definitionId==='trifecta-i'?3:null;
  if (tier===null) return [];
  const pool=[...SHOP_CATALOG_BY_COST[tier]].sort(), gifts:D11Gift[]=[];
  let hash=0x811c9dc5;
  for (const c of JSON.stringify([source,state.multiplayer?.seatId??'solo',a.choiceId,a.definitionId]))
    hash=Math.imul(hash^c.charCodeAt(0),0x01000193)>>>0;
  let rng=(state.seed^hash)>>>0;
  for (let i=0;i<2;i++) {
    const draw=nextRandom(rng);rng=draw.state;
    gifts.push({receiptId:JSON.stringify([source,a.choiceId,a.definitionId,'unit',i]),definitionId:pool[Math.floor(draw.word*pool.length/4294967296)]});
  }
  return gifts;
}
export function drainD11Gifts(initial:MatchState,a:OwnedAugment,policy?:UnitLootPolicy):MatchState {
  if (!initial.augments.some(owned=>owned.definitionId===a.definitionId&&owned.choiceId===a.choiceId&&owned.acquiredRound===a.acquiredRound)
    || a.acquiredRound>initial.round) throw new RangeError('D11 gift without acquisition');
  let state=initial,progressed:boolean;
  do {
    progressed=false;
    for (const gift of d11GiftPlan(state,a)) {
      if (state.seatMechanics?.receipts.some(r=>r.receiptId===gift.receiptId)) continue;
      const result=grantMechanicUnit(state,{...gift,source},policy);
      if(result.ok){state=result.state;progressed=true;}
      else if(result.reason!=='bench-full') throw new RangeError('Invalid D11 gift');
    }
  } while(progressed);
  return state;
}
export function drainAllD11Gifts(initial:MatchState,policy?:UnitLootPolicy):MatchState {
  return initial.augments.reduce((state,a)=>drainD11Gifts(state,a,policy),initial);
}
/** Validate gifts against the acquired identity and deterministic plan, including
 * after their hero was merged/sold. Resource provenance authenticates unit births. */
export function validateD11Acquisition(state:MatchState):void {
  const gifts=state.augments.flatMap(a=>d11GiftPlan(state,a).map(g=>({...g,round:a.acquiredRound})));
  const selected=state.scheduleReceipts.find(r=>r.kind==='anomaly'&&r.definitionId==='avarice-incarnate');
  const goldId=selected?JSON.stringify([source,selected.eventId,'avarice-gold']):null;
  const receipts=state.seatMechanics?.receipts??[];
  for(const r of receipts)if(r.source===source||r.receiptId.startsWith('["d11-fill",')){
    const gift=gifts.find(g=>g.receiptId===r.receiptId);
    if(r.source!==source||!(gift&&r.kind==='unit'&&r.definitionId===gift.definitionId&&r.round>=gift.round&&r.round<=state.round
      &&r.gold===(r.resolution==='gold'?UNIT_DEFINITIONS[r.definitionId].cost:0)
      ||r.receiptId===goldId&&r.kind==='gold'&&r.amount===D11_FILL_SOURCE['avarice-incarnate'].values.GoldCount&&r.round===selected!.round))
      throw new RangeError('Invalid D11 acquisition authority');
  }
  if(goldId&&!receipts.some(r=>r.receiptId===goldId))throw new RangeError('Missing D11 acquisition gold');
}
/** Dedicated opening stream: independent of the four Match streams and idempotent
 * under compilation/restore. Online choice IDs already include the seat namespace. */
export function d11OpeningSeed(seed:number,round:number,choiceId:string):number {
  let hash=(seed^0x6431316f^round)>>>0;
  for(const c of choiceId)hash=Math.imul(hash^c.charCodeAt(0),0x01000193)>>>0;
  return hash;
}
export function d11PriorKills(progress:import('./g2-3-match-progress').G23MatchProgress|undefined,boundRound:number):number {
  return progress?.economyReceipts.reduce((n,r)=>n+(r.kind==='battle'&&r.facts.round>=boundRound?(r.facts.d11Headhunter?.kills.length??0):0),0)??0;
}

/** Must be evaluated from live authoritative gold at each damage/stat sample.
 * Never cache at combat start: shops and combat item payouts change gold. */
export function d11AvariceDamageAmpBps(gold:number):number {
  integer(gold);const v=D11_FILL_SOURCE['avarice-incarnate'].values;
  return Math.min(v.GoldCap*100,v.FlatPercentDamage*100+Math.floor(gold/v.GoldIncrement)*Math.round(v.PercentDamage*10000));
}
/** Server-owned live bank sample before a tick. Deferred combat payouts are
 * already earned but not yet in Match.gold, so include them exactly once here.
 * Offline Match disallows trading during combat; online orchestration must pass
 * a fresh sample whenever its authoritative bank changes. No Match payout occurs. */
export function sampleD11CombatGold(combat:CombatState,team:'player'|'enemy',liveGold:number):CombatState {
  integer(liveGold);
  const allyIds=new Set(combat.units.filter(u=>u.team===team).map(u=>u.id));
  const earned=(combat.itemGoldReceipts??[]).filter(r=>allyIds.has(r.ownerId)&&r.gold).length
    +combat.units.filter(u=>u.team===team).reduce((n,u)=>n+(u.g23?.highRoller??[]).reduce((m,r)=>m+r.gold,0),0);
  let changed=false;
  const units=combat.units.map(u=>{
    if(u.team!==team||!u.mechanics?.some(m=>m.mechanic==='d11Anomaly'&&m.source.definitionId==='avarice-incarnate'))return u;
    const gold=integer(liveGold+earned);if(gold===u.currentItemBankGold)return u;
    changed=true;return {...u,currentItemBankGold:gold};
  });
  return changed?{...combat,units}:combat;
}
/** Validate an ordered private sample transcript before replay consumes it. */
export function validateD11BankSamples(samples:readonly CombatBankSample[]|undefined,endTick:number):void {
  if(samples===undefined)return;
  if(!Array.isArray(samples)||!samples.length||samples.length>100000)throw new RangeError('Invalid D11 bank samples');
  for(const [i,s] of samples.entries())if(!s||Object.keys(s).sort().join(',')!=='liveGold,team,tick'
    ||!Number.isSafeInteger(s.tick)||s.tick<0||s.tick>=endTick||i>0&&s.tick<samples[i-1].tick
    ||!['player','enemy'].includes(s.team)||!Number.isSafeInteger(s.liveGold)||s.liveGold<0)throw new RangeError('Invalid D11 bank samples');
}
export function grantD11AvariceGold(state:MatchState) {
  const binding=state.anomalyBinding;
  if(binding?.definitionId!=='avarice-incarnate') throw new RangeError('D11 gold without binding');
  return grantMechanicGold(state,{source,receiptId:JSON.stringify([source,binding.choiceId,'avarice-gold']),amount:D11_FILL_SOURCE['avarice-incarnate'].values.GoldCount});
}
export function d11HeadhunterAttackSpeedBps(verifiedKills:number):number {
  integer(verifiedKills);const v=D11_FILL_SOURCE.headhunter.values;
  return integer(v.StartingAS*100+Math.floor(verifiedKills/v.NumKills)*v.StackingAS*100);
}
/** One explicit sample, not a battle-wide cache. The integration layer must
 * refresh Avarice on gold changes and Headhunter on kills, including mid-combat. */
export function compileD11Anomaly(id:'avarice-incarnate'|'headhunter',fact:number):ItemProgram {
  return {modifiers:[id==='avarice-incarnate'?modifier('damageAmp',d11AvariceDamageAmpBps(fact),'bps')
    :modifier('attackSpeed',d11HeadhunterAttackSpeedBps(fact),'bps')]};
}
export interface D11KillReceipt { readonly combatId:string; readonly holderId:string; readonly kills:readonly { readonly eventSeq:number; readonly victimId:string }[] }
/** Pure settlement journal, supplied complete authoritative Combat events and
 * original roster. Summons, allies and assists do not count. Replays are inert;
 * a conflicting second receipt for the same holder/combat is rejected. */
export function recordD11HeadhunterKills(journal:readonly D11KillReceipt[],combatId:string,holderId:string,
  events:readonly CombatEvent[],roster:readonly Unit[]):readonly D11KillReceipt[] {
  if (!combatId || !holderId || !roster.some(u=>u.id===holderId)) throw new RangeError('Invalid D11 kill authority');
  const holder=roster.find(u=>u.id===holderId)!;
  const kills=new Map<number,string>();
  for (const e of events) {
    if(e.type!=='kill'||e.source.ownerId!==holderId) continue;
    if(e.combatId!==combatId || e.eventSeq===undefined) throw new RangeError('Missing D11 kill identity');
    integer(e.eventSeq);
    const target=roster.find(u=>u.id===e.unitId);
    if(!target || target.team===holder.team || !isChampion(target)) continue;
    if(kills.has(e.eventSeq)&&kills.get(e.eventSeq)!==target.id) throw new RangeError('Conflicting D11 kill event');
    kills.set(e.eventSeq,target.id);
  }
  // Reviving champions can die twice: deduplicate event identity, never victim ID.
  const recorded=[...kills].sort(([a],[b])=>a-b).map(([eventSeq,victimId])=>({eventSeq,victimId}));
  const prior=journal.find(r=>r.combatId===combatId&&r.holderId===holderId);
  if(prior){if(JSON.stringify(prior.kills)!==JSON.stringify(recorded))throw new RangeError('Conflicting D11 kill receipt');return journal;}
  return [...journal,{combatId,holderId,kills:recorded}];
}
