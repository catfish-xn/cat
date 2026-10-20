import { freezeContent } from './freeze';

/** Approved project content, M8B_LOOT §§2–5. Never an official historical drop rate. */
export const LOOT_POLICY_VERSION = 's13-orbs-project-v16';
export const LOOT_HERO_POOL_VERSION = 'm8b-heroes-1to4-v1';
export type LootHeroCost = 1 | 2 | 3 | 4;
export const LOOT_HERO_POOLS = freezeContent({
  1: [['TFT13_Darius','darius'],['TFT13_Irelia','irelia'],['TFT13_Lux','lux'],['TFT13_Shooter','maddie'],['TFT13_Zyra','zyra']],
  2: [['TFT13_Leona','leona'],['TFT13_Prime','vander'],['TFT13_Rell','rell'],['TFT13_Tristana','tristana'],['TFT13_Urgot','urgot']],
  3: [['TFT13_Beardy','loris'],['TFT13_Ezreal','ezreal'],['TFT13_FlyGuy','scar'],['TFT13_KogMaw','kogmaw'],['TFT13_Nami','nami']],
  4: [['TFT13_Corki','corki'],['TFT13_Garen','garen'],['TFT13_Zoe','zoe']],
} satisfies Record<LootHeroCost, readonly (readonly [string,string])[]>);
export { ORB_SLOTS as LOOT_SLOTS } from './orbs';
export interface LootCategory { readonly id: string; readonly weight: number; readonly payload: { readonly kind:'gold'; readonly quantity:number } | { readonly kind:'hero-pool'; readonly cost:LootHeroCost } }
export const LOOT_CATEGORIES = freezeContent({
  1: [{id:'gold_1',weight:75,payload:{kind:'gold',quantity:1}},{id:'unit_1',weight:25,payload:{kind:'hero-pool',cost:1}}],
  2: [{id:'gold_2',weight:75,payload:{kind:'gold',quantity:2}},{id:'unit_2',weight:25,payload:{kind:'hero-pool',cost:2}}],
  3: [{id:'gold_3',weight:75,payload:{kind:'gold',quantity:3}},{id:'unit_3',weight:25,payload:{kind:'hero-pool',cost:3}}],
  4: [{id:'gold_4',weight:70,payload:{kind:'gold',quantity:4}},{id:'gold_5_substitute',weight:10,payload:{kind:'gold',quantity:5}},{id:'unit_4',weight:20,payload:{kind:'hero-pool',cost:4}}],
} satisfies Record<LootHeroCost, readonly LootCategory[]>);

/** Changing executable draw order/identity/rejection semantics requires this revision to change. */
export const LOOT_FREEZE_ALGORITHM = freezeContent({
  revision:'s13-orb-freeze-v16', rng:'lcg32-v1', multiplier:1664525, increment:1013904223,
  seedXor:0xdeadbeef, sampling:'uint32-rejection-modulo', order:'sourceUnitId-codepoint/slotOrdinal-numeric',
  choiceOrder:'dropId-codepoint', choices:'supply-only/no-pve-fallback',
});
export const LOOT_RUNTIME_REVISION = 'epic-loot-reforger-v16';
/** User approved 14.24 reward tables. Rows with zero weight are deliberately absent. */
export const EPIC_LOOT = freezeContent({
  variants:[{id:'standard',weight:899},{id:'artifact',weight:100},{id:'crown',weight:1}],
  copper:[{id:'three-cost',weight:49},{id:'two-cost-gold',weight:46},{id:'reforger',weight:3},{id:'remover',weight:1},{id:'lesser',weight:1}],
  silver:[{id:'four-cost-gold',weight:49},{id:'three-cost-pair',weight:47},{id:'reforger',weight:3},{id:'duplicator',weight:1}],
  heroPool:'all-live-shop-heroes-sorted-id', heroStar:1, heroPair:'independent-with-replacement',
  order:'variant/copper/silver/box-heroes;forge-independent-g24-atom-stream',
});
