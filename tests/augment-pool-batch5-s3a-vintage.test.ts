import { expect,it } from 'vitest';
import { accepted,resolveM5Choices,emptyBoard,reachRoundFielded } from './match-helpers';
import { selectChoice,combineItems,equipItem,sellUnit,nextRound,startMatchCombat,openAnvil,type MatchState } from '../src/simulation/match';
import { batch5InventoryPlan,BATCH5_S3A_SOURCE } from '../src/simulation/augment-pool-batch5-s3a';
import { serializeMatch,restoreMatch } from '../src/simulation/serialization';
function trip(s:MatchState){const text=serializeMatch(s);expect(restoreMatch(text)).toEqual(s);expect(restoreMatch(JSON.parse(text))).toEqual(s);expect(restoreMatch(s)).toEqual(s);}
function reject(s:MatchState,mutate:(x:any)=>void){const x=JSON.parse(serializeMatch(s));mutate(x);expect(()=>restoreMatch(x)).toThrow();expect(()=>restoreMatch(JSON.stringify(x))).toThrow();expect(()=>serializeMatch(x)).toThrow();}
function advance(s:MatchState){s=resolveM5Choices(s);if(s.phase==='preparation')s=accepted(startMatchCombat(emptyBoard(s)));s=resolveM5Choices(s);return resolveM5Choices(accepted(nextRound(s,s.round)));}
function offer(){const open=reachRoundFielded('2-1',22);expect(open.roundDefinitionId).toBe('2-1');expect(open.pendingChoice?.kind).toBe('augment');expect(open.pendingChoice?.offers).toContain('fine-vintage');return open;}
it('offers Fine Vintage at 2-1 for production seed 22',()=>{offer();});
function prepared(){const open=offer(),c=open.pendingChoice!;let s=accepted(selectChoice(open,c.choiceId,c.generation,'fine-vintage'));expect(s.items.length).toBeGreaterThanOrEqual(2);s=accepted(combineItems(s,s.items[0].id,s.items[1].id));return s;}
it('B5-15 real combine and four entries (including supply) produce a support anvil, with all restore entries authenticated',()=>{
 let s=prepared();const id=s.items.at(-1)!.id,round=s.round;trip(s);
 for(let n=1;n<=3;n++){s=advance(s);expect(s.round).toBe(round+n);expect(s.items.some(i=>i.id===id)).toBe(true);expect(batch5InventoryPlan(s).anvils).toHaveLength(0);trip(s);}
 s=advance(s);expect(s.round).toBe(round+4);expect(s.items.some(i=>i.id===id)).toBe(false);trip(s);
 const receipt=s.seatMechanics!.receipts.find(r=>r.source===BATCH5_S3A_SOURCE);expect(receipt).toMatchObject({kind:'unit',definitionId:'TFT_ArmoryKeySupport'});if(receipt?.kind!=='unit')throw new Error('no support anvil');
 reject(s,x=>{x.items.push({id,definitionId:'blue-buff',location:{kind:'inventory'}});});
 reject(s,x=>{x.seatMechanics.receipts.find((r:any)=>r.source===BATCH5_S3A_SOURCE).round--;});
 s=accepted(openAnvil(s,receipt.unitId!));trip(s);const c=s.pendingChoice!;expect(c.offers).toHaveLength(4);s=accepted(selectChoice(s,c.choiceId,c.generation,c.offers[0]));trip(s);
});
it('B5-15 equip then sell in the same round resets residence, and a forged omission is rejected',()=>{
 let s=prepared();const id=s.items.at(-1)!.id;s=advance(s);s=advance(s);
 const holder=s.preparation.units.find(u=>u.team==='player')!;s=accepted(equipItem(s,id,holder.id,0));s=accepted(sellUnit(s,holder.id));trip(s);
 s=advance(s);s=advance(s);expect(s.items.some(i=>i.id===id)).toBe(true);expect(batch5InventoryPlan(s).anvils).toHaveLength(0);trip(s);
 reject(s,x=>{x.resourceProvenance.entries.find((e:any)=>e.kind==='item-equipped'&&e.itemId===id).roundId='2-1';});
});
