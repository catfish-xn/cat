import {describe,it,expect} from 'vitest';
import {createMatch} from '../../src/simulation/match';
import {restoreMatch,serializeMatch} from '../../src/simulation/serialization';
import {grantXp} from '../../src/simulation/progression';

// Characterization of currently accepted corruption; these are audit evidence, not desired rules.
function original(){const s=createMatch(42);expect(restoreMatch(serializeMatch(s))).toEqual(s);return s;}
function accepts(mutator:(s:any)=>void){const s=original(),bad=JSON.parse(serializeMatch(s));mutator(bad);expect(bad).not.toEqual(s);expect(restoreMatch(bad)).toEqual(bad);expect(restoreMatch(JSON.stringify(bad))).toEqual(bad);}
describe('restore audit: Match authority gaps',()=>{
 it('accepts preparation gold inflation without any command or income receipt',()=>accepts(s=>{s.gold+=100000;}));
 it('accepts four free experience without spending gold',()=>accepts(s=>{const p=grantXp(s.level,s.xp,4);s.level=p.level;s.xp=p.xp;}));
 it.each(['rngState','choiceRngState','rewardRngState','battleSeedRngState'])('accepts an arbitrary valid %s cursor at opening',(key)=>accepts(s=>{s[key]=(s[key]+1)>>>0;}));
 it('accepts arbitrary next match event serial',()=>accepts(s=>{s.nextMatchEventSeq+=100000;}));
 it('accepts arbitrary shop generation without refresh',()=>accepts(s=>{s.shop.generation+=100000;}));
});
