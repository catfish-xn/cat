import { freezeContent } from './freeze';
import type { LootPayload } from '../m8/contracts';
import type { ConsumableDefinitionId } from '../consumable-types';

/** 14.24b archived tables plus approved project conventions, M8B_LOOT §12. */
export const LOOT_POLICY_VERSION = 's13-orbs-project-v17';

/** Changing executable draw order/identity/rejection semantics requires this revision to change. */
export const LOOT_FREEZE_ALGORITHM = freezeContent({
  revision:'s13-orb-freeze-v17', rng:'lcg32-v1', multiplier:1664525, increment:1013904223,
  seedXor:0xdeadbeef, sampling:'uint32-rejection-modulo', order:'sourceUnitId-codepoint/slotOrdinal-numeric',
  legacyStreamUse:'stage5-6-epic-only',planStream:'orb-stage-plan-v17',boxStream:'orb-box-v17',
  choiceOrder:'dropId-codepoint', choices:'supply-only/no-pve-fallback',
});
export const LOOT_RUNTIME_REVISION = 'orb-combo-v17';
/** User approved 14.24 reward tables. Rows with zero weight are deliberately absent. */
export const EPIC_LOOT = freezeContent({
  variants:[{id:'standard',weight:899},{id:'artifact',weight:100},{id:'crown',weight:1}],
  copper:[{id:'three-cost',weight:49},{id:'two-cost-gold',weight:46},{id:'reforger',weight:3},{id:'remover',weight:1},{id:'lesser',weight:1}],
  silver:[{id:'four-cost-gold',weight:49},{id:'three-cost-pair',weight:47},{id:'reforger',weight:3},{id:'duplicator',weight:1}],
  heroPool:'all-live-shop-heroes-sorted-id', heroStar:1, heroPair:'independent-with-replacement',
  order:'variant/copper/silver/box-heroes;forge-independent-g24-atom-stream',
});

export type OrbBoxAtom = LootPayload | {readonly kind:'hero';readonly cost:1|2|3|4|5;readonly starLevel?:2};
export interface OrbBoxRow {readonly id:string;readonly weight:number;readonly rewards:readonly OrbBoxAtom[]}
const g=(quantity:number):LootPayload=>({kind:'gold',quantity});
const t=(definitionId:ConsumableDefinitionId):LootPayload=>({kind:'consumable',definitionId,quantity:1});
const f=(definitionId:Extract<LootPayload,{kind:'forge'}>['definitionId']):LootPayload=>({kind:'forge',definitionId,quantity:1});
const h=(cost:1|2|3|4|5,count=1,starLevel?:2):OrbBoxAtom[]=>Array.from({length:count},()=>({kind:'hero',cost,...(starLevel?{starLevel}:{})}));
const r=(id:string,weight:number,...rewards:OrbBoxAtom[]):OrbBoxRow=>({id,weight,rewards});
const lesser=()=>t('TFT_Consumable_ChampionDuplicator_III'),full=()=>t('TFT_Consumable_NeekosHelp');
const remover=()=>t('magnetic-remover'),reforger=()=>t('reforger');
const completed=()=>f('TFT_ArmoryKeyCompleted'),component=()=>f('TFT_ArmoryKeyComponent'),artifact=()=>f('TFT_ArmoryKeyOrnn'),support=()=>f('TFT_ArmoryKeySupport');
const gloves:LootPayload={kind:'item',definitionId:'thiefs-gloves',quantity:1};
// Preserve EPIC_LOOT row order/IDs, including reforger before remover/duplicator.
const plusRewards:Readonly<Record<string,readonly OrbBoxAtom[]>>={
  'three-cost':h(3),'two-cost-gold':[...h(2),g(1)],'four-cost-gold':[...h(4),g(4)],
  'three-cost-pair':[...h(3,2),g(2)],reforger:[],remover:[g(3),remover()],lesser:[lesser()],duplicator:[g(3),full()],
};
/** D2: omit only unsupported atoms; retain each original row and its weight. */
export const ORB_BOXES = freezeContent({
  copper:[r('one-cost-pair',48,...h(1,2)),r('two-cost',47,...h(2)),r('remover',1,g(2),remover()),r('reforger',3,g(2),reforger()),r('lesser',1,lesser())],
  copperPlus:EPIC_LOOT.copper.map(row=>r(row.id,row.weight,...(row.id==='reforger'?[g(3),reforger()]:plusRewards[row.id]))),
  silver:[r('three-cost-gold',31,...h(3),g(3)),r('three-cost-pair',33,...h(3,2)),r('two-cost-triple',31,...h(2,3)),
    r('two-cost-lesser',2,...h(2,2),lesser()),r('three-cost-duplicator',1,...h(3),full()),r('reforger',2,g(6),reforger())],
  silverPlus:EPIC_LOOT.silver.map(row=>r(row.id,row.weight,...(row.id==='reforger'?[g(8),reforger()]:plusRewards[row.id]))),
  gold:[r('gold',20,g(12)),r('reforger',15,g(4),reforger()),r('duplicator',3,full(),g(5)),r('four-cost-pair',15,...h(4,2),g(2)),
    r('three-cost-triple',13,...h(3,3),g(2)),r('gloves',10,gloves,g(1)),r('completed',18,completed()),r('duplicators',3,full(),lesser(),g(2)),r('two-star-three-cost',3,g(3),...h(3,1,2))],
  goldPlus:[r('four-cost-pair',15,g(10),...h(4,2)),r('five-cost',20,g(13),...h(5)),r('components',20,g(2),component(),component()),
    r('completed',15,completed(),g(4)),r('gloves',10,gloves,g(4)),r('reforger-component',5,g(4),reforger(),component()),
    r('duplicator',5,full(),g(8)),r('artifact',5,artifact()),r('five-cost-pair',5,g(7),...h(5,2))],
  ultraPlus:[r('artifacts',10,artifact(),artifact(),remover()),r('completed',15,remover(),completed(),g(8)),r('gold',10,g(24)),
    r('support-artifact',15,support(),artifact(),remover()),r('support-component-spatula',10,support(),component(),g(8),reforger(),{kind:'item',definitionId:'spatula',quantity:1}),
    r('artifact-gold',10,artifact(),g(25),remover()),r('support-gold',10,support(),g(25)),
    r('support-component-pan',10,support(),component(),g(8),reforger(),{kind:'item',definitionId:'frying-pan',quantity:1}),r('six-cost-omitted',10,artifact(),remover())],
});
