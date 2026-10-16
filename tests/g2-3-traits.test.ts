import {readG23Progress,writeG23Progress} from '../src/simulation/g2-3-state';
import { expect,it } from 'vitest';
import { G23_CONQUEROR_CHESTS,G23_BLACK_MARKETS,G23_POLICY,g23ConquerorReward } from '../src/simulation/content/g2-3-policy';
import { EMPTY_G23_CONQUEST,planG23Conquest,validateG23Conquest,g23ConquerorBonusBps,g23WeightedIndex,rollG23HighRoller,rollG23BlackMarket } from '../src/simulation/g2-3-progress';
it('only the fifteen source-enabled chests can open; tenth threshold is 650',()=>{
 expect(G23_CONQUEROR_CHESTS.map(c=>c.threshold)).toEqual([10,35,65,100,150,200,330,440,550,650,750,850,1000,1200,1500]);
 expect(G23_CONQUEROR_CHESTS.every(c=>c.weight===1&&c.option.endsWith('_Option1'))).toBe(true);
 expect(G23_CONQUEROR_CHESTS[14].reward).toEqual({Gold:80,Item:['TFT_Item_ForceOfNature','TFT_Item_ForceOfNature'],PlayerBuff:['TFT9_RadiantConversion_PlayerBuff']});
});
it('takedowns deduplicate; settlement replay returns the original object and grants nothing',()=>{
 const p=planG23Conquest(EMPTY_G23_CONQUEST,'battle-1',4,['enemy-2','enemy-1','enemy-1','enemy-3','enemy-4']);
 expect(p.stacks).toBe(12);expect(p.chestsOpened).toBe(1);expect(p.receipts[0].chestTiers).toEqual([1]);
 expect(planG23Conquest(p,'battle-1',4,['forged-new-enemy'])).toBe(p);expect(()=>validateG23Conquest(p)).not.toThrow();
});
it('conquest continues over 1500 without unused rewards; five percent scales the tier bonus',()=>{
 const p=planG23Conquest(EMPTY_G23_CONQUEST,'a',9,Array.from({length:76},(_,i)=>'e'+i));
 expect(p.stacks).toBe(1520);expect(p.chestsOpened).toBe(15);expect(p.radiantConversion).toBe(true);
 const next=planG23Conquest(p,'b',9,['enemy']);expect(next.stacks).toBe(1540);expect(next.receipts[1].chestTiers).toEqual([]);
 expect(g23ConquerorBonusBps(1800,15)).toBe(3150);expect(()=>validateG23Conquest(next)).not.toThrow();
});
it('restoration rejects forged thresholds, duplicate receipts and radiant flag',()=>{
 const p=planG23Conquest(EMPTY_G23_CONQUEST,'a',2,['e']);
 for(const forged of [{...p,stacks:10},{...p,radiantConversion:true},{...p,receipts:[...p.receipts,...p.receipts]},{...p,receipts:[{...p.receipts[0],chestTiers:[1]}]}])expect(()=>validateG23Conquest(forged)).toThrow();
});
it('weighted interval boundaries preserve zero weights and source black-market weights',()=>{
 expect(g23WeightedIndex(0,[0,2500,7500])).toBe(1);expect(g23WeightedIndex(2**30,[0,2500,7500])).toBe(2);expect(g23WeightedIndex(0xffffffff,[0,2500,7500])).toBe(2);
 expect(G23_BLACK_MARKETS.map(m=>m.options.reduce((n,o)=>n+o.weightBps,0))).toEqual(Array(8).fill(10000));
 expect(rollG23BlackMarket(1,42)).toEqual(rollG23BlackMarket(1,42));expect(()=>rollG23BlackMarket(9,42)).toThrow();
});
it('High Roller uses the conditional second distribution only after Triple',()=>{
 let n=0;expect(rollG23HighRoller(()=>{n++;return 0;})).toEqual({mod:'rocket',enhanced:false});expect(n).toBe(1);
 const words=[0xffffffff,0xffffffff];expect(rollG23HighRoller(()=>words.shift()!)).toEqual({mod:'jackpot',enhanced:true});expect(words).toEqual([]);
 expect(G23_POLICY.rumble.selfDestructResistBps[2]).toBe(2000000);
});

