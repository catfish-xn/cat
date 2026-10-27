import { existsSync, readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { selectChoice, rerollAugment, startMatchCombat, stepMatch } from '../src/simulation/match';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { requireAugmentFacts } from '../src/simulation/augment-history';
import { AUGMENT_OFFER_RULES, AUGMENT_POOL_API_NAMES } from '../src/simulation/content/augment-offer-rules';
import { accepted, fieldBench, reachRound, resolveM5Choices } from './match-helpers';
import { augmentCandidates } from '../src/simulation/augment-offers';
import { AUGMENT_BATCH5_H8, DHAMPYR_RULES } from '../src/simulation/content/augment-pool-batch5-h8';
const RESEARCH_FILE='/home/aiapps/workspace/augments-research-2026-10-23/data/augments-14.24.json';
it.skipIf(!existsSync(RESEARCH_FILE))('Vampiric Vitality archive numbers and offer nodes',()=>{
 const rows=JSON.parse(readFileSync(RESEARCH_FILE,'utf8')) as any[];
 expect(rows.find(r=>r.apiName==='TFT_Augment_Dhampyr').effects).toEqual({Omnivamp:0.20000000298023224,OmnivampStatBonus:0.11999999731779099});
 const values=rows.find(r=>r.apiName==='TFT_Augment_Dhampyr').effects;
 expect(AUGMENT_BATCH5_H8.dhampyr.source.values).toEqual(values);
 expect(DHAMPYR_RULES).toEqual({playerHealBps:Math.round(values.Omnivamp*10000),omnivampBps:Math.round(values.OmnivampStatBonus*10000)});
 expect((AUGMENT_OFFER_RULES.nodeBans as Readonly<Record<string,readonly string[]>>)[AUGMENT_POOL_API_NAMES.dhampyr]).toEqual(['2-1','4-2']);
});
it.each(['2-1','3-2','4-2'])('only offers Dhampyr at the allowed node %s',node=>{
 expect(augmentCandidates('gold',[],[],null,{node,fieldedTraits:[],blocked:[]}).includes('dhampyr')).toBe(node==='3-2');
});
let state:import('../src/simulation/match').MatchState;
it('selects through a real 3-2 choice and grants 12% omnivamp to the combat roster',()=>{
 let s=restoreMatch(serializeMatch(reachRound('3-2',false,3)));
 for(let i=0;i<3&&!s.pendingChoice!.offers.includes('dhampyr');i++){const c=s.pendingChoice!;s=accepted(rerollAugment(s,c.choiceId,c.generation,i));}
 const c=s.pendingChoice!;expect(c.offers).toContain('dhampyr');s=accepted(selectChoice(s,c.choiceId,c.generation,'dhampyr'));
 state=accepted(startMatchCombat(fieldBench(resolveM5Choices(s))));
 const players=state.combat!.units.filter(u=>u.team==='player');expect(players.length).toBeGreaterThan(0);
 for(const unit of players)expect(unit.mechanics).toEqual(expect.arrayContaining([expect.objectContaining({mechanic:'wealthyRehab',values:{omnivampBps:1200}})]));
});
it('solo unknown opponent HP never fabricates a heal',()=>{
 while(state.phase==='combat')state=stepMatch(state).state;
 expect(requireAugmentFacts(state,'player-damage',state.round).at(-1)).toMatchObject({actualDamage:null});
 expect(state.augmentHistory!.facts.filter(f=>f.kind==='player-health')).toHaveLength(0);
});
it('round trips and rejects object, JSON and serialization tampering',()=>{
 const text=serializeMatch(state);expect(serializeMatch(restoreMatch(text))).toBe(text);
 const bad=structuredClone(state);(bad.augmentHistory!.facts.find(f=>f.kind==='player-damage') as any).actualDamage=10;
 expect(()=>restoreMatch(bad)).toThrow();expect(()=>restoreMatch(JSON.stringify(bad))).toThrow();expect(()=>serializeMatch(bad)).toThrow();
});
