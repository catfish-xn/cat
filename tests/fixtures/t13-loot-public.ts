import * as api from '../../src/simulation/match';
import type { MatchState, MatchCommandResult, MatchEvent } from '../../src/simulation/match';
import { createRequire } from 'node:module';
const { run } = createRequire(import.meta.url)('../../scripts/generate-m5-route.cjs');
export function accepted(result: MatchCommandResult): MatchState {
  if (!result.ok) throw Error(`T13 public fixture: ${result.reason}`);
  return result.state;
}
export const players = (s: MatchState) => s.preparation.units.filter(u => u.team === 'player');
export const bench = (s: MatchState) => players(s).filter(u => u.location.kind === 'bench');
export const plan = (s: MatchState) => s.m8.loot.frozen.rounds.find(r => r.encounterPlan.roundId === s.roundDefinitionId)!;
export function reserveExcept(initial: MatchState, keep: readonly string[]): MatchState {
  let s = initial;
  for (const u of players(s).filter(u => u.location.kind === 'board' && !keep.includes(u.id))) {
    const used = new Set(bench(s).map(u => u.location.kind === 'bench' ? u.location.slot : -1));
    const slot = Array.from({length:9}, (_,i)=>i).find(i=>!used.has(i));
    if (slot === undefined) throw Error('T13 public bench full');
    s = accepted(api.deployMatchUnit(s,u.id,{kind:'bench',slot}));
  }
  return s;
}
export function battle(prepared: MatchState) {
  const start = api.startMatchCombat(prepared), started = accepted(start);
  if (!start.ok) throw Error(start.reason);
  let ended=started, revealed:MatchState|undefined, beforeFinal=started;
  let revealPrefix:MatchEvent[]=[];
  const events:MatchEvent[]=[...start.events];
  while(ended.phase==='combat' && ended.combat.tick<1201) {
    const before=ended,step=api.stepMatch(ended);ended=step.state;events.push(...step.events);
    if(!revealed&&ended.phase==='combat'&&step.events.some(e=>e.type==='lootRevealed')) {revealed=ended;revealPrefix=[...events];}
    if(ended.phase!=='combat')beforeFinal=before;
  }
  if(ended.phase==='combat')throw Error('T13 public battle tick budget');
  return {prepared,started,revealed,beforeFinal,ended,events,revealPrefix,startEvents:start.events};
}
const prefixes=new Map<string,MatchState>();
export async function publicPrefix(roundId:string,seed=42,build='cannon'):Promise<MatchState> {
  const key=JSON.stringify([roundId,seed,build]);
  if(!prefixes.has(key)) {
    const captured=new Error('captured');let prefix:MatchState|undefined;
    try {await run(api,{build,seed,onStep(before:MatchState,_result:unknown,command:{type:string}|undefined){
      if(before.roundDefinitionId===roundId && (command?.type==='start'||before.phase==='choice')) {prefix=before;throw captured;}
    }});}catch(e){if(e!==captured)throw e;}
    if(!prefix)throw Error(`Missing public prefix ${key}`);prefixes.set(key,prefix);
  }
  return structuredClone(prefixes.get(key)!);
}
export function fillBench(input:MatchState,excluded:readonly string[]=[]):MatchState {
  let s=input;
  for(let budget=0;bench(s).length<9;budget++) {
    if(budget>80)throw Error('T13 fill bench budget');
    const slot=s.shop.slots.findIndex(o=>o.status==='available'&&!excluded.includes(o.definitionId)
      &&players(s).filter(u=>u.definitionId===o.definitionId&&u.starLevel===1).length<2);
    s=accepted(slot<0?api.rerollShop(s):api.buyUnit(s,slot,s.shop.generation));
  }
  return s;
}
export async function configuredPrefix(roundId:string, options:Record<string,unknown>):Promise<MatchState> {
  const captured=new Error('captured configured preparation');let prefix:MatchState|undefined;
  try {await run(api,{...options,onStep(before:MatchState,_result:unknown,command:{type:string}|undefined){
    if(command?.type==='start'&&before.roundDefinitionId===roundId){prefix=before;throw captured;}
  }});}catch(e){if(e!==captured)throw e;}
  if(!prefix)throw Error(`Missing configured prefix ${roundId}`);return prefix;
}
export function transferPreparation() {
  return configuredPrefix('4-7',{seed:4,build:'cannon',copyLimits:{ezreal:2},fieldCopies:['ezreal'],
    supplyChoices:['gloves','gloves','vest'],equipmentTargets:{'thiefs-gloves':{definitionId:'ezreal',copy:0}},
    reservedComponents:['gloves','vest'],anomalyTargetDefinitionId:'ezreal',anomalyTargetCopy:0,anomalyDefinitionId:'mage-armor'});
}
export async function terminalPreparation(keep:string|null,col=1) {
  const key='terminal38';
  if(!prefixes.has(key)) {
    const losses=new Set(['1-3','1-4','2-1','2-2','2-3','2-5','2-6','2-7','3-1','3-2','3-3','3-7','4-1','4-2']);
    const captured=new Error('terminal capture');let prefix:MatchState|undefined;
    try {await run({...api,startMatchCombat(s:MatchState){if(s.roundDefinitionId==='4-7'){prefix=s;throw captured;}
      return api.startMatchCombat(losses.has(s.roundDefinitionId)?reserveExcept(s,[]):s);}}, {seed:38,build:'cannon'});
    }catch(e){if(e!==captured)throw e;}
    if(!prefix)throw Error('Missing terminal prefix');prefixes.set(key,fillBench(reserveExcept(prefix,[]),['ezreal']));
  }
  let s=structuredClone(prefixes.get(key)!);
  if(keep)s=accepted(api.deployMatchUnit(s,keep,{kind:'board',cell:{col,row:7}}));
  return fillBench(s,['ezreal']);
}