import {createMatch} from '../src/simulation/match';
import {buildStrategySnapshot} from '../src/simulation/strategy-snapshot';
import {grantG23Academy,createG23Progress,validateG23Progress} from '../src/simulation/g2-3-match-progress';
import {G23_ACADEMY_LISTS} from '../src/simulation/content/g2-3-academy';
import {validateResourceReceipts} from '../src/simulation/resource-provenance';
function formation(names:string[]){const state=createMatch(42);return {...state,level:9,preparation:{...state.preparation,units:names.map((definitionId,i)=>({id:definitionId,definitionId,team:'player' as const,starLevel:1 as const,location:{kind:'board' as const,cell:{col:i%7,row:4+Math.floor(i/7)}}}))}};}
it('Academy selects one ordered project list with an independent lcg oracle',()=>{
 const seed=42,word=Number((BigInt((seed^0x67323370)>>>0)*1664525n+1013904223n)%4294967296n),index=Number(BigInt(word)*29n/4294967296n);
 expect(createG23Progress(seed).sponsored).toEqual(G23_ACADEMY_LISTS[index]);expect(G23_ACADEMY_LISTS.every(list=>new Set(list).size===3)).toBe(true);
});
it('Academy grants all crossed thresholds once; receipts authenticate actual item births',()=>{
 const s=formation(['lux','leona','ezreal','heimerdinger','jayce']),before=JSON.stringify(s),plan=grantG23Academy(s);
 expect(JSON.stringify(s)).toBe(before);expect(plan.events).toHaveLength(3);expect(readG23Progress(plan.state)!.itemReceipts.map(r=>r.tier)).toEqual([3,4,5]);
 expect(plan.state.items.map(i=>i.definitionId)).toEqual(readG23Progress(s)!.sponsored);
 expect(grantG23Academy(plan.state).state).toBe(plan.state);validateG23Progress(readG23Progress(plan.state)!,42,1);
 const births=validateResourceReceipts({mechanicReceipts:plan.state.seatMechanics!.receipts,scheduleReceipts:[],lootReceipts:[],throughRoundOrdinal:1});expect(births.size).toBe(3);
 expect(()=>validateG23Progress({...readG23Progress(plan.state)!,sponsored:['warmog','deathblade','archangel']},42,1)).toThrow();
});
it('Academy matching ordinary copies stack; extra member five percent applies once',()=>{
 const s=formation(['lux','leona','ezreal','heimerdinger','jayce','darius']),sponsored=readG23Progress(s)!.sponsored[0];
 const items=[0,1].map(slot=>({id:'item-'+slot,definitionId:sponsored,location:{kind:'unit' as const,unitId:'lux',slot}}));
 const compiled=buildStrategySnapshot({...s,items});
 expect(compiled.units.find(u=>u.unitId==='lux')!.mechanics?.find(m=>m.mechanic==='damageAmp')?.values.bps).toBe(2500);
 const outsider=buildStrategySnapshot({...s,items:items.map(i=>({...i,location:{...i.location,unitId:'darius'}}))});
 expect(outsider.units.find(u=>u.unitId==='darius')!.mechanics?.find(m=>m.mechanic==='damageAmp')?.values.bps).toBe(1000);
});
it('opened chests scale the real Conqueror strategy bonus',()=>{
 const s=formation(['darius','draven']),conquest=planG23Conquest(EMPTY_G23_CONQUEST,'b',2,Array.from({length:10},(_,i)=>'e'+i));
 const compiled=buildStrategySnapshot(writeG23Progress(s,{...readG23Progress(s)!,conquest})),draven=compiled.units.find(u=>u.unitId==='draven')!;
 expect(draven.attackDamagePercentBps).toBe(1890);expect(draven.abilityPower).toBe(118);
});
import {advanceG23Economy,decideG23Market,type G23BattleFacts} from '../src/simulation/g2-3-economy';
import {g23RewardAtoms} from '../src/simulation/g2-3-rewards';
import {G23_SPECIAL_ITEMS} from '../src/simulation/content/g2-3-item-registry';
import {validateItemProgram} from '../src/simulation/m8/item-program';
const facts=(round:number,patch:Partial<G23BattleFacts>={}):G23BattleFacts=>({battleId:'battle-'+round,round,roundKind:'pvp',result:'loss',conquerorTier:9,conquestTakedowns:Array.from({length:9},(_,i)=>'enemy-'+i),chemBaronTier:7,alliedDeaths:3,rumbleStar:1,highRollerGold:3,...patch});
it('settlement commits every crossed source chest once, continues past1500 and restores without drawing',()=>{
 let p=createG23Progress(42),gold=0;
 for(let round=1;round<=10;round++){const r=advanceG23Economy(p,facts(round));p=r.progress;gold+=r.gold;expect(advanceG23Economy(p,facts(round))).toEqual({progress:p,gold:0});validateG23Progress(p,42,round);}
 expect(p.conquest.stacks).toBe(1800);expect(p.conquest.chestsOpened).toBe(15);expect(p.rewards.filter(r=>r.source==='conqueror')).toHaveLength(15);expect(p.conquest.radiantConversion).toBe(true);expect(gold).toBe(386+10*3);
 const forged={...p,conquest:{...p.conquest,stacks:1801}};expect(()=>validateG23Progress(forged,42,10)).toThrow();
});
it('source black-market offers sample once, skip once and cash out their exact weighted option',()=>{
 let p=createG23Progress(9);for(let round=1;round<=3;round++)p=advanceG23Economy(p,facts(round,{conquerorTier:0,conquestTakedowns:[]})).progress;
 expect(p.chem.shimmer).toBe(160);const offer=p.chem.offer!,saved=p.rngDraws;
 p=decideG23Market(p,offer.id,false,3);expect(p.chem.skips).toBe(1);expect(p.rngDraws).toBe(saved);expect(()=>decideG23Market(p,offer.id,false,3)).toThrow();
 p=advanceG23Economy(p,facts(4,{conquerorTier:0,conquestTakedowns:[]})).progress;
 const next=p.chem.offer!;p=decideG23Market(p,next.id,true,4);expect(p.chem.shimmer).toBe(0);expect(p.rewards.at(-1)?.source).toBe('black-market');validateG23Progress(p,9,4);
});
it('all enabled source reward descriptors produce concrete finite atoms; all reward-only item programs validate',()=>{
 for(const c of G23_CONQUEROR_CHESTS)expect(()=>g23RewardAtoms({id:'chest-'+c.tier,round:1,source:'conqueror',tier:c.tier,reward:g23ConquerorReward(c)},42)).not.toThrow();
 for(const market of G23_BLACK_MARKETS)for(const option of market.options)expect(()=>g23RewardAtoms({id:option.id,round:1,source:'black-market',tier:market.tier,reward:option.reward},42)).not.toThrow();
 for(const item of Object.values(G23_SPECIAL_ITEMS))expect(()=>validateItemProgram(item.combatProgram!),item.id).not.toThrow();
});

