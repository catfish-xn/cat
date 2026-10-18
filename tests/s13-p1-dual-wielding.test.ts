import {expect,it} from 'vitest';
import {createRequire} from 'node:module';
import * as api from '../src/simulation/match';
import type {MatchState} from '../src/simulation/match-types';
const {run}=createRequire(import.meta.url)('../scripts/generate-m5-route.cjs');
import {reachRound,accepted,resolveM5Choices} from './match-helpers';
import {selectAnomalyTarget,rerollAnomaly,selectChoice,sellUnit} from '../src/simulation/match';
import {serializeMatch,restoreMatch} from '../src/simulation/serialization';
import {dualWieldingItems,grantAnomalyAcquisition} from '../src/simulation/anomaly-acquisition';
import {DUAL_WIELDING_POOLS,DUAL_WIELDING_ROLES} from '../src/simulation/content/s13-p1-dual-wielding';
import {ITEM_DEFINITIONS} from '../src/simulation/content/g2-3-item-registry';
it('raw role pools are eight actual completed items and all sixty real heroes have explicit roles',()=>{
 expect(Object.keys(DUAL_WIELDING_POOLS)).toHaveLength(15);
 for(const pool of Object.values(DUAL_WIELDING_POOLS)){expect(pool).toHaveLength(8);for(const id of pool)expect(ITEM_DEFINITIONS[id].kind).toBe('completed');}
 expect(DUAL_WIELDING_ROLES.lux).toBe('APCASTER');expect(DUAL_WIELDING_ROLES.darius).toBe('ADFIGHTER');
 const expected=dualWieldingItems(42,'round-4-6:anomaly','lux');expect(expected).toHaveLength(2);expect(new Set(expected).size).toBe(2);
 expect(expected.every(id=>DUAL_WIELDING_POOLS.APCASTER.includes(id))).toBe(true);
});
it('public anomaly selection grants two role items once, keeps equipment, restores after target sale and rejects altered grant',async()=>{
 let s!:MatchState;const stop={};
 try{await run(api,{build:'cannon',seed:23,anomalyDefinitionId:'dual-wielding',onStep:(before:MatchState,result:{state:MatchState})=>{if(result.state.pendingChoice?.kind==='anomaly'&&result.state.pendingChoice.step==='offer'&&result.state.pendingChoice.offers.includes('dual-wielding')){s=result.state;throw stop;}}});}catch(e){if(e!==stop)throw e;}
 expect(s).toBeDefined();const target=s.preparation.units.find(u=>u.id===s.pendingChoice!.targetId)!;
 const before=s,c=s.pendingChoice!,expected=dualWieldingItems(s.seed,c.choiceId,target.definitionId);
 s=accepted(selectChoice(s,c.choiceId,c.generation,'dual-wielding'));
 const grants=s.seatMechanics!.receipts.filter(r=>r.source==='s13-anomaly-acquisition');expect(grants).toHaveLength(2);
 expect(grants.map(r=>'definitionId'in r?r.definitionId:null)).toEqual(expected);
 expect(s.items).toEqual(expect.arrayContaining(before.items));
 expect(s.items.length-before.items.length).toBe(2);
 expect(s.items.filter(i=>!before.items.some(old=>old.id===i.id)).every(i=>i.location.kind==='inventory')).toBe(true);
 expect(s.choiceRngState).toBe(before.choiceRngState);
 expect(restoreMatch(s)).toEqual(s);expect(restoreMatch(serializeMatch(s))).toEqual(s);
 expect(grantAnomalyAcquisition(s)).toEqual({state:s,events:[]});
 const illegal=selectChoice(s,c.choiceId,c.generation,'dual-wielding');expect(illegal.ok).toBe(false);expect(illegal.state).toBe(s);
 const forged=structuredClone(s),r=forged.seatMechanics!.receipts.find(r=>r.source==='s13-anomaly-acquisition')!;Object.assign(r,{definitionId:'deathblade'});expect(()=>restoreMatch(forged)).toThrow();
 s=resolveM5Choices(s);s=accepted(sellUnit(s,target.id));expect(s.anomalyBinding).toBe(null);expect(restoreMatch(serializeMatch(s))).toEqual(s);
});
