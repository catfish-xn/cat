import {afterEach,describe,it,expect,vi} from 'vitest';
import {routeSaveFile} from '../src/persistence/compatibility';
import {legacyRecords,LEGACY_M8_NAMESPACE,M8_NAMESPACE} from '../src/persistence/legacy-records';
import {restoreMatch} from '../src/simulation/serialization';
import {readFileSync} from 'node:fs';
const oldFile=()=>JSON.parse(readFileSync(new URL('./fixtures/t12-herald-raw/edge-of-night.json',import.meta.url)).toString());
afterEach(()=>vi.unstubAllGlobals());
describe('D8 old format 2 preservation',()=>{
 it('routes actual T12 data as export-only and refuses continuation without mutation',()=>{
  const match=oldFile(),file={kind:'hex-autobattler-save',saveFormatVersion:2,replayFormatVersion:2,runId:'old',createdAt:'2026-10-14T00:00:00Z',match,battles:[],currentBattle:null};
  const before=JSON.stringify(file),r=routeSaveFile(file);
  expect(r).toMatchObject({envelope:null,view:{status:'legacy-preserved',canResume:false,canReplay:false,canExportOriginal:true,reason:'new-match-required'}});
  expect(()=>restoreMatch(match)).toThrow();expect(JSON.stringify(file)).toBe(before);
  expect(M8_NAMESPACE).not.toBe(LEGACY_M8_NAMESPACE);
 });
 it('lists and exports the original M8 namespace through read-only transactions',async()=>{
  const match=oldFile(),run={runId:'old',createdAt:'2026-10-14T00:00:00Z',match,currentBattle:null,battleKeys:[]};
  const accesses:string[]=[];
  const data:Record<string,Record<string,unknown>>={metadata:{current:{runId:'old',revision:7},completed:[]},runs:{old:run},battles:{}};
  vi.stubGlobal('indexedDB',{open(name:string){
   accesses.push(`open:${name}`);const request:any={};
   queueMicrotask(()=>{
    if(name!==LEGACY_M8_NAMESPACE){request.transaction={abort(){queueMicrotask(()=>request.onerror({preventDefault(){}}));}};request.onupgradeneeded({oldVersion:0});return;}
    request.result={objectStoreNames:{contains:(s:string)=>s in data},close(){},transaction(stores:string[],mode:string){
     accesses.push(`transaction:${mode}:${stores.join(',')}`);expect(mode).toBe('readonly');
     const transaction:any={objectStore(store:string){return {get(key:string){const req:any={};queueMicrotask(()=>{req.result=data[store][key];req.onsuccess();});return req;}};}};
     setTimeout(()=>transaction.oncomplete(),0);return transaction;
    }};request.onsuccess();
   });return request;
  }});
  const list=await legacyRecords.listLegacyRecords();expect(list.ok).toBe(true);if(!list.ok)throw Error(list.reason);
  expect(list.records).toHaveLength(1);expect(list.records[0]).toMatchObject({saveFormatVersion:2,schemaVersion:6,canExportOriginal:true,recordRef:{namespace:LEGACY_M8_NAMESPACE}});
  const exported=await legacyRecords.exportLegacy({requestId:'export',recordRef:list.records[0].recordRef});expect(exported.ok).toBe(true);if(!exported.ok)throw Error(exported.reason);
  expect(new TextDecoder().decode(exported.bytes)).toBe(JSON.stringify({kind:'hex-autobattler-save',saveFormatVersion:2,replayFormatVersion:2,runId:'old',createdAt:run.createdAt,match,currentBattle:null,battles:[]}));
  expect(accesses.every(a=>!a.includes(M8_NAMESPACE))).toBe(true);
 });
});
