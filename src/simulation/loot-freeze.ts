import { canonicalContent, digestContent } from './content';
import { freezeContent } from './content/freeze';
import { LOOT_CATEGORIES, LOOT_HERO_POOLS, LOOT_HERO_POOL_VERSION, LOOT_POLICY_VERSION, LOOT_SLOTS } from './content/loot';
import { NEUTRAL_ENCOUNTERS, NEUTRAL_ENCOUNTER_CATALOG_VERSION, NEUTRAL_ENCOUNTER_POLICY_VERSION } from './content/neutral-encounters';
import { ROUND_CATALOG } from './content/round-catalog';
import { COMPONENT_POOL, COMPONENT_POOL_VERSION, validateComponentPool } from './component-pool';
import { compareCodePoints } from './m8/identity';
import type { LootPayload, RngStream } from './m8/contracts';
import { compareLootFreezeSlots, lootDropId } from './loot-identity';
import type { FrozenDirectDrop, FrozenLootLedger, FrozenLootRound, LootChoiceDescriptor } from './loot-types';
import { nextRandom, validateSeed } from './rng';
import { M5_UNIT_DEFINITIONS } from './units';

export const LOOT_FREEZE_VERSION = 'm8-b8-loot-freeze-v1';
/** Changing executable draw order/identity/rejection semantics requires this revision to change. */
export const LOOT_FREEZE_ALGORITHM = freezeContent({
  revision:'m8b-loot-freeze-v1', rng:'lcg32-v1', multiplier:1664525, increment:1013904223,
  seedXor:0xdeadbeef, sampling:'uint32-rejection-modulo', order:'sourceUnitId-codepoint/slotOrdinal-numeric',
  choiceOrder:'dropId-codepoint', choices:'full-pool/one-fallback-word',
});
export const LOOT_REPLAY_DIGEST = digestContent({
  version:LOOT_FREEZE_VERSION, algorithm:LOOT_FREEZE_ALGORITHM,
  policy:NEUTRAL_ENCOUNTER_POLICY_VERSION, openingPolicy:'m8b-opening-project-v1', lootPolicy:LOOT_POLICY_VERSION,
  componentPool:{version:COMPONENT_POOL_VERSION,entries:COMPONENT_POOL},
  heroPools:{version:LOOT_HERO_POOL_VERSION,entries:LOOT_HERO_POOLS},
  slots:LOOT_SLOTS,categories:LOOT_CATEGORIES,schedule:ROUND_CATALOG,
  encounters:{version:NEUTRAL_ENCOUNTER_CATALOG_VERSION,entries:NEUTRAL_ENCOUNTERS},
});

/** Rejection words count as draws. No shared Match, combat, equipment or shop stream. */
export function drawLootIndex(rng:RngStream, n:number):{readonly index:number;readonly rng:RngStream} {
  validateSeed(rng.state);
  if (!Number.isSafeInteger(rng.draws) || rng.draws<0 || !Number.isSafeInteger(n) || n<1 || n>0x100000000) throw new RangeError('Invalid loot draw');
  const limit=Math.floor(0x100000000/n)*n;
  let state=rng.state, draws=rng.draws;
  for (;;) {
    if (!Number.isSafeInteger(draws+1)) throw new RangeError('Loot draw counter overflow');
    const next=nextRandom(state); state=next.state; draws++;
    if(next.word<limit) return {index:next.word%n,rng:{state,draws}};
  }
}
function validateOrdinal(ordinal:number):void {
  if(!Number.isSafeInteger(ordinal) || ordinal<0 || ordinal>ROUND_CATALOG.length) throw new RangeError('Invalid loot preparation boundary');
}
/** Trusted content boundary. Pools remain fixed, even if a later hero catalog grows. */
export function validateLootContent():void {
  validateComponentPool();
  for(const cost of [1,2,3,4] as const) {
    const pool=LOOT_HERO_POOLS[cost], categories=LOOT_CATEGORIES[cost];
    if(new Set(pool.map(p=>p[0])).size!==pool.length || new Set(pool.map(p=>p[1])).size!==pool.length
      || pool.some(([api,id],i)=>!api || M5_UNIT_DEFINITIONS[id]?.cost!==cost || i>0 && compareCodePoints(pool[i-1][0],api)>=0)
      || categories.reduce((sum,c)=>sum+c.weight,0)!==100
      || categories.some((c,i)=>!Number.isSafeInteger(c.weight) || c.weight<=0 || i>0 && compareCodePoints(categories[i-1].id,c.id)>=0)) throw new RangeError('Invalid loot pool/categories');
  }
  if(Object.keys(LOOT_SLOTS).length!==NEUTRAL_ENCOUNTERS.length) throw new RangeError('Invalid loot round set');
  for(const encounter of NEUTRAL_ENCOUNTERS) {
    const round=ROUND_CATALOG.find(r=>r.roundId===encounter.roundId);
    const slots=LOOT_SLOTS[encounter.roundId];
    if(!round || round.kind!=='pve' || round.encounterId!==encounter.encounterId || !slots
      || new Set(slots.map(s=>JSON.stringify([s.sourceSlotId,s.slotOrdinal]))).size!==slots.length
      || slots.some(s=>!Number.isSafeInteger(s.slotOrdinal) || s.slotOrdinal<0 || !encounter.slots.some(u=>u.slotId===s.sourceSlotId))) throw new RangeError('Invalid loot source slots');
  }
}
validateLootContent();

