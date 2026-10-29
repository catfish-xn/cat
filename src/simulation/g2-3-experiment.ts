import { addMutationDonation, hasMutationSurvives, mutationSacrificeCell } from './augment-pool-batch5-g3-mutation';
import { nextRandom } from './rng';
import type { Team,HexCell } from './board';
import type { CombatStrategyInputs } from './combat-input';
import type { Unit } from './unit-types';
import type { Effect } from './strategy-types';
import {deriveEffectiveTrait,projectEffectiveMembership} from './traits/effective-membership';
import type { TraitSnapshot } from './strategy-types';
import { EMBLEM_SOURCE } from './content/emblem-source';
import { G23_TRAIT_SOURCE } from './content/g2-3-trait-runtime';
const EMBLEM=EMBLEM_SOURCE.find(r=>r.traitId==='experiment')!;
/** Option A (P-EX1, 2026-10-24): clone max HP = PercentMaxHealth 0.6 x tier Scaling {a02e81c2}
 * (1.15/1.3/1.5) = 69/78/90%; the tier-7 bonus increase does not apply again. */
export function experimentCloneHealthBps(tier:number):number {
 const row=[...G23_TRAIT_SOURCE.experiment.tiers].reverse().find(t=>tier>=t.threshold);
 return row?Math.round((EMBLEM.values as Readonly<Record<string,number|undefined>>).PercentMaxHealth!*(row.values as Record<string,number>)['{a02e81c2}']*10000):0;
}
export const EXPERIMENT_SPLIT_TICK=(EMBLEM.values as Readonly<Record<string,number|undefined>>).SplitTime!*20;
/** 约定值: project uniform sampling without replacement, independent LCG stream. */
export function g23Laboratories(seed:number,team:Team,tier:number,excluded?:HexCell):readonly HexCell[]{
 if(tier<3)return [];
 const cells=Array.from({length:4},(_,r)=>Array.from({length:7},(_,col)=>({col,row:team==='player'?4+r:3-r}))).flat().filter(c=>!excluded||c.col!==excluded.col||c.row!==excluded.row);
 let rng=(seed^0x6c616273)>>>0;const result:HexCell[]=[];
 for(let i=0;i<(tier>=5?3:2);i++){const draw=nextRandom(rng);rng=draw.state;result.push(...cells.splice(Math.floor(draw.word*cells.length/2**32),1));}
 return result;
}
export function g23ExperimentEffects(state:CombatStrategyInputs,unit:Unit,traits?:readonly TraitSnapshot[]):Effect[]{
 const experiment=traits?traits.find(t=>t.team===unit.team&&t.traitId==='experiment'):deriveEffectiveTrait(projectEffectiveMembership(state.preparation,undefined,undefined,state.items),unit.team,'experiment');
 const member=(u:Unit)=>experiment?.memberUnitIds?experiment.memberUnitIds.includes(u.id):experiment?.memberDefinitionIds.includes(u.definitionId);
 if(unit.location.kind!=='board'||!member(unit))return [];
 const army=state.preparation.units.filter(u=>u.team===unit.team&&u.location.kind==='board'&&member(u));
 const tier=experiment?.tier??0;
 const labs=unit.team==='player'&&state.visibleExperimentCells?state.visibleExperimentCells:g23Laboratories(state.g23?.seed??0,unit.team,tier,unit.team==='player'&&hasMutationSurvives(state.augments)?mutationSacrificeCell('player',state.preparation.board):undefined),onLab=(u:Unit)=>{const location=u.location;return location.kind==='board'&&labs.some(c=>c.col===location.cell.col&&c.row===location.cell.row);};
 if(!onLab(unit))return [];
 const donors=army.filter(onLab),factor=tier>=7?2:1;
 // The emblem holder on a Laboratory donates "summon a copy of this unit" to every Experiment on a Laboratory.
 const cloner=donors.some(u=>state.items.some(i=>i.definitionId===EMBLEM.apiName&&i.location.kind==='unit'&&i.location.unitId===u.id));
 return addMutationDonation(state,unit,traits??[experiment!],[{kind:'statFlat',stat:'maxHp',amount:(tier>=5?300:100)+(donors.some(u=>u.definitionId==='drmundo')?120*factor:0)},
  {kind:'mechanic',mechanic:'g23Experiment',values:{...(donors.some(u=>u.definitionId==='warwick')?{warwick:20*factor}:{}),mundo:donors.some(u=>u.definitionId==='drmundo')?60*factor:0,nunu:donors.some(u=>u.definitionId==='nunu')?300*factor:0,zyra:donors.some(u=>u.definitionId==='zyra')?5000*factor:0,urgot:donors.some(u=>u.definitionId==='urgot')?2000*factor:0,twitch:donors.some(u=>u.definitionId==='twitch')?2000*factor:0}},
  ...(cloner?[{kind:'mechanic' as const,mechanic:'g23ExperimentClone',values:{healthBps:experimentCloneHealthBps(tier),splitTick:EXPERIMENT_SPLIT_TICK}}]:[])],tier,labs,experimentCloneHealthBps(tier),EXPERIMENT_SPLIT_TICK);
}
