import {expect,it} from 'vitest';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {M5_UNIT_DEFINITIONS} from '../src/simulation/units';
import {CONTENT_DIGEST} from '../src/simulation/content';
import * as api from '../src/simulation/match';
import type {MatchState} from '../src/simulation/match-types';
const {dispatch,run}=createRequire(import.meta.url)('../scripts/generate-m5-route.cjs');
import historicalIdentity from './g2-4b-content-baseline.json';
import {accepted,resolveM5Choices} from './match-helpers';
import {selectChoice,sellUnit} from '../src/simulation/match';
import {serializeMatch,restoreMatch} from '../src/simulation/serialization';
import {dualWieldingItems,grantAnomalyAcquisition} from '../src/simulation/anomaly-acquisition';
import {DUAL_WIELDING_POOLS,DUAL_WIELDING_ROLES} from '../src/simulation/content/s13-p1-dual-wielding';
import {ITEM_DEFINITIONS} from '../src/simulation/content/g2-3-item-registry';
it('raw role pools are eight actual completed items and all sixty real heroes have explicit roles',()=>{
 expect(Object.keys(DUAL_WIELDING_POOLS)).toHaveLength(15);
 for(const pool of Object.values(DUAL_WIELDING_POOLS)){expect(pool).toHaveLength(8);for(const id of pool)expect(ITEM_DEFINITIONS[id].kind).toBe('completed');}
 for(const unit of Object.values(M5_UNIT_DEFINITIONS)){const pool=DUAL_WIELDING_POOLS[DUAL_WIELDING_ROLES[unit.id]];expect(pool).toHaveLength(8);const draw=dualWieldingItems(42,'round-4-6:anomaly',unit.id);expect(draw).toHaveLength(2);expect(new Set(draw).size).toBe(2);expect(draw.every(id=>pool.includes(id))).toBe(true);}
 expect(DUAL_WIELDING_ROLES.lux).toBe('APCASTER');expect(DUAL_WIELDING_ROLES.darius).toBe('ADFIGHTER');
 const expected=dualWieldingItems(42,'round-4-6:anomaly','lux');expect(expected).toHaveLength(2);expect(new Set(expected).size).toBe(2);
 expect(expected.every(id=>DUAL_WIELDING_POOLS.APCASTER.includes(id))).toBe(true);
});
it('public anomaly selection grants two role items once, keeps equipment, restores after target sale and rejects altered grant',async()=>{
 const archived=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/s13-p1-dual-commands.json.gz',import.meta.url))).toString());
 expect(archived.seed).toBe(23);expect(archived.contentDigest).toBe(historicalIdentity.contentDigest);
 expect(archived.contentDigest).not.toBe(CONTENT_DIGEST);
 // The archived command tape remains historical. Generate the current v15
 // tape from genuine paid commands and the independent route ledger.
 const trace:{seed:number;commands:unknown[]}={seed:23,commands:[]},stop=new Error('v15 dual offer');
 let captured=false;
 try{await run(api,{build:'cannon',seed:trace.seed,goldReserveByRound:{'4-5':80},anomalyDefinitionId:'dual-wielding',onStep(_before:MatchState,result:{state:MatchState},command:unknown){
  trace.commands.push(command??{type:'step'});
  const c=result.state.pendingChoice;
  if(c?.kind==='anomaly'&&c.step==='offer'&&c.offers.includes('dual-wielding')){captured=true;throw stop;}
 }});}catch(error){if(error!==stop)throw error;}
 expect(captured).toBe(true);
 let s:MatchState=api.createMatch(trace.seed);
 for(const command of trace.commands){const c=command as {type:string};const result=c.type==='step'?api.stepMatch(s):dispatch(api,s,c);if(result.ok===false)throw Error(result.reason);s=result.state;}
 expect(s.contentDigest).toBe(CONTENT_DIGEST);
 expect(s).toBeDefined();const target=s.preparation.units.find(u=>u.id===s.pendingChoice!.targetId)!;
 const before=s,c=s.pendingChoice!,expected=dualWieldingItems(s.seed,c.choiceId,target.definitionId);
 s=accepted(selectChoice(s,c.choiceId,c.generation,'dual-wielding'));
 const grants=s.seatMechanics!.receipts.filter(r=>r.source==='s13-anomaly-acquisition');expect(grants).toHaveLength(2);
 expect(grants.map(r=>'definitionId'in r?r.definitionId:null)).toEqual(expected);
 expect(s.items).toEqual(expect.arrayContaining([...before.items]));
 expect(s.items.length-before.items.length).toBe(2);
 expect(s.items.filter(i=>!before.items.some(old=>old.id===i.id)).every(i=>i.location.kind==='inventory')).toBe(true);
 expect(s.choiceRngState).toBe(before.choiceRngState);
 expect(restoreMatch(s)).toEqual(s);expect(restoreMatch(serializeMatch(s))).toEqual(s);
 expect(grantAnomalyAcquisition(s)).toEqual({state:s,events:[]});
 const illegal=selectChoice(s,c.choiceId,c.generation,'dual-wielding');expect(illegal.ok).toBe(false);expect(illegal.state).toBe(s);
 const swapped=structuredClone(s),other=swapped.preparation.units.find(u=>u.team==='player'&&u.id!==target.id&&DUAL_WIELDING_ROLES[u.definitionId]===DUAL_WIELDING_ROLES[target.definitionId]);
 expect(other).toBeDefined();Object.assign(swapped.scheduleReceipts.find(r=>r.eventId===c.choiceId)!,{unitId:other!.id});expect(()=>restoreMatch(swapped)).toThrow();
 const forged=structuredClone(s),r=forged.seatMechanics!.receipts.find(r=>r.source==='s13-anomaly-acquisition')!;Object.assign(r,{definitionId:'deathblade'});expect(()=>restoreMatch(forged)).toThrow();
 s=resolveM5Choices(s);s=accepted(sellUnit(s,target.id));expect(s.anomalyBinding).toBe(null);expect(restoreMatch(serializeMatch(s))).toEqual(s);
},20_000);
