import { existsSync, readFileSync } from 'node:fs';
import { beforeAll, expect, it } from 'vitest';
import { selectChoice, startMatchCombat, stepMatch, nextRound, buyUnit, rerollAugment } from '../src/simulation/match';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { requireAugmentFacts } from '../src/simulation/augment-history';
import { AUGMENT_OFFER_RULES, AUGMENT_POOL_API_NAMES } from '../src/simulation/content/augment-offer-rules';
import { accepted, reachRound, fieldBench, resolveM5Choices } from './match-helpers';
import { augmentCandidates } from '../src/simulation/augment-offers';
import { AUGMENT_BATCH5_H8 } from '../src/simulation/content/augment-pool-batch5-h8';
import { FIELDED_LEGS, fieldedRoute } from './augment-stage-helpers';

const RESEARCH_FILE='/home/aiapps/workspace/augments-research-2026-10-23/data/augments-14.24.json';
it.skipIf(!existsSync(RESEARCH_FILE))('Forward Thinking archive numbers and offer nodes',()=>{
 const rows=JSON.parse(readFileSync(RESEARCH_FILE,'utf8')) as any[];
 expect(rows.find(r=>r.apiName==='TFT_Augment_ForwardThinking').effects).toEqual({BaseGold:70,rounds:6,'{8f9a1368}':1});
 expect(AUGMENT_BATCH5_H8['forward-thinking'].source.values).toEqual(rows.find(r=>r.apiName==='TFT_Augment_ForwardThinking').effects);
 expect((AUGMENT_OFFER_RULES.nodeBans as Readonly<Record<string,readonly string[]>>)[AUGMENT_POOL_API_NAMES['forward-thinking']]).toEqual(['2-1','4-2']);
});
it.each(['2-1','3-2','4-2'])('only offers Forward Thinking at the allowed node %s',node=>{
 expect(augmentCandidates('gold',[],[],null,{node,fieldedTraits:[],blocked:[]}).includes('forward-thinking')).toBe(node==='3-2');
});
it('takes the real bank at the 3-2 public choice, replays the save and rejects tampering',()=>{
 // v26 re-pin (D5 pool +4 cards, 7953c99a): seed 11's 3-2 offer and its three slot rerolls no longer hold Forward
 // Thinking. Seed 10 is the first reachRound('3-2') seed from 0 that does (one slot reroll; 2-1 pick living-forge owns no history).
 let before=reachRound('3-2',false,10);
 for(let slot=0;slot<3&&!before.pendingChoice!.offers.includes('forward-thinking');slot++){const c=before.pendingChoice!;before=accepted(rerollAugment(before,c.choiceId,c.generation,slot));}
 const c=before.pendingChoice!;
 expect(c.offers).toContain('forward-thinking');expect(before.gold).toBeGreaterThan(0);
 const s=accepted(selectChoice(before,c.choiceId,c.generation,'forward-thinking'));
 expect(s.gold).toBe(0);expect(requireAugmentFacts(s,'acquire',s.round)[0].goldBefore).toBe(before.gold);
 const text=serializeMatch(s);expect(serializeMatch(restoreMatch(text))).toBe(text);
 const bad=structuredClone(s);(bad.augmentHistory!.facts[0] as any).goldBefore++;
 expect(()=>restoreMatch(bad)).toThrow();expect(()=>restoreMatch(JSON.stringify(bad))).toThrow();expect(()=>serializeMatch(bad)).toThrow();
});

let play: import('../src/simulation/match').MatchState, principal=0, startingRound=0;
const payoutEvents:import('../src/simulation/match-types').MatchEvent[]=[];
// v26 re-pin (D5 pool +4 cards, 7953c99a): fielded seed 15 no longer offers Forward Thinking at 3-2 within three slot
// rerolls. Seed 30 offers it but its 3-2 save needs crown-history replay; seed 37 is the next fielded seed from 0
// that offers it (two slot rerolls; 2-1 pick family-crest owns no augment history) and completes six PvP settlements.
// 14.24 neutrals (568eeea4) lengthen the PvE fights, so the same reachRoundFielded route is played in bounded legs
// (fieldedRoute, step for step identical) instead of inside one case; the case timeout is unchanged.
const FORWARD_THINKING_FIELDED_SEED=37;
for(const leg of FIELDED_LEGS.slice(0,FIELDED_LEGS.indexOf('3-2')+1))beforeAll(()=>{fieldedRoute(FORWARD_THINKING_FIELDED_SEED,leg);});
it('starts the six-combat route with a public Forward Thinking offer',()=>{
 const route=fieldedRoute(FORWARD_THINKING_FIELDED_SEED,'3-2');expect(route.roundDefinitionId).toBe('3-2');
 let before=restoreMatch(serializeMatch(route));
 for(let slot=0;slot<3&&!before.pendingChoice!.offers.includes('forward-thinking');slot++){const c=before.pendingChoice!;before=accepted(rerollAugment(before,c.choiceId,c.generation,slot));}
 const choice=before.pendingChoice!;expect(choice.offers).toContain('forward-thinking');
 play=accepted(selectChoice(before,choice.choiceId,choice.generation,'forward-thinking'));
 principal=before.gold;startingRound=before.round;
});
it.each(Array.from({length:18},(_,i)=>i))('plays route round %i with real commands',()=>{
 if(play.phase==='gameOver'||play.roundResults.filter(r=>r.roundKind==='pvp'&&r.round>=startingRound).length>=6)return;
 play=resolveM5Choices(play);
 if(play.phase==='preparation') {
  for(let slot=0;slot<play.shop.slots.length&&play.preparation.units.filter(u=>u.team==='player').length<4;slot++){const purchased=buyUnit(play,slot,play.shop.generation);if(purchased.ok)play=purchased.state;}
  const started=startMatchCombat(fieldBench(play));if(started.ok)payoutEvents.push(...started.events);play=accepted(started);while(play.phase==='combat'){const step=stepMatch(play);payoutEvents.push(...step.events);play=step.state;}
 }
 play=resolveM5Choices(play);
 if(play.phase==='settlement'&&play.roundResults.filter(r=>r.roundKind==='pvp'&&r.round>=startingRound).length<6)play=accepted(nextRound(play,play.round));
 // v26: every played round is also a replayed save checkpoint (stronger than the v25 route); this keeps each
 // history replay bounded to one round now that 14.24 neutrals (568eeea4) lengthen the PvE fights.
 const checkpoint=serializeMatch(play);expect(serializeMatch(restoreMatch(checkpoint))).toBe(checkpoint);
});
it('returns the original bank once after six actual PvP settlements',()=>{
 expect(play.roundResults.filter(r=>r.roundKind==='pvp'&&r.round>=startingRound)).toHaveLength(6);
 const receipts=play.seatMechanics!.receipts.filter(r=>r.source==='augment-batch5-h8-forward-thinking');
 expect(receipts).toHaveLength(1);expect(receipts[0]).toMatchObject({kind:'gold',amount:principal+70});
 expect(payoutEvents.filter(e=>e.type==='mechanicGranted'&&e.receipt.receiptId===receipts[0].receiptId)).toHaveLength(1);
});
let payoutText:string,payoutRestored:import('../src/simulation/match').MatchState,payoutReserialized:string;
it('serializes the payout checkpoint',()=>{payoutText=serializeMatch(play);});
it('restores the payout checkpoint',()=>{payoutRestored=restoreMatch(payoutText);});
it('serializes the restored payout checkpoint',()=>{payoutReserialized=serializeMatch(payoutRestored);});
it('keeps the payout checkpoint identical',()=>{expect(payoutReserialized).toBe(payoutText);});
