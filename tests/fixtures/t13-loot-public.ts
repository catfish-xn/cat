import * as api from '../../src/simulation/match';
import { restoreMatch, serializeMatch } from '../../src/simulation/serialization';
import { isSellableUnit } from '../../src/simulation/seat-mechanics/forms';
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
  // v22 opening structures (Trainer Golem) cannot be benched or sold; they stay where the opening put them.
  for (const u of players(s).filter(u => u.location.kind === 'board' && !keep.includes(u.id) && isSellableUnit(u.definitionId))) {
    const used = new Set(bench(s).map(u => u.location.kind === 'bench' ? u.location.slot : -1));
    const slot = Array.from({length:9}, (_,i)=>i).find(i=>!used.has(i));
    if (slot === undefined) {
      const excess=bench(s).find(unit=>!keep.includes(unit.id)&&isSellableUnit(unit.definitionId));
      if(!excess)throw Error('T13 public bench full');
      s=accepted(api.sellUnit(s,excess.id));
      const location=excess.location;
      if(location.kind!=='bench')throw Error('Expected bench sale');
      s=accepted(api.deployMatchUnit(s,u.id,{kind:'bench',slot:location.slot}));
      continue;
    }
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
export async function publicPrefix(roundId:string,seed=42,build='cannon',augmentPriorities:readonly string[]=[],augmentRerollPriorities:Readonly<Record<string,readonly string[]>>={}):Promise<MatchState> {
  const key=JSON.stringify([roundId,seed,build,augmentPriorities,augmentRerollPriorities]);
  if(!prefixes.has(key)) {
    const captured=new Error('captured');let prefix:MatchState|undefined;
    try {await run(api,{build,seed,augmentPriorities,augmentRerollPriorities,onStep(before:MatchState,_result:unknown,command:{type:string}|undefined){
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
export async function configuredPrefix(roundId:string, options:Record<string,unknown>, checkpointRound?:string):Promise<MatchState> {
  const captured=new Error('captured configured preparation');let prefix:MatchState|undefined;
  const routeApi=checkpointRound ? {...api,startMatchCombat(s:MatchState){return api.startMatchCombat(s.roundDefinitionId===checkpointRound ? restoreMatch(serializeMatch(s)) : s);}} : api;
  try {await run(routeApi,{...options,onStep(before:MatchState,_result:unknown,command:{type:string}|undefined){
    if(command?.type==='start'&&before.roundDefinitionId===roundId){prefix=before;throw captured;}
  }});}catch(e){if(e!==captured)throw e;}
  if(!prefix)throw Error(`Missing configured prefix ${roundId}`);return prefix;
}
export async function transferPreparation({equipGloves=true,checkpointRound,onProgress}:{equipGloves?:boolean;checkpointRound?:string;onProgress?:(state:MatchState)=>Promise<void>}={}) {
  // Seed 4 rerolls for a non-unit-gifting first augment, preserving two paid copies. Its independent v17 box oracle yields
  // Tristana at 4-7 (no Ezreal/remover), so target that real reward for transfer.
  // Equip the original glove recipe here; the offline variant freezes a vest
  // on the donor and equips the gloves during combat without inventing a remover.
  let s=await configuredPrefix('4-7',{seed:4,build:'cannon',augmentRerollPriorities:{'2-1':['pumping-up-i','manaflow-i','backup','bronze-for-life-i','bulky-buddies-i','placebo','lineup','little-buddies','bulky-buddies-ii','blistering-strikes']},equipItems:false,goldReserves:{'4-5':40},copyLimits:{tristana:2,corki:1},fieldCopies:['tristana'],
    supplyChoices:['gloves','gloves','vest'],equipmentTargets:{'thiefs-gloves':{definitionId:'tristana',copy:0}},
    reservedComponents:['gloves','vest'],anomalyTargetDefinitionId:'tristana',anomalyTargetCopy:0,anomalyDefinitionId:'slime-time',
    goldReserveByRound:{'4-5':19,'4-7':0},onRound:onProgress,onBattleProgress:onProgress},checkpointRound);
  // Preserve the donor-transfer scenario under the expanded shop: position, not ID, selects the survivor.
  const pair=players(s).filter(u=>u.definitionId==='tristana'),donor=pair.find(u=>s.anomalyBinding?.unitId===u.id)!,survivor=pair.find(u=>u.id!==donor.id)!;
  if(equipGloves)s=accepted(api.equipItem(s,s.items.find(i=>i.definitionId==='thiefs-gloves')!.id,donor.id,0));
  if(donor.location.kind==='board'&&survivor.location.kind==='board'){
    const a=donor.location,b=survivor.location;
    if(a.cell.row<b.cell.row||a.cell.row===b.cell.row&&a.cell.col<b.cell.col){
      const used=new Set(bench(s).map(u=>u.location.kind==='bench'?u.location.slot:-1)),slot=Array.from({length:9},(_,i)=>i).find(i=>!used.has(i))!;
      s=accepted(api.deployMatchUnit(s,donor.id,{kind:'bench',slot}));s=accepted(api.deployMatchUnit(s,survivor.id,a));s=accepted(api.deployMatchUnit(s,donor.id,b));
    }
  }
  return s;
}
// v22: seed 38 draws the scuttle-crab opening, whose 4-7 crabs carry the razorbeak orbs, so source
// deaths no longer name the frozen razorbeak slots. Seed 2253 has no opening encounter and the same
// 4-7 shape (component, reforger at entry 1, heroes) with the identical 3 HP / 97 lost entry.
const TERMINAL_SEED=2253;
export const TERMINAL_EMPTY_BOARD_ROUNDS=['1-3','1-4','2-1','2-2','2-3','2-5','2-6','2-7','3-1','3-2','3-3','3-7','4-1','4-2'] as const;
// A route that pauses after each complete battle (generate-m5-route's awaited onRound), so one long public
// campaign can be played a round per test case. Pausing never changes a command or a state.
export function pausableRoute(start:(onRound:(state:MatchState)=>Promise<void>)=>Promise<void>) {
  let target=0,pausedAt=0,started:Promise<void>|undefined,resume:(()=>void)|undefined,paused:(()=>void)|undefined;
  const onRound=(state:MatchState)=>state.round<target?Promise.resolve():new Promise<void>(resolve=>{pausedAt=state.round;resume=resolve;paused?.();});
  /** Play every battle through round ordinal `round` (Infinity: to the end). A supply round has no battle, so the
   * route may already be paused past it. */
  return async (round:number)=>{
    if(started&&pausedAt>=round)return;
    target=round;
    const reached=new Promise<void>(resolve=>{paused=resolve;});
    if(!started)started=start(onRound);
    else {const next=resume;resume=undefined;next?.();}
    await Promise.race([reached,started]);
  };
}
// v23: callers may name another crab-free terminal seed when 2253's roster cannot isolate their carriers.
const terminalRoutes=new Map<number,(round:number)=>Promise<void>>();
/** Play the shared terminal campaign through round ordinal `round` only; terminalPreparation finishes it. */
export async function advanceTerminalRoute(round:number,seed=TERMINAL_SEED) {
  const key=`terminal${seed}`;
  if(prefixes.has(key))return;
  let through=terminalRoutes.get(seed);
  if(!through) {
    const losses=new Set(TERMINAL_EMPTY_BOARD_ROUNDS);
    through=pausableRoute(async onRound=>{
      const captured=new Error('terminal capture');let prefix:MatchState|undefined;
      try {await run({...api,startMatchCombat(s:MatchState){if(s.roundDefinitionId==='4-7'){prefix=s;throw captured;}return api.startMatchCombat(s);}}, {seed,build:'cannon',emptyBoardRounds:[...losses,'4-7'],protectedUnitIds:[],onRound});
      }catch(e){if(e!==captured)throw e;}
      if(!prefix)throw Error('Missing terminal prefix');prefixes.set(key,fillBench(reserveExcept(prefix,[]),['ezreal']));
    });
    terminalRoutes.set(seed,through);
  }
  await through(round);
}
export async function terminalPreparation(keep:string|null,col=1,row=7,seed=TERMINAL_SEED) {
  const key=`terminal${seed}`;
  if(!prefixes.has(key)) {
    await advanceTerminalRoute(Infinity,seed);
    if(!prefixes.has(key))throw Error('Missing terminal prefix');
    terminalRoutes.delete(seed);
  }
  let s=structuredClone(prefixes.get(key)!);
  if(keep) {const unit=players(s).find(u=>u.id===keep||u.definitionId===keep);if(!unit)throw Error(`Missing terminal target ${keep}`);s=accepted(api.deployMatchUnit(s,unit.id,{kind:'board',cell:{col,row}}));}
  return fillBench(s,['ezreal']);
}
