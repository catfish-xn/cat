import {expect,it} from 'vitest';
import {createMatch,sellUnit,selectChoice,forfeitPendingChoice,type MatchState} from '../src/simulation/match';
import {G23_CONQUEROR_CHESTS,G23_DEFERRED_CONQUEROR_ITEMS,g23ConquerorReward} from '../src/simulation/content/g2-3-policy';
import {g23RewardAtoms} from '../src/simulation/g2-3-rewards';
import {ITEM_DEFINITIONS} from '../src/simulation/content/g2-3-item-registry';
import {M5_UNIT_DEFINITIONS} from '../src/simulation/units';
import {readG23Progress,writeG23Progress,validateG23MechanicLinks} from '../src/simulation/g2-3-state';
import {commitG23Settlement} from '../src/simulation/g2-3-settlement';
import {openG23Choice,drainG23Rewards,claimG23Atom} from '../src/simulation/g2-3-runtime';
import type {G23BattleFacts} from '../src/simulation/g2-3-economy';
import { vi } from 'vitest';
// Temporarily 20 s for slow CI runners (user-approved 2026-10-20 04:22: "Ci 超时可以放宽时限，或者直接验收").
vi.setConfig({ testTimeout: 20_000 });
const ok=<T extends {ok:boolean}>(r:T):Extract<T,{ok:true}>=>{if(!r.ok)throw Error(JSON.stringify(r));return r as Extract<T,{ok:true}>;};
const chest=(tier:number)=>G23_CONQUEROR_CHESTS[tier-1];
const ordinary=Object.values(ITEM_DEFINITIONS).filter(i=>i.kind==='completed'&&i.recipe).map(i=>i.id);
const bundle=(tier:number)=>{const {Gold:_gold,...reward}=g23ConquerorReward(chest(tier));return {id:`g23:conqueror:${tier}`,round:4,source:'conqueror' as const,tier,reward};};

it('G2-4a restores tiers 4, 8 and 9 to their source rewards and keeps the gold floor only where items stay deferred',()=>{
 for(const tier of [4,8,9])expect(g23ConquerorReward(chest(tier))).toEqual(chest(tier).reward);
 expect(g23ConquerorReward(chest(4))).toEqual({Item:['TFT_Consumable_ChampionDuplicator_III'],ThreeCostUnit:1});
 expect(g23ConquerorReward(chest(8))).toEqual({Item:['TFT_Item_ThiefsGloves']});
 expect(g23ConquerorReward(chest(9))).toEqual({MeepTypeUnit:['TFT_ArmoryKeyCompleted']});
 // G2-4b restores artifact tiers 10/14 and support tiers 11/13; 12/13/15 pay source gold.
 expect([10,11,12,13,14,15].map(t=>g23ConquerorReward(chest(t)).Gold)).toEqual([undefined,undefined,20,20,50,80]);
 for(const tier of [11,12,13,15])expect(g23ConquerorReward(chest(tier))).toEqual(chest(tier).reward);
 expect(g23ConquerorReward(chest(14)).MeepTypeUnit).toEqual(['TFT_ArmoryKeyOrnn']);
 expect(G23_DEFERRED_CONQUEROR_ITEMS).not.toContain('TFT_ArmoryKeyCompleted');
});
it('the completed-item anvil offers four distinct ordinary completed items, stable per seed and atom',()=>{
 const [anvil]=g23RewardAtoms(bundle(9),42);
 expect(anvil).toMatchObject({kind:'item',quantity:1,gold:0});
 expect(anvil.options).toHaveLength(4);expect(new Set(anvil.options).size).toBe(4);
 for(const id of anvil.options)expect(ordinary).toContain(id);
 expect(g23RewardAtoms(bundle(9),42)).toEqual([anvil]);
 const seeds=new Set([1,2,3,4,5,6,7,8].map(seed=>g23RewardAtoms(bundle(9),seed)[0].options.join()));
 expect(seeds.size).toBeGreaterThan(1);
});
it('Thief\'s Gloves and the lesser duplicator become concrete atoms',()=>{
 expect(g23RewardAtoms(bundle(8),42)).toEqual([{id:'g23:conqueror:8:atom:0',kind:'item',options:['thiefs-gloves'],quantity:1,gold:0}]);
 // The 3-cost hero atom comes first so the same drain can copy it.
 expect(Object.keys(g23ConquerorReward(chest(4)))).toEqual(['ThreeCostUnit','Item']);
 const [unit,duplicator]=g23RewardAtoms(bundle(4),42);
 expect(duplicator.kind).toBe('duplicator');
 expect(duplicator.options.every(id=>M5_UNIT_DEFINITIONS[id]!.cost<=3)).toBe(true);
 expect(unit.kind).toBe('unit');
});

function preparedAtRound4():MatchState{
 const initial=createMatch(42);
 return {...initial,round:4,roundDefinitionId:'2-1',phase:'settlement',m8:{...initial.m8,round:{...initial.m8.round,kind:'pvp' as const}}} as MatchState;
}
const facts=(patch:Partial<G23BattleFacts>={}):G23BattleFacts=>({battleId:'g2-4a-battle',round:4,roundKind:'pvp',result:'win',conquerorTier:9,
 conquestTakedowns:Array.from({length:28},(_,i)=>'enemy-'+i),chemBaronTier:0,alliedDeaths:0,rumbleStar:0,highRollerGold:0,...patch});