it('only deferred Conqueror tiers get the whole-tier gold floor, preserving all other source rewards',()=>{
 const affected=[4,8,9,10,11,12,13,14,15];
 const cash=[2,0,0,4,0,0,0,9,12,14,15,20,50,60,200];
 expect(G23_CONQUEROR_CHESTS.map(c=>g23ConquerorReward(c).Gold??0)).toEqual(cash);
 for(const c of G23_CONQUEROR_CHESTS){
  const reward=g23ConquerorReward(c);
  if(!affected.includes(c.tier))expect(reward).toEqual(c.reward);
  expect(JSON.stringify(reward)).not.toMatch(/ArmoryKey|ForceOfNature|ThiefsGloves|ChampionDuplicator|ZekesHerald|LocketOfTheIronSolari|TFT_Item_Chalice/);
 }
 expect(g23ConquerorReward(G23_CONQUEROR_CHESTS[13])).toEqual({Gold:60,ItemByKey:['RADIANTITEMS_SET5'],Item:['TFT_Consumable_ItemRemover']});
 expect(g23ConquerorReward({...G23_CONQUEROR_CHESTS[13],reward:{Gold:300,MeepTypeUnit:['TFT_ArmoryKeyOrnn']}})).toEqual({Gold:300});
 expect(g23ConquerorReward({...G23_CONQUEROR_CHESTS[0],estimatedGold:200})).toEqual({Gold:2});
 expect(g23ConquerorReward(G23_CONQUEROR_CHESTS[12])).toEqual({Gold:50,Item:['TFT_Consumable_ItemRemover']});
 expect(g23ConquerorReward(G23_CONQUEROR_CHESTS[14])).toEqual({Gold:200,PlayerBuff:['TFT9_RadiantConversion_PlayerBuff']});
});
it('passing a market grows only Chem-Barons by the active source tier health-per-skip',()=>{
 const state=formation(['renata','renni','singed','darius']);
 const plain=buildStrategySnapshot(state),grown=buildStrategySnapshot(writeG23Progress(state,{...readG23Progress(state)!,chem:{...readG23Progress(state)!.chem,skips:2}}));
 for(const unit of grown.units){const before=plain.units.find(u=>u.unitId===unit.unitId)!;expect(unit.stats.health-before.stats.health).toBe(unit.unitId==='darius'?0:40);}
});

