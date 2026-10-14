import { RULES_GAP_MANIFEST } from './content/rules-manifest';
import { canonicalContent, digestContent } from './content';
import { freezeContent } from './content/freeze';
import { LOOT_FREEZE_ALGORITHM, LOOT_CATEGORIES, LOOT_HERO_POOLS, LOOT_HERO_POOL_VERSION, LOOT_POLICY_VERSION } from './content/loot';
import { NEUTRAL_ENCOUNTERS, NEUTRAL_ENCOUNTER_CATALOG_VERSION, NEUTRAL_ENCOUNTER_POLICY_VERSION } from './content/neutral-encounters';
import { ROUND_CATALOG } from './content/round-catalog';
import { COMPONENT_POOL, COMPONENT_POOL_VERSION, validateComponentPool } from './component-pool';
import { ORB_RULES, ORB_SLOTS } from './content/orbs';
import { CONSUMABLE_RULES, CONSUMABLE_DEFINITIONS, REFORGE_POOLS } from './content/consumables';
import { EQUIPMENT_RULES_VERSION } from './equipment-policy';
import type { LootPayload, RngStream } from './m8/contracts';
import { lootOrbId, lootEntryId } from './loot-identity';
import type { FrozenDirectDrop, FrozenLootLedger, FrozenLootRound, OrbPlan } from './loot-types';
import { createOrbLayout, freezeOrbLayoutThroughRound, restoreOrbLayout, drawIndex, type OrbLayoutLedger } from './orb-layout';
import { validateSeed } from './rng';
import { OPENING_ECONOMY_RULES } from './match-rules';
export const LOOT_FREEZE_VERSION = 's13-orb-freeze-v1';
export { LOOT_FREEZE_ALGORITHM } from './content/loot';
export const LOOT_REPLAY_DIGEST = digestContent({
  rulesManifest: RULES_GAP_MANIFEST,
  version:LOOT_FREEZE_VERSION, algorithm:LOOT_FREEZE_ALGORITHM,
  policy:NEUTRAL_ENCOUNTER_POLICY_VERSION, openingPolicy:OPENING_ECONOMY_RULES.version, lootPolicy:LOOT_POLICY_VERSION,
  equipment:EQUIPMENT_RULES_VERSION, orbs:{rules:ORB_RULES,slots:ORB_SLOTS},
  consumables:{rules:CONSUMABLE_RULES,definitions:CONSUMABLE_DEFINITIONS,pools:REFORGE_POOLS},
  componentPool:{version:COMPONENT_POOL_VERSION,entries:COMPONENT_POOL},
  heroPools:{version:LOOT_HERO_POOL_VERSION,entries:LOOT_HERO_POOLS}, categories:LOOT_CATEGORIES,schedule:ROUND_CATALOG,
  encounters:{version:NEUTRAL_ENCOUNTER_CATALOG_VERSION,entries:NEUTRAL_ENCOUNTERS},
});
export const drawLootIndex=drawIndex;
function validateOrdinal(ordinal:number):void {
  if(!Number.isSafeInteger(ordinal)||ordinal<0||ordinal>ROUND_CATALOG.length)throw new RangeError('Invalid loot preparation boundary');
}
export function validateLootContent():void {
  validateComponentPool();
  if (Object.keys(ORB_SLOTS).length!==NEUTRAL_ENCOUNTERS.length)throw new RangeError('Invalid orb round set');
  for(const encounter of NEUTRAL_ENCOUNTERS) {
    const slots=ORB_SLOTS[encounter.roundId];
    if (!slots||slots.some(s=>!encounter.slots.some(u=>u.slotId===s.sourceSlotId))
      ||new Set(slots.map(s=>JSON.stringify([s.sourceSlotId,s.slotOrdinal]))).size!==slots.length)throw new RangeError('Invalid orb sources');
  }
}
validateLootContent();
/** Explicit layout is mandatory for shared callers. The optional standalone form uses its own seed. */
export function freezeLootThroughRound(seed:number,throughRoundOrdinal:number,layout?:OrbLayoutLedger):FrozenLootLedger {
  validateSeed(seed);validateOrdinal(throughRoundOrdinal);
  if (!layout) {
    const result=freezeOrbLayoutThroughRound(createOrbLayout(seed),throughRoundOrdinal);
    if(!result.ok)throw new RangeError(result.reason);layout=result.layout;
  }
  restoreOrbLayout(layout);
  if(layout.throughRoundOrdinal<throughRoundOrdinal)throw new RangeError('Missing orb layout boundary');
  let rng:RngStream={state:(seed^ORB_RULES.lootSeedXor)>>>0,draws:0};
  const rounds:FrozenLootRound[]=[];
  const draw=(n:number)=>{const r=drawIndex(rng,n);rng=r.rng;return r.index;};
  const component=():LootPayload=>({kind:'item',definitionId:COMPONENT_POOL[draw(8)].definitionId,quantity:1});
  const gold=(quantity:number):LootPayload=>({kind:'gold',quantity});
  const tool=(definitionId:'magnetic-remover'|'component-reforger'|'completed-reforger'):LootPayload=>({kind:'consumable',definitionId,quantity:1});
  const hero=(cost:1|2|3|4):LootPayload=>{const pool=LOOT_HERO_POOLS[cost];return {kind:'unit',definitionId:pool[draw(pool.length)][1],quantity:1};};
  for(const round of ROUND_CATALOG) {
    if(round.ordinal>throughRoundOrdinal)break;if(round.kind!=='pve')continue;
    const template=layout.rounds.find(r=>r.roundId===round.roundId);
    if(!template||template.encounterId!==round.encounterId)throw new RangeError('Missing orb template');
    const drops:FrozenDirectDrop[]=[],orbs:OrbPlan[]=[];
    for(const orb of template.orbs) {
      let payloads:LootPayload[];
      switch(orb.templateId) {
        case 'opening-unit':payloads=[hero(1),tool('magnetic-remover')];break;
        case 'component':payloads=[component()];break;
        case 'remover':payloads=[tool('magnetic-remover')];break;
        case 'opening-gold':payloads=[gold(3)];break;
        case 'blue-pair':payloads=[component(),component()];break;
        case 'gold-pair':payloads=[component(),component(),gold(4)];break;
        case 'prismatic-standard':payloads=[{kind:'item',definitionId:REFORGE_POOLS.completed[draw(36)].definitionId,quantity:1},
          gold(8),tool('component-reforger'),tool('completed-reforger')];break;
        case 'terminal':payloads=[gold(5),tool('magnetic-remover')];break;
        default:{
          if(!/^gray-[1-4]$/.test(orb.templateId))throw new RangeError('Invalid orb template');
          const cost=Number(orb.templateId.slice(-1)) as 1|2|3|4;let index=draw(100);
          const category=LOOT_CATEGORIES[cost].find(c=>{if(index<c.weight)return true;index-=c.weight;return false;})!;
          payloads=[category.payload.kind==='gold'?gold(category.payload.quantity):hero(category.payload.cost),tool('magnetic-remover')];
          const extra=draw(100);if(extra>=80)payloads.push(tool(extra<90?'component-reforger':'completed-reforger'));
        }
      }
      const orbId=lootOrbId(round.roundId,round.encounterId!,orb.sourceUnitId,orb.slotOrdinal);
      const entries:FrozenDirectDrop[]=payloads.map((payload,entryOrdinal)=>({roundId:round.roundId,encounterId:round.encounterId!,
        sourceUnitId:orb.sourceUnitId,slotOrdinal:orb.slotOrdinal,orbId,entryOrdinal,
        dropId:lootEntryId(orbId,entryOrdinal),payload,status:'planned',revealCondition:'source-killed',receiptId:null}));
      drops.push(...entries);orbs.push({orbId,roundId:round.roundId,encounterId:round.encounterId!,...orb,entries});
    }
    rounds.push({encounterPlan:{roundId:round.roundId,encounterId:round.encounterId!,policyVersion:NEUTRAL_ENCOUNTER_POLICY_VERSION,drops},choices:[],orbs});
  }
  return freezeContent({version:LOOT_FREEZE_VERSION,seed,replayDigest:LOOT_REPLAY_DIGEST,throughRoundOrdinal,rng,rounds});
}
export function restoreFrozenLootLedger(value:unknown,expected:{readonly seed:number;readonly throughRoundOrdinal:number;readonly layout?:OrbLayoutLedger}):FrozenLootLedger {
  const replay=freezeLootThroughRound(expected.seed,expected.throughRoundOrdinal,expected.layout);
  if(canonicalContent(value)!==canonicalContent(replay))throw new RangeError('Invalid frozen loot ledger');return replay;
}
export function advanceFrozenLootLedger(ledger:FrozenLootLedger,throughRoundOrdinal:number,layout?:OrbLayoutLedger):FrozenLootLedger {
  restoreFrozenLootLedger(ledger,{seed:ledger.seed,throughRoundOrdinal:ledger.throughRoundOrdinal,layout});validateOrdinal(throughRoundOrdinal);
  if(throughRoundOrdinal<ledger.throughRoundOrdinal)throw new RangeError('Cannot rewind loot preparation');
  if(throughRoundOrdinal===ledger.throughRoundOrdinal)return ledger;
  const replay=freezeLootThroughRound(ledger.seed,throughRoundOrdinal,layout);
  return freezeContent({...replay,rounds:[...ledger.rounds,...replay.rounds.slice(ledger.rounds.length)]});
}