it('one settlement crossing tier 9 grants the duplicate, Thief\'s Gloves and a four-way anvil popup exactly once',()=>{
 const before=preparedAtRound4();
 expect(before.preparation.units.filter(u=>u.team==='player').map(u=>u.definitionId)).toEqual(['irelia']);
 const settled=commitG23Settlement(before,facts());
 const p=readG23Progress(settled)!;
 expect(p.conquest.chestsOpened).toBe(9);
 // Source gold only: tier1 2 gold; tiers 4/8/9 no longer pay the transitional 4/9/12.
 expect(settled.gold-before.gold).toBe(2);
 expect(settled.items.filter(i=>i.definitionId==='thiefs-gloves')).toHaveLength(1);
 // The duplicator copies the first owned ≤3-cost candidate (owned irelia or the tier-2 two-star hero) as a 1-star.
 const dupClaim=p.rewardClaims.find(c=>c.kind==='duplicator')!,duplicate=settled.preparation.units.find(u=>u.id===dupClaim.instanceId);
 expect(M5_UNIT_DEFINITIONS[dupClaim.definitionId]!.cost).toBeLessThanOrEqual(3);
 expect(duplicate).toMatchObject({team:'player',definitionId:dupClaim.definitionId,starLevel:1});
 expect(settled.seatMechanics!.receipts.filter(r=>r.receiptId.startsWith('g23:conqueror:4:')||r.receiptId.startsWith('g23:conqueror:8:')||r.receiptId.startsWith('g23:conqueror:9:')).map(r=>r.receiptId).sort())
  .toEqual(['g23:conqueror:4:atom:0:copy:0','g23:conqueror:4:atom:1:copy:0','g23:conqueror:8:atom:0:copy:0']);
 expect(p.rewardClaims.filter(c=>c.bundleId==='g23:conqueror:4').map(c=>c.kind)).toEqual(['unit','duplicator']);
 expect(()=>validateG23MechanicLinks(settled)).not.toThrow();
 // Settling the same battle again grants nothing.
 expect(commitG23Settlement(settled,facts())).toBe(settled);

 const opened=openG23Choice(settled).state,choice=opened.pendingChoice!;
 expect(choice).toMatchObject({kind:'forge',choiceId:'g23:conqueror:9:atom:0:copy:0',payload:{kind:'forge',source:'conqueror',timeoutOption:choice.offers[0]}});
 expect(choice.offers).toEqual(g23RewardAtoms(p.rewards.find(b=>b.tier===9)!,p.seed)[0].options);
 expect(choice.offers).toHaveLength(4);

 const picked=ok(selectChoice(opened,choice.choiceId,choice.generation,choice.offers[2])).state;
 expect(picked.items.filter(i=>i.definitionId===choice.offers[2]).length).toBe(opened.items.filter(i=>i.definitionId===choice.offers[2]).length+1);
 expect(picked.pendingChoice).toBeNull();
 expect(openG23Choice(picked).state.pendingChoice).toBeNull();
 expect(()=>validateG23MechanicLinks(picked)).not.toThrow();
 expect(selectChoice(picked,choice.choiceId,choice.generation,choice.offers[1]).ok).toBe(false);

 const seat={version:'multiplayer-settlement-v1' as const,seatId:'A',status:'active' as const,receipts:[],forfeitedChoices:[]};
 const timed=ok(forfeitPendingChoice({...opened,multiplayer:seat},4,choice.choiceId,choice.generation)).state;
 expect(timed.items.at(-1)?.definitionId).toBe(choice.offers[0]);
});
it('without an eligible hero the duplicator stays in escrow and is claimed once one is owned',()=>{
 const initial:MatchState={...preparedAtRound4(),phase:'preparation',combat:null},p0=readG23Progress(initial)!;
 const empty=writeG23Progress({...initial,preparation:{...initial.preparation,units:initial.preparation.units.filter(u=>u.team!=='player')}},{...p0,rewards:[bundle(4)]});
 // Retain the real frozen descriptor: resolve its hero, then sell that hero before draining the duplicator.
 const hero=g23RewardAtoms(bundle(4),p0.seed)[0],granted=ok(claimG23Atom(empty,hero.id,hero.options[0])).state;
 const holder=granted.preparation.units.find(u=>u.team==='player')!;
 const waiting=drainG23Rewards(ok(sellUnit(granted,holder.id)).state);
 expect(readG23Progress(waiting)!.rewardClaims.filter(c=>c.kind==='duplicator')).toHaveLength(0);
 expect(drainG23Rewards(waiting)).toEqual(waiting);
 const claimed=drainG23Rewards({...waiting,preparation:initial.preparation});
 expect(readG23Progress(claimed)!.rewardClaims.filter(c=>c.kind==='duplicator')).toMatchObject([{kind:'duplicator',definitionId:'irelia',copy:0}]);
 expect(claimed.preparation.units.filter(u=>u.definitionId==='irelia')).toHaveLength(2);
 expect(drainG23Rewards(claimed)).toEqual(claimed);
});
it('a duplicator can copy the 3-cost hero granted by the same chest in the same drain',()=>{
 const initial=preparedAtRound4(),p0=readG23Progress(initial)!,tier4=bundle(4);
 const unit=g23RewardAtoms(tier4,p0.seed)[0];
 // No hero owned beforehand: the only ≤3-cost candidate is the hero this chest grants.
 const empty=writeG23Progress({...initial,preparation:{...initial.preparation,units:initial.preparation.units.filter(u=>u.team!=='player')}},{...p0,rewards:[tier4]});
 const drained=drainG23Rewards(empty),claims=readG23Progress(drained)!.rewardClaims;
 expect(claims.map(c=>c.kind)).toEqual(['unit','duplicator']);
 expect(unit.options).toContain(claims[0].definitionId);
 expect(claims[1].definitionId).toBe(claims[0].definitionId);
 expect(drained.preparation.units.filter(u=>u.team==='player'&&u.definitionId===claims[0].definitionId)).toHaveLength(2);
});
