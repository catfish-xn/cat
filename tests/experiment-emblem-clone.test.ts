import { expect, it } from 'vitest';
import { createMatch, deployMatchUnit, startMatchCombat, stepMatch, equipItem } from '../src/simulation/match';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { createCombatWithEvents, stepCombat, type CombatState } from '../src/simulation/combat';
import { g23Laboratories } from '../src/simulation/g2-3-experiment';
import { splitExperimentClones } from '../src/simulation/combat-experiment-clone';
import { countsG23SurvivorDamage } from '../src/simulation/g2-3-summons';
import { EMBLEM_ITEMS } from '../src/simulation/content/emblems';
import { UNIT_DEFINITIONS } from '../src/simulation/units';
import { SHOP_CATALOG } from '../src/simulation/match-rules';
import { grantMechanicItem, grantMechanicUnit } from '../src/simulation/seat-mechanics/grants';
import { serializeMatch, restoreMatch } from '../src/simulation/serialization';
import type { AbilityContext } from '../src/simulation/combat-s13-abilities';
import type { S13Unit } from '../src/simulation/combat-s13-state';
import type { HexCell } from '../src/simulation/board';
import type { MatchState } from '../src/simulation/match-types';
import type { Unit } from '../src/simulation/unit-types';
import { accepted, emptyBoard, reachRound } from './match-helpers';

// Independent expectation (P-EX1, option A): 60% x Scaling 1.15/1.3/1.5 from 14.24
// TFT13_Item_ExperimentEmblemItem / TFT13_Experiment; 8 s at 20 ticks per second.
const HEALTH_BPS:Record<number,number>={3:6900,5:7800,7:9000};
const SPLIT_TICK=160;
const EMBLEM=Object.values(EMBLEM_ITEMS).find(e=>e.emblemTrait==='experiment')!;
const natives=Object.values(UNIT_DEFINITIONS).filter(d=>d.traits.includes('experiment')&&SHOP_CATALOG.includes(d.id)).map(d=>d.id).sort();
const outsider=Object.values(UNIT_DEFINITIONS).find(d=>!d.traits.includes('experiment')&&SHOP_CATALOG.includes(d.id)&&d.cost===1)!.id;
const clone=(id:string)=>JSON.stringify(['g23-experiment-clone',id]);
const cloneMech=(u:{mechanics?:readonly {mechanic:string;values:Readonly<Record<string,number>>}[]})=>u.mechanics?.find(m=>m.mechanic==='g23ExperimentClone');

/** tier members: (tier-1) natives + one emblem outsider "h". Holder and first native stand on Laboratories. */
function army(tier:number,holderOnLab=true){
 const s=createMatch(42),labs=g23Laboratories(42,'player',tier);
 const used=new Set(labs.map(c=>`${c.col}:${c.row}`)),free=Array.from({length:28},(_,i)=>({col:i%7,row:4+Math.floor(i/7)})).filter(c=>!used.has(`${c.col}:${c.row}`));
 const ids=['h',...natives.slice(0,tier-1)];
 const cell=(i:number):HexCell=>i===0?(holderOnLab?labs[0]:free[0]):i===1?labs[1]:free[i];
 const units:Unit[]=ids.map((id,i)=>({id,definitionId:i===0?outsider:natives[i-1],team:'player',starLevel:1,location:{kind:'board',cell:cell(i)}}));
 units.push({id:'enemy',definitionId:'garen',team:'enemy',starLevel:1,location:{kind:'board',cell:{col:6,row:0}}});
 return {...s,preparation:{...s.preparation,units},items:[{id:'emblem',definitionId:EMBLEM.id,location:{kind:'unit' as const,unitId:'h',slot:0}}]} as MatchState;
}
const combat=(s:MatchState)=>createCombatWithEvents(s.preparation,buildStrategySnapshot(s),'ex',42).state;
function stepUntil(c:CombatState,tick:number,patch?:(c:CombatState)=>CombatState):CombatState{
 let s=c;while(s.tick<tick&&s.status==='running'){s=stepCombat(patch?patch(s):s).state;}return s;
}

