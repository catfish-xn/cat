import {expect} from 'vitest';
import {restoreMatch,serializeMatch} from '../src/simulation/serialization';
import type {MatchState} from '../src/simulation/match';
export function trip(s:MatchState):void {
 const text=serializeMatch(s);expect(restoreMatch(text)).toEqual(s);expect(restoreMatch(JSON.parse(text))).toEqual(s);expect(restoreMatch(s)).toEqual(s);
}
export function reject(s:MatchState,mutate:(x:any)=>void):void {
 const x=structuredClone(s);mutate(x);
 expect(()=>restoreMatch(x)).toThrow();expect(()=>restoreMatch(JSON.stringify(x))).toThrow();expect(()=>serializeMatch(x)).toThrow();
}
