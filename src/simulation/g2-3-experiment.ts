import { nextRandom } from './rng';
import type { Team,HexCell } from './board';
import type { CombatStrategyInputs } from './combat-input';
import type { Unit } from './unit-types';
import type { Effect } from './strategy-types';
import { UNIT_DEFINITIONS } from './units';
/** 约定值: project uniform sampling without replacement, independent LCG stream. */
export function g23Laboratories(seed:number,team:Team,tier:number):readonly HexCell[]{
 if(tier<3)return [];
 const cells=Array.from({length:4},(_,r)=>Array.from({length:7},(_,col)=>({col,row:team==='player'?4+r:3-r}))).flat();
 let rng=(seed^0x6c616273)>>>0;const result:HexCell[]=[];
 for(let i=0;i<(tier>=5?3:2);i++){const draw=nextRandom(rng);rng=draw.state;result.push(...cells.splice(Math.floor(draw.word*cells.length/2**32),1));}
 return result;
}
export function g23ExperimentEffects(state:CombatStrategyInputs,unit:Unit):Effect[]{
 if(unit.location.kind!=='board'||!UNIT_DEFINITIONS[unit.definitionId].traits.includes('experiment'))return [];
 const army=state.preparation.units.filter(u=>u.team===unit.team&&u.location.kind==='board'&&UNIT_DEFINITIONS[u.definitionId].traits.includes('experiment'));
 const count=new Set(army.map(u=>u.definitionId)).size,tier=count>=7?7:count>=5?5:count>=3?3:0;
 const labs=g23Laboratories(state.g23?.seed??0,unit.team,tier),onLab=(u:Unit)=>{const location=u.location;return location.kind==='board'&&labs.some(c=>c.col===location.cell.col&&c.row===location.cell.row);};
 if(!onLab(unit))return [];
 const donors=army.filter(onLab),factor=tier>=7?2:1;
 return [{kind:'statFlat',stat:'maxHp',amount:(tier>=5?300:100)+(donors.some(u=>u.definitionId==='drmundo')?120*factor:0)},
  {kind:'mechanic',mechanic:'g23Experiment',values:{mundo:donors.some(u=>u.definitionId==='drmundo')?60*factor:0,nunu:donors.some(u=>u.definitionId==='nunu')?300*factor:0,zyra:donors.some(u=>u.definitionId==='zyra')?5000*factor:0,urgot:donors.some(u=>u.definitionId==='urgot')?2000*factor:0,twitch:donors.some(u=>u.definitionId==='twitch')?2000*factor:0}}];
}