it.each([3,5,7])('tier %i: Laboratory Experiments receive the copy bonus at the source health ratio; holder off-Laboratory donates nothing',tier=>{
 const snap=buildStrategySnapshot(army(tier));
 const receivers=snap.units.filter(u=>cloneMech(u)).map(u=>u.unitId).sort();
 expect(receivers).toEqual(['h',natives[0]].sort());
 for(const u of snap.units.filter(u=>cloneMech(u)))expect(cloneMech(u)!.values).toEqual({healthBps:HEALTH_BPS[tier],splitTick:SPLIT_TICK});
 expect(buildStrategySnapshot(army(tier,false)).units.some(u=>cloneMech(u))).toBe(false);
});
it('8 s trigger: copy of the same star, 69% of the opening max HP, mana 0, no items/Laboratory/copy bonus, no trait membership, fires once',()=>{
 const start=combat(army(3)),holder=start.units.find(u=>u.id==='h')!;
 const opening=holder.experimentClone!.openingMaxHp;expect(opening).toBe(holder.maxHp);
 const freeze=(c:CombatState)=>({...c,units:c.units.map(u=>({...u,cooldownTicks:1000,moveCooldownTicks:1000,mana:0}))});
 const before=stepUntil(start,SPLIT_TICK-1,freeze);
 expect(before.units.some(u=>u.id===clone('h'))).toBe(false);
 const step=stepCombat(freeze(before)),after=step.state,copy=after.units.find(u=>u.id===clone('h'))!;
 expect(after.tick).toBe(SPLIT_TICK);
 expect(copy).toMatchObject({definitionId:outsider,starLevel:1,team:'player',mana:0,alive:true,maxHp:Math.floor(opening*6900/10000),hp:Math.floor(opening*6900/10000)});
 expect(copy.itemSummon).toMatchObject({kind:'experiment',ownerId:'h',healthBps:6900,spawnedAtTick:SPLIT_TICK});
 expect((copy.sources??[]).some(s=>s.source.sourceKind==='item')).toBe(false);
 expect(copy.mechanics?.some(m=>m.mechanic==='g23Experiment'||m.mechanic==='g23ExperimentClone')).toBe(false);
 expect(after.strategy!.traits.some(t=>t.targetUnitIds.includes(copy.id)||t.memberUnitIds?.includes(copy.id))).toBe(false);
 expect(countsG23SurvivorDamage(copy)).toBe(false);
 expect(step.events).toContainEqual(expect.objectContaining({type:'unitSpawned',unitId:copy.id}));
 const nativeCopy=after.units.find(u=>u.id===clone(natives[0]))!;expect(nativeCopy).toBeDefined();
 expect(after.units.find(u=>u.id==='h')!.experimentClone).toEqual({openingMaxHp:opening,triggeredAtTick:SPLIT_TICK,cloneId:copy.id});
 // Nearest empty cell: distance, then row, then column; the original still stands on its own cell.
 expect(copy.cell).not.toEqual(after.units.find(u=>u.id==='h')!.cell);
 // A later death never fires a second copy, and the copy cannot split.
 const dead={...after,units:after.units.map(u=>u.id==='h'||u.id===copy.id?{...u,hp:0}:u)};
 const later=stepCombat(dead).state;
 expect(later.units.filter(u=>u.itemSummon?.ownerId==='h')).toHaveLength(1);
 expect(later.units.filter(u=>u.itemSummon?.kind==='experiment'&&u.itemSummon.ownerId===copy.id)).toHaveLength(0);
});
it('death before 8 s fires at the original cell and voids the 8 s trigger',()=>{
 const start=combat(army(5)),cell=start.units.find(u=>u.id==='h')!.cell;
 const killed=stepCombat({...start,units:start.units.map(u=>u.id==='h'?{...u,hp:0}:u)}),copy=killed.state.units.find(u=>u.id===clone('h'))!;
 expect(copy.cell).toEqual(cell);expect(copy.maxHp).toBe(Math.floor(start.units.find(u=>u.id==='h')!.experimentClone!.openingMaxHp*7800/10000));
 const freeze=(c:CombatState)=>({...c,units:c.units.map(u=>({...u,cooldownTicks:1000,moveCooldownTicks:1000,mana:0}))});
 const later=stepUntil(killed.state,SPLIT_TICK+1,freeze);
 expect(later.units.filter(u=>u.itemSummon?.ownerId==='h')).toHaveLength(1);
});
it('a full board consumes the trigger without a copy or overlap',()=>{
 const s=stepCombat(combat(army(3))).state,units=structuredClone(s.units) as S13Unit[],enemy=units.find(u=>u.id==='enemy')!;
 for(let row=0;row<s.board.rows;row++)for(let col=0;col<s.board.columns;col++)
  if(!units.some(u=>u.alive&&u.cell.col===col&&u.cell.row===row))units.push({...structuredClone(enemy),id:`filler-${col}-${row}`,cell:{col,row}});
 const ctx:AbilityContext={units,board:s.board,combatId:s.combatId,tick:SPLIT_TICK,events:[],heals:[],packets:[],draw:()=>0};
 splitExperimentClones(ctx,s,units);
 expect(units.some(u=>u.itemSummon?.kind==='experiment')).toBe(false);
 expect(units.find(u=>u.id==='h')!.experimentClone).toMatchObject({triggeredAtTick:SPLIT_TICK,cloneId:null});
});

