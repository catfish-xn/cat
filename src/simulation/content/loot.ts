import { freezeContent } from './freeze';
import type { LootPayload } from '../m8/contracts';

/** Approved project content, M8B_LOOT §§2–5. Never an official historical drop rate. */
export const LOOT_POLICY_VERSION = 'm8b-loot-project-v1';
export const LOOT_HERO_POOL_VERSION = 'm8b-heroes-1to4-v1';
export type LootHeroCost = 1 | 2 | 3 | 4;
export const LOOT_HERO_POOLS = freezeContent({
  1: [['TFT13_Darius','darius'],['TFT13_Irelia','irelia'],['TFT13_Lux','lux'],['TFT13_Shooter','maddie'],['TFT13_Zyra','zyra']],
  2: [['TFT13_Leona','leona'],['TFT13_Prime','vander'],['TFT13_Rell','rell'],['TFT13_Tristana','tristana'],['TFT13_Urgot','urgot']],
  3: [['TFT13_Beardy','loris'],['TFT13_Ezreal','ezreal'],['TFT13_FlyGuy','scar'],['TFT13_KogMaw','kogmaw'],['TFT13_Nami','nami']],
  4: [['TFT13_Corki','corki'],['TFT13_Garen','garen'],['TFT13_Zoe','zoe']],
} satisfies Record<LootHeroCost, readonly (readonly [string,string])[]>);
export type LootSlotContent = { readonly kind: 'fixed'; readonly payload: LootPayload }
  | { readonly kind: 'random-component' } | { readonly kind: 'component-choice' }
  | { readonly kind: 'extra'; readonly cost: LootHeroCost };
export interface LootSlotDefinition {
  readonly sourceSlotId: string;
  readonly slotOrdinal: number;
  readonly content: LootSlotContent;
}
const slot = (sourceSlotId: string, slotOrdinal: number, content: LootSlotContent): LootSlotDefinition => ({sourceSlotId,slotOrdinal,content});
export const LOOT_SLOTS: Readonly<Record<string, readonly LootSlotDefinition[]>> = freezeContent({
  '1-2': [slot('m01',0,{kind:'fixed',payload:{kind:'unit',definitionId:'maddie',quantity:1}})],
  '1-3': [slot('m01',0,{kind:'fixed',payload:{kind:'unit',definitionId:'lux',quantity:1}}),slot('r01',0,{kind:'component-choice'})],
  '1-4': [slot('r01',0,{kind:'component-choice'})],
  '2-7': [slot('k01',0,{kind:'random-component'}),slot('k01',1,{kind:'extra',cost:1}),slot('k02',0,{kind:'component-choice'})],
  '3-7': [slot('w00',0,{kind:'random-component'}),slot('w00',1,{kind:'extra',cost:2}),slot('w01',0,{kind:'component-choice'})],
  '4-7': [slot('r00',0,{kind:'random-component'}),slot('r00',1,{kind:'extra',cost:3}),slot('r01',0,{kind:'component-choice'})],
  '5-7': [slot('d01',0,{kind:'random-component'}),slot('d01',1,{kind:'component-choice'}),slot('d01',2,{kind:'extra',cost:4})],
  '6-7': [slot('h01',0,{kind:'fixed',payload:{kind:'gold',quantity:5}})],
});
export interface LootCategory { readonly id: string; readonly weight: number; readonly payload: { readonly kind:'gold'; readonly quantity:number } | { readonly kind:'hero-pool'; readonly cost:LootHeroCost } }
export const LOOT_CATEGORIES = freezeContent({
  1: [{id:'gold_1',weight:75,payload:{kind:'gold',quantity:1}},{id:'unit_1',weight:25,payload:{kind:'hero-pool',cost:1}}],
  2: [{id:'gold_2',weight:75,payload:{kind:'gold',quantity:2}},{id:'unit_2',weight:25,payload:{kind:'hero-pool',cost:2}}],
  3: [{id:'gold_3',weight:75,payload:{kind:'gold',quantity:3}},{id:'unit_3',weight:25,payload:{kind:'hero-pool',cost:3}}],
  4: [{id:'gold_4',weight:70,payload:{kind:'gold',quantity:4}},{id:'gold_5_substitute',weight:10,payload:{kind:'gold',quantity:5}},{id:'unit_4',weight:20,payload:{kind:'hero-pool',cost:4}}],
} satisfies Record<LootHeroCost, readonly LootCategory[]>);

/** Changing executable draw order/identity/rejection semantics requires this revision to change. */
export const LOOT_FREEZE_ALGORITHM = freezeContent({
  revision:'m8b-loot-freeze-v1', rng:'lcg32-v1', multiplier:1664525, increment:1013904223,
  seedXor:0xdeadbeef, sampling:'uint32-rejection-modulo', order:'sourceUnitId-codepoint/slotOrdinal-numeric',
  choiceOrder:'dropId-codepoint', choices:'full-pool/one-fallback-word',
});
export const LOOT_RUNTIME_REVISION = 'm8-b8-live-loot-basis-provenance-v1';
