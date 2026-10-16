import {readG23Progress} from './g2-3-state';
import type { MatchState } from './match-types';
import type { Effect } from './strategy-types';
import { nextRandom } from './rng';
export const G23_JUNKER_PAID=['flamethrower','petricite-rod','repairing-microbots','self-destruct','tankbuster'] as const;
export type G23JunkerUpgrade=typeof G23_JUNKER_PAID[number]|'spare-parts'|'finishing-touch'|'junkyard-titan';
export interface G23JunkerPurchase{readonly id:string;readonly round:number;readonly unitId:string;readonly upgrade:G23JunkerUpgrade;readonly cost:number}
/** 约定值: source does not specify historical menu sampling or tie breaks. */
export function g23JunkerMenu(state:Pick<MatchState,'preparation'|'round'>&Parameters<typeof readG23Progress>[0]){
 const p=readG23Progress(state);if(!p||p.junkerRounds<3*(p.junkerPurchases.length+1))return null;
 const strongest=state.preparation.units.filter(u=>u.team==='player'&&u.definitionId==='rumble').sort((a,b)=>b.starLevel-a.starLevel||(a.id<b.id?-1:1))[0];if(!strongest)return null;
 const purchased=new Set(p.junkerPurchases.map(r=>r.upgrade));
 const remaining=G23_JUNKER_PAID.filter(id=>!purchased.has(id)),choices:G23JunkerUpgrade[]=[];
 if(strongest.starLevel===3&&!purchased.has('junkyard-titan'))choices.push('junkyard-titan');
 else if(!remaining.length)choices.push('finishing-touch');
 else{
  let rng=(p.seed^0x72756d62^p.junkerPurchases.length)>>>0;
  for(let n=0;n<2&&remaining.length;n++){const draw=nextRandom(rng);rng=draw.state;choices.push(...remaining.splice(Math.floor(draw.word*remaining.length/2**32),1));}
  choices.push('spare-parts');
 }
 return {id:`g23:junker:${p.junkerPurchases.length+1}`,unitId:strongest.id,choices};
}
export function g23JunkerEffects(state:Parameters<typeof readG23Progress>[0],unitId:string):Effect[]{
 const receipts=readG23Progress(state)?.junkerPurchases.filter(r=>r.unitId===unitId)??[];if(!receipts.length)return [];
 const titan=receipts.some(r=>r.upgrade==='junkyard-titan'),has=(id:G23JunkerUpgrade)=>titan||receipts.some(r=>r.upgrade===id);
 const spare=receipts.filter(r=>r.upgrade==='spare-parts').length,finish=receipts.filter(r=>r.upgrade==='finishing-touch').length;
 return [{kind:'statFlat',stat:'maxHp',amount:spare*50+finish*300},{kind:'statFlat',stat:'abilityPower',amount:spare*3+finish*25},
 ...(has('self-destruct')?[{kind:'statPercentBps' as const,stat:'armor' as const,bps:2500},{kind:'statPercentBps' as const,stat:'magicResist' as const,bps:2500}]:[]),
 {kind:'mechanic',mechanic:'g23Junker',values:{flame:+has('flamethrower'),rod:+has('petricite-rod'),repair:+has('repairing-microbots'),death:+has('self-destruct'),tank:+has('tankbuster'),titan:+titan}}];
}