it('P-EX3: same-tick triggers resolve in numeric unit id order (unit-9 before unit-10), as Sion attribution',()=>{
 const s=stepCombat(combat(army(3))).state,units=structuredClone(s.units) as S13Unit[],enemy=units.find(u=>u.id==='enemy')!;
 // Holder becomes unit-10, the Laboratory native unit-9: code-unit order would pick unit-10 first.
 for(const u of units){if(u.id==='h')(u as {id:string}).id='unit-10';else if(u.id===natives[0])(u as {id:string}).id='unit-9';}
 const empty:HexCell[]=[];
 for(let row=0;row<s.board.rows;row++)for(let col=0;col<s.board.columns;col++)if(!units.some(u=>u.alive&&u.cell.col===col&&u.cell.row===row))empty.push({col,row});
 // Leave exactly one empty cell so only the first-resolved trigger gets a copy.
 for(const cell of empty.slice(1))units.push({...structuredClone(enemy),id:`filler-${cell.col}-${cell.row}`,cell});
 const ctx:AbilityContext={units,board:s.board,combatId:s.combatId,tick:SPLIT_TICK,events:[],heals:[],packets:[],draw:()=>0};
 splitExperimentClones(ctx,s,units);
 expect(units.find(u=>u.id==='unit-9')!.experimentClone).toMatchObject({triggeredAtTick:SPLIT_TICK,cloneId:clone('unit-9')});
 expect(units.find(u=>u.id==='unit-10')!.experimentClone).toMatchObject({triggeredAtTick:SPLIT_TICK,cloneId:null});
 expect(units.filter(u=>u.itemSummon?.kind==='experiment').map(u=>u.itemSummon!.ownerId)).toEqual(['unit-9']);
});

function matchArmy():MatchState{
 let s=emptyBoard(reachRound('2-1'));
 const grant=(r:ReturnType<typeof grantMechanicUnit>)=>{expect(r.ok).toBe(true);return r.state;};
 for(const [i,id] of [outsider,natives[0],natives[1]].entries())s=grant(grantMechanicUnit(s,{receiptId:'ex-unit-'+i,source:'test',definitionId:id}));
 s=grant(grantMechanicItem(s,{receiptId:'ex-emblem',source:'test',definitionId:EMBLEM.id}));
 const ids=[outsider,natives[0],natives[1]].map(def=>[...s.preparation.units].reverse().find(u=>u.definitionId===def&&u.location.kind==='bench')!.id);
 const equipped=equipItem(s,s.items.find(i=>i.definitionId===EMBLEM.id)!.id,ids[0],0);expect(equipped.ok).toBe(true);s=equipped.state;
 const labs=g23Laboratories(readSeed(s),'player',3);
 s=accepted(deployMatchUnit(s,ids[0],{kind:'board',cell:labs[0]}));s=accepted(deployMatchUnit(s,ids[1],{kind:'board',cell:labs[1]}));
 const spare=Array.from({length:28},(_,i)=>({col:i%7,row:4+Math.floor(i/7)})).find(c=>!labs.some(l=>l.col===c.col&&l.row===c.row))!;
 return accepted(deployMatchUnit(s,ids[2],{kind:'board',cell:spare}));
}
function readSeed(s:MatchState):number{return (s.seatMechanics?.hidden?.progress as {seed?:number}|undefined)?.seed??s.seed;}
it('Match combat restores across the split, continues identically and rejects a tampered copy',()=>{
 let s=accepted(startMatchCombat(matchArmy()));
 const holder=s.combat!.units.find(u=>u.team==='player'&&u.definitionId===outsider)!;
 expect(cloneMech(holder)?.values.healthBps).toBe(6900);
 while(s.phase==='combat'&&s.combat!.tick<SPLIT_TICK-1)s=stepMatch(s).state;
 for(let i=0;i<3&&s.phase==='combat';i++){
  const restored=restoreMatch(serializeMatch(s));expect(restored).toEqual(s);expect(stepMatch(restored)).toEqual(stepMatch(s));s=stepMatch(s).state;
 }
 const copy=s.combat?.units.find(u=>u.itemSummon?.kind==='experiment'&&u.itemSummon.ownerId===holder.id);
 expect(copy).toBeDefined();
 expect(restoreMatch(serializeMatch(s))).toEqual(s);
 const forged=structuredClone(s) as any,target=forged.combat.units.find((u:any)=>u.itemSummon?.kind==='experiment');
 expect(target).toBeDefined();target.maxHp+=1;target.hp+=1;
 expect(()=>restoreMatch(serializeMatch(forged))).toThrow();
 const unsplit=structuredClone(s) as any;unsplit.combat.units.find((u:any)=>u.id===holder.id).experimentClone.triggeredAtTick=null;
 expect(()=>restoreMatch(serializeMatch(unsplit))).toThrow();
});
