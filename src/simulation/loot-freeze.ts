import { sampleOrbBox } from './orb-box';
import { EPIC_LOOT } from './content/loot';
import { ANVIL_POLICY } from './content/anvils';
import { SHOP_CATALOG_BY_COST } from './match-rules';
import type { ConsumableDefinitionId } from './consumable-types';
import { isImmutableJson, shareGeneratedJson } from './immutable-json';
import { canonicalContent, equalValidatedContent } from './content';
import { freezeContent } from './content/freeze';
import { NEUTRAL_ENCOUNTERS, NEUTRAL_ENCOUNTER_POLICY_VERSION } from './content/neutral-encounters';
import { ROUND_CATALOG } from './content/round-catalog';
import { validateComponentPool } from './component-pool';
import { ORB_RULES, EPIC_SOURCES } from './content/orbs';
import type { LootPayload, RngStream } from './m8/contracts';
import { lootOrbId, lootEntryId } from './loot-identity';
import type { FrozenDirectDrop, FrozenLootLedger, FrozenLootRound, OrbPlan } from './loot-types';
import { createOrbLayout, freezeOrbLayoutThroughRound, restoreOrbLayout, drawIndex, type OrbLayoutLedger } from './orb-layout';
import { validateSeed } from './rng';
import { LOOT_REPLAY_DIGEST } from './content/identity-constants';
export const LOOT_FREEZE_VERSION = 's13-orb-freeze-v17';
export { LOOT_FREEZE_ALGORITHM } from './content/loot';
export { LOOT_REPLAY_DIGEST };
export const drawLootIndex=drawIndex;
// Pair by layout identity as well as seat seed/boundary. Replacing either side
// (including JSON restore or structuredClone) always takes the full check.
// Canonical text is memoized only for private, generated frozen references.
const referenceText = new WeakMap<object, string>();
function canonicalReference(value: object): string {
  let text = referenceText.get(value);
  if (text === undefined) { text = canonicalContent(value); referenceText.set(value, text); }
  return text;
}
const verifiedLedgers = new WeakMap<object, WeakSet<OrbLayoutLedger>>();
export function matchesFrozenLootLedger(ledger: FrozenLootLedger, seed: number, ordinal: number, layout: OrbLayoutLedger): boolean {
  if (ledger.seed !== seed || ledger.throughRoundOrdinal !== ordinal) return false;
  if (verifiedLedgers.get(ledger)?.has(layout)) return true;
  const expected = freezeLootThroughRound(seed, ordinal, layout);
  if (canonicalContent(ledger) !== canonicalReference(expected)) return false;
  if (isImmutableJson(ledger) && isImmutableJson(layout)) {
    let layouts = verifiedLedgers.get(ledger);
    if (!layouts) { layouts = new WeakSet(); verifiedLedgers.set(ledger, layouts); }
    layouts.add(layout);
  }
  return true;
}
function validateOrdinal(ordinal:number):void {
  if(!Number.isSafeInteger(ordinal)||ordinal<0||ordinal>ROUND_CATALOG.length)throw new RangeError('Invalid loot preparation boundary');
}
export function validateLootContent():void {
  validateComponentPool();
  if (NEUTRAL_ENCOUNTERS.length!==8)throw new RangeError('Invalid orb round set');
  for(const encounter of NEUTRAL_ENCOUNTERS) {
    const epic=EPIC_SOURCES[encounter.roundId as keyof typeof EPIC_SOURCES];
    if (!encounter.slots.length||new Set(encounter.slots.map(s=>s.slotId)).size!==encounter.slots.length
      ||(epic&&!encounter.slots.some(s=>s.slotId===epic)))throw new RangeError('Invalid orb sources');
  }
}
validateLootContent();
// Only restoreOrbLayout's authenticated immutable reference is used as a key.
// Mutable/JSON input layouts are still authenticated on every call.
const replayedLoot = new WeakMap<OrbLayoutLedger, Map<string, FrozenLootLedger>>();
/** Explicit layout is mandatory for shared callers. The optional standalone form uses its own seed. */
export function freezeLootThroughRound(seed:number,throughRoundOrdinal:number,layout?:OrbLayoutLedger):FrozenLootLedger {
  validateSeed(seed);validateOrdinal(throughRoundOrdinal);
  if (!layout) {
    const result=freezeOrbLayoutThroughRound(createOrbLayout(seed),throughRoundOrdinal);
    if(!result.ok)throw new RangeError(result.reason);layout=result.layout;
  }
  layout = restoreOrbLayout(layout);
  const cacheKey = `${Object.is(seed, -0) ? '-0' : seed}:${Object.is(throughRoundOrdinal, -0) ? '-0' : throughRoundOrdinal}`;
  const cached = replayedLoot.get(layout)?.get(cacheKey);
  if (cached) return cached;
  if(layout.throughRoundOrdinal<throughRoundOrdinal)throw new RangeError('Missing orb layout boundary');
  let rng:RngStream={state:(seed^ORB_RULES.lootSeedXor)>>>0,draws:0};
  const rounds:FrozenLootRound[]=[];
  const draw=(n:number)=>{const r=drawIndex(rng,n);rng=r.rng;return r.index;};
  const gold=(quantity:number):LootPayload=>({kind:'gold',quantity});
  const tool=(definitionId:ConsumableDefinitionId):LootPayload=>({kind:'consumable',definitionId,quantity:1});
  const epicHero=(cost:2|3|4):LootPayload=>({kind:'unit',definitionId:SHOP_CATALOG_BY_COST[cost][draw(SHOP_CATALOG_BY_COST[cost].length)],quantity:1});
  const select=<T extends {readonly weight:number}>(rows:readonly T[],size:number):T=>{let index=draw(size);for(const row of rows){if(index<row.weight)return row;index-=row.weight;}throw new RangeError('Invalid reward weights');};
  const box=(id:string):LootPayload[]=>{
    switch(id){
      case 'three-cost':return [epicHero(3)];
      case 'two-cost-gold':return [epicHero(2),gold(1)];
      case 'four-cost-gold':return [epicHero(4),gold(4)];
      case 'three-cost-pair':return [epicHero(3),epicHero(3),gold(2)];
      case 'copper-reforger':return [gold(3),tool('reforger')];
      case 'silver-reforger':return [gold(8),tool('reforger')];
      case 'remover':return [gold(3),tool('magnetic-remover')];
      case 'lesser':return [tool('TFT_Consumable_ChampionDuplicator_III')];
      case 'duplicator':return [gold(3),tool('TFT_Consumable_NeekosHelp')];
      default:throw new RangeError('Invalid box');
    }
  };
  for(const round of ROUND_CATALOG) {
    if(round.ordinal>throughRoundOrdinal)break;if(round.kind!=='pve')continue;
    const template=layout.rounds.find(r=>r.roundId===round.roundId);
    if(!template||template.encounterId!==round.encounterId)throw new RangeError('Missing orb template');
    const drops:FrozenDirectDrop[]=[],orbs:OrbPlan[]=[];
    const add=(orb:typeof template.orbs[number],payloads:LootPayload[])=>{
      const orbId=lootOrbId(round.roundId,round.encounterId!,orb.sourceUnitId,orb.slotOrdinal);
      const entries:FrozenDirectDrop[]=payloads.map((payload,entryOrdinal)=>({roundId:round.roundId,encounterId:round.encounterId!,
        sourceUnitId:orb.sourceUnitId,slotOrdinal:orb.slotOrdinal,orbId,entryOrdinal,
        dropId:lootEntryId(orbId,entryOrdinal),payload,status:'planned',revealCondition:'source-killed',receiptId:null}));
      drops.push(...entries);orbs.push({orbId,roundId:round.roundId,encounterId:round.encounterId!,...orb,entries});
    };
    for(const orb of template.orbs) {
      if(orb.templateId==='epic-reward'){
        const variant=select(EPIC_LOOT.variants,1000).id;
        // Freeze all box rows before drawing any hero; silver boxes are independent.
        const copper=variant==='crown'?null:select(EPIC_LOOT.copper,100).id;
        const silvers=Array.from({length:variant==='crown'?2:1},()=>select(EPIC_LOOT.silver,100).id);
        let slotOrdinal=0;
        const group=(tier:import('./orb-layout').OrbTier,templateId:string,payloads:LootPayload[])=>add({...orb,slotOrdinal:slotOrdinal++,tier,templateId},payloads);
        if(variant==='crown')group('gold','epic-crown',[{kind:'item',definitionId:'TFT_Item_ForceOfNature',quantity:1}]);
        else {
          group('gold','epic-completed-forge',[{kind:'forge',definitionId:'TFT_ArmoryKeyCompleted',quantity:1}]);
          if(variant==='artifact')group('gold','epic-artifact-forge',[{kind:'forge',definitionId:'TFT_ArmoryKeyOrnn',quantity:1}]);
          group('gray','epic-copper',box(copper==='reforger'?'copper-reforger':copper!));
        }
        for(const silver of silvers)group('blue','epic-silver',box(silver==='reforger'?'silver-reforger':silver));
        continue;
      }
      const orbId=lootOrbId(round.roundId,round.encounterId!,orb.sourceUnitId,orb.slotOrdinal);
      const payloads = sampleOrbBox(seed,orbId,orb.templateId).payloads;
      // Approved project rule: append after sampling, preserving all original entries/IDs and RNG streams.
      const fixed = ANVIL_POLICY.component47;
      add(orb,round.roundId === fixed.roundId && orb === template.orbs[0]
        ? [...payloads,{kind:'forge',definitionId:fixed.definitionId,quantity:fixed.quantity}]
        : payloads);
    }
    rounds.push({encounterPlan:{roundId:round.roundId,encounterId:round.encounterId!,policyVersion:NEUTRAL_ENCOUNTER_POLICY_VERSION,drops},choices:[],orbs});
  }
  const ledger: FrozenLootLedger = shareGeneratedJson({version:LOOT_FREEZE_VERSION,seed,replayDigest:LOOT_REPLAY_DIGEST,throughRoundOrdinal,rng,rounds});
  let references = replayedLoot.get(layout);
  if (!references) { references = new Map(); replayedLoot.set(layout, references); }
  // Bound seats/seeds per live layout as well as the layout reference cache.
  if (references.size >= 64) references.delete(references.keys().next().value!);
  references.set(cacheKey, ledger);
  return ledger;
}
export function restoreFrozenLootLedger(value:unknown,expected:{readonly seed:number;readonly throughRoundOrdinal:number;readonly layout?:OrbLayoutLedger}, parsedJsonInput = false):FrozenLootLedger {
  const layout = parsedJsonInput && expected.layout ? restoreOrbLayout(expected.layout, true) : expected.layout;
  const replay=freezeLootThroughRound(expected.seed,expected.throughRoundOrdinal,layout);

  if(parsedJsonInput ? !equalValidatedContent(value, replay) : canonicalContent(value)!==canonicalReference(replay))throw new RangeError('Invalid frozen loot ledger');return replay;
}
export function advanceFrozenLootLedger(ledger:FrozenLootLedger,throughRoundOrdinal:number,layout?:OrbLayoutLedger):FrozenLootLedger {
  restoreFrozenLootLedger(ledger,{seed:ledger.seed,throughRoundOrdinal:ledger.throughRoundOrdinal,layout});validateOrdinal(throughRoundOrdinal);
  if(throughRoundOrdinal<ledger.throughRoundOrdinal)throw new RangeError('Cannot rewind loot preparation');
  if(throughRoundOrdinal===ledger.throughRoundOrdinal)return ledger;
  const replay=freezeLootThroughRound(ledger.seed,throughRoundOrdinal,layout);
  return freezeContent({...replay,rounds:[...ledger.rounds,...replay.rounds.slice(ledger.rounds.length)]});
}
