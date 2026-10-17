import {EventEmitter} from 'node:events';
import {createRequire} from 'node:module';
import {expect,it,vi} from 'vitest';
const {runRouteEvidence}=createRequire(import.meta.url)('../scripts/run-m5-route-evidence.cjs');

it('starts both complete workloads before waiting, preserving their commands and separate evidence',async()=>{
 const children:EventEmitter[]=[],calls:any[]=[];
 const launch=(...args:any[])=>{calls.push(args);const child=new EventEmitter();children.push(child);return child;};
 let finished=false;const result=runRouteEvidence(launch,{M5_JOB_KEY:'test-job'}).then((code:number)=>{finished=true;return code;});
 expect(children).toHaveLength(2);
 expect(calls.map(call=>call[1])).toEqual([
  ['scripts/ci-m5-step.cjs','headless','npm','run','test:headless'],
  ['scripts/ci-m5-step.cjs','performance','npm','run','test:performance'],
 ]);
 expect(calls[0][2]).toEqual({stdio:'inherit',env:{M5_JOB_KEY:'test-job'}});
 expect(calls[1][2]).toEqual({stdio:'inherit',env:{M5_JOB_KEY:'test-job',M5_EVIDENCE_DIR:'artifacts/m5-performance'}});
 children[1].emit('exit',0,null);await Promise.resolve();expect(finished).toBe(false);
 children[0].emit('exit',0,null);expect(await result).toBe(0);
});
it.each([[1,null],[null,'SIGTERM']])('retains both results and fails for exit %s signal %s',async(code,signal)=>{
 const children:EventEmitter[]=[];let finished=false;
 const result=runRouteEvidence(()=>{const child=new EventEmitter();children.push(child);return child;}).then((value:number)=>{finished=true;return value;});
 children[0].emit('exit',code,signal);await Promise.resolve();expect(finished).toBe(false);
 children[1].emit('exit',0,null);expect(await result).toBe(1);
});
it('reports spawn errors while still waiting for the other workload',async()=>{
 const error=vi.spyOn(console,'error').mockImplementation(()=>{}),children:EventEmitter[]=[];
 const result=runRouteEvidence(()=>{const child=new EventEmitter();children.push(child);return child;});
 children[0].emit('error',new Error('spawn failed'));children[1].emit('exit',0,null);
 expect(await result).toBe(1);expect(error).toHaveBeenCalled();error.mockRestore();
});