/** Replay only from trusted seed + schedule boundary + fixed content. No stored output is an input. */
export function freezeLootThroughRound(seed:number, throughRoundOrdinal:number):FrozenLootLedger {
  validateSeed(seed); validateOrdinal(throughRoundOrdinal);
  let rng:RngStream={state:(seed^LOOT_FREEZE_ALGORITHM.seedXor)>>>0,draws:0};
  const rounds:FrozenLootRound[]=[];
  const draw=(n:number):number=>{const result=drawLootIndex(rng,n);rng=result.rng;return result.index;};
  const component=():string=>COMPONENT_POOL[draw(COMPONENT_POOL.length)].definitionId;
  for(const round of ROUND_CATALOG) {
    if(round.ordinal>throughRoundOrdinal) break;
    if(round.kind!=='pve') continue;
    const encounter=NEUTRAL_ENCOUNTERS.find(e=>e.roundId===round.roundId)!;
    const entries=LOOT_SLOTS[round.roundId].map(s=>({...s,sourceUnitId:JSON.stringify(['pve',round.roundId,encounter.encounterId,s.sourceSlotId])})).sort(compareLootFreezeSlots);
    const drops:FrozenDirectDrop[]=[], choices:LootChoiceDescriptor[]=[];
    for(const entry of entries) {
      const identity={roundId:round.roundId,encounterId:encounter.encounterId,sourceUnitId:entry.sourceUnitId,slotOrdinal:entry.slotOrdinal,
        dropId:lootDropId(round.roundId,encounter.encounterId,entry.sourceUnitId,entry.slotOrdinal)};
      const content=entry.content;
      if(content.kind==='component-choice') {
        choices.push({...identity,kind:'component-choice',quantity:1,poolVersion:COMPONENT_POOL_VERSION,
          terminalFallbackDefinitionId:component(),revealCondition:'source-killed'});
        continue;
      }
      let payload:LootPayload;
      if(content.kind==='fixed') payload={...content.payload};
      else if(content.kind==='random-component') payload={kind:'item',definitionId:component(),quantity:1};
      else {
        const categories=LOOT_CATEGORIES[content.cost]; let index=draw(100);
        const category=categories.find(c=>{if(index<c.weight)return true;index-=c.weight;return false;})!;
        if(category.payload.kind==='gold') payload={...category.payload};
        else {const pool=LOOT_HERO_POOLS[category.payload.cost];payload={kind:'unit',definitionId:pool[draw(pool.length)][1],quantity:1};}
      }
      drops.push({...identity,payload,status:'planned',revealCondition:'source-killed',receiptId:null});
    }
    rounds.push({encounterPlan:{roundId:round.roundId,encounterId:encounter.encounterId,policyVersion:NEUTRAL_ENCOUNTER_POLICY_VERSION,drops},choices});
  }
  return freezeContent({version:LOOT_FREEZE_VERSION,seed,replayDigest:LOOT_REPLAY_DIGEST,throughRoundOrdinal,rng,rounds});
}
/** Caller supplies the authoritative Match seed and entered-round boundary at future integration.
 * Accept only the exact replay, including statuses, identities, order, hidden fallback and RNG.
 * Never repairs corruption or uses saved payload/fallback/stream position as a replay oracle.
 */
export function restoreFrozenLootLedger(value:unknown, expected:{readonly seed:number;readonly throughRoundOrdinal:number}):FrozenLootLedger {
  const replay=freezeLootThroughRound(expected.seed,expected.throughRoundOrdinal);
  if(canonicalContent(value)!==canonicalContent(replay)) throw new RangeError('Invalid frozen loot ledger');
  return replay;
}
/** Pure preparation transition: repeats reuse the same immutable object; earlier boundaries fail. */
export function advanceFrozenLootLedger(ledger:FrozenLootLedger, throughRoundOrdinal:number):FrozenLootLedger {
  restoreFrozenLootLedger(ledger,{seed:ledger.seed,throughRoundOrdinal:ledger.throughRoundOrdinal});
  validateOrdinal(throughRoundOrdinal);
  if(throughRoundOrdinal<ledger.throughRoundOrdinal) throw new RangeError('Cannot rewind loot preparation');
  if(throughRoundOrdinal===ledger.throughRoundOrdinal) return ledger;
  const replay=freezeLootThroughRound(ledger.seed,throughRoundOrdinal);
  return freezeContent({...replay,rounds:[...ledger.rounds,...replay.rounds.slice(ledger.rounds.length)]});
}