import {createCombatWithEvents,stepCombat} from '../src/simulation/combat';
import {readCombatStats} from '../src/simulation/combat-s13';
import {G23_SPECIAL_ITEM_SOURCE,G23_RADIANT_MAPPING} from '../src/simulation/content/g2-3-special-item-source';
import {applyG23Radiant} from '../src/simulation/g2-3-radiant';
it('radiant source identities execute actual crit authorization, attack mana and source shield effects',()=>{
 const base=formation(['lux']);
 const preparation={...base.preparation,units:[...base.preparation.units,{id:'enemy',definitionId:'garen',starLevel:3 as const,team:'enemy' as const,location:{kind:'board' as const,cell:{col:0,row:3}}}]};
 const items=['TFT5_Item_SpearOfShojinRadiant','TFT5_Item_JeweledGauntletRadiant','TFT5_Item_CrownguardRadiant'].map((definitionId,slot)=>({id:'item-'+(slot+1),definitionId,location:{kind:'unit' as const,unitId:'lux',slot}}));
 const initial=createCombatWithEvents(preparation,buildStrategySnapshot({...base,preparation,items}),'radiant').state;
 const lux=initial.units.find(u=>u.id==='lux')!;
 expect(lux.shield).toBe(Math.floor(lux.maxHp*.5));
 expect(lux.spellCrit).toBeDefined();
 const step=stepCombat({...initial,units:initial.units.map(u=>u.id==='lux'?{...u,mana:0}: {...u,cooldownTicks:1000,moveCooldownTicks:1000})});
 expect(step.state.units.find(u=>u.id==='lux')!.mana).toBe(20); // ordinary10 + sourceFlatManaRestore10
 expect(readCombatStats(lux,initial).abilityPower).toBe(230); //100+Shojin35+JG55+Crownguard40
 expect(Object.keys(G23_RADIANT_MAPPING)).toHaveLength(36);
 for(const id of Object.values(G23_RADIANT_MAPPING))expect(G23_SPECIAL_ITEM_SOURCE).toHaveProperty(id);
 for(const id of ['TFT_Item_ForceOfNature','TFT_Item_ZekesHerald','TFT_Item_Chalice'])expect(G23_SPECIAL_ITEMS[id]).toBeUndefined();
});
it('radiant conversion changes equipped board/bench items once; thereafter only newly combined identities',()=>{
 const state=formation(['lux']);
 const conquest=planG23Conquest(EMPTY_G23_CONQUEST,'conversion',9,Array.from({length:75},(_,i)=>'e'+i));
 const items=[{id:'item-1',definitionId:'shojin',location:{kind:'unit' as const,unitId:'lux',slot:0}},{id:'item-2',definitionId:'warmog',location:{kind:'inventory' as const}}];
 const converted=applyG23Radiant(writeG23Progress({...state,items},{...readG23Progress(state)!,conquest}));
 expect(converted.items.map(i=>i.definitionId)).toEqual(['TFT5_Item_SpearOfShojinRadiant','warmog']);
 expect(applyG23Radiant(converted)).toBe(converted);
 const combined=applyG23Radiant(converted,new Set(['item-2']));
 expect(combined.items[1].definitionId).toBe('TFT5_Item_WarmogsArmorRadiant');
 expect(combined.resourceProvenance.entries.filter(e=>e.kind==='g23-item-converted')).toHaveLength(2);
});
import {readG23MechanismState} from '../src/simulation/g2-3-view';
it('mechanism selector is detached, idempotent and excludes deferred radiant gloves from new chest rewards',()=>{
 const state=createMatch(42),saved=JSON.stringify(state),view=readG23MechanismState(state)!;
 expect(readG23MechanismState(state)).toEqual(view);
 (view.academy.sponsored as string[])[0]='not-a-real-item';
 expect(JSON.stringify(state)).toBe(saved);
 const chest=G23_CONQUEROR_CHESTS[13];
 for(let seed=0;seed<100;seed++)for(const atom of g23RewardAtoms({id:'g23:conqueror:14',round:1,source:'conqueror',tier:14,reward:g23ConquerorReward(chest)},seed))expect(atom.options).not.toContain('TFT5_Item_ThiefsGlovesRadiant');
});

import {planTemporaryEquipment,validateMatchEquipment} from '../src/simulation/temporary-equipment';
it('radiant conversion preserves glove parent slots and its already receipted finite temporary pair',()=>{
 const state=formation(['lux']);
 const equipped=planTemporaryEquipment({...state,items:[{id:'item-1',definitionId:'thiefs-gloves',location:{kind:'unit',unitId:'lux',slot:0}}]}).state;
 const conquest=planG23Conquest(EMPTY_G23_CONQUEST,'conversion',9,Array.from({length:75},(_,i)=>'e'+i));
 const converted=applyG23Radiant(writeG23Progress(equipped,{...readG23Progress(equipped)!,conquest}));
 expect(converted.items[0].definitionId).toBe('TFT5_Item_ThiefsGlovesRadiant');
 expect(G23_SPECIAL_ITEMS[converted.items[0].definitionId].slotCost).toBe(3);
 const next=planTemporaryEquipment(converted);
 expect(next.events).toEqual([]);expect(next.state.temporaryEquipment).toEqual(equipped.temporaryEquipment);
 expect(next.state.equipmentState).toEqual(equipped.equipmentState);
 expect(()=>validateMatchEquipment(next.state)).not.toThrow();
});
