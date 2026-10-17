import {describe,it,expect} from 'vitest';
import {createMatch} from '../../src/simulation/match';
import {restoreMatch,serializeMatch} from '../../src/simulation/serialization';
import {grantXp} from '../../src/simulation/progression';

// MA1/MA2/MA2b audit vectors now assert the precise rejection at both public restore entrances.
function original(){const s=createMatch(42);expect(restoreMatch(serializeMatch(s))).toEqual(s);return s;}
function rejects(mutator:(s:any)=>void, reason:string){const s=original(),bad=JSON.parse(serializeMatch(s));mutator(bad);expect(bad).not.toEqual(s);for(const input of [bad,JSON.stringify(bad)])expect(()=>restoreMatch(input)).toThrow(`Invalid Match save: preparation-ledger-${reason}`);}
describe('restore audit: Match authority gaps closed',()=>{
 it('rejects preparation gold inflation without any command or income receipt',()=>rejects(s=>{s.gold+=100000;},'gold'));
 it('rejects four free experience without spending gold',()=>rejects(s=>{const p=grantXp(s.level,s.xp,4);s.level=p.level;s.xp=p.xp;},'experience'));
 it('rejects coordinated free experience and a purported matching gold payment',()=>rejects(s=>{const p=grantXp(s.level,s.xp,4);s.level=p.level;s.xp=p.xp;s.gold+=4;},'gold'));
 it.each(['rngState','choiceRngState','rewardRngState','battleSeedRngState'])('rejects arbitrary valid %s cursor at opening',(key)=>rejects(s=>{s[key]=(s[key]+1)>>>0;},`rng-${key}`));
 it('rejects arbitrary next match event serial',()=>rejects(s=>{s.nextMatchEventSeq+=100000;},'event-history'));
 it('rejects arbitrary shop generation without refresh',()=>rejects(s=>{s.shop.generation+=100000;},'shop'));
 it('refuses the old format without a command ledger',()=>rejects(s=>{delete s.preparationLedger;},'missing'));
});
