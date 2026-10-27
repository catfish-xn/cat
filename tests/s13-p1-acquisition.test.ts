import { firstNodeSeed, offerFor, offeredAt } from './augment-stage-helpers';
import {expect,it} from 'vitest';
import {reachRound,accepted,emptyBoard,resolveM5Choices} from './match-helpers';
import {createMatch,selectChoice,equipItem,useConsumable,startMatchCombat,nextRound} from '../src/simulation/match';
import {serializeMatch,restoreMatch} from '../src/simulation/serialization';
import {augmentForgeOffers,grantAugmentAcquisition} from '../src/simulation/augment-acquisition';
// v24 shop pool: first non-Trainer-Golem seed from 0 whose public 2-1 offer holds each card.
// Blinding Speed remains a 3-2 card and follows augment-stage-helpers' first allowed round.
const acquisitionSeeds:Record<string,number>={'portable-forge':firstNodeSeed('portable-forge'),'radiant-relics':firstNodeSeed('radiant-relics')};
function select(id:string){
 if(offeredAt(id,'2-1'))expect(createMatch(acquisitionSeeds[id]).preparation.units.some(u=>u.definitionId==='trainer-golem')).toBe(false);
 const s=offeredAt(id,'2-1')?reachRound('2-1',false,acquisitionSeeds[id]):offerFor(id),c=s.pendingChoice!;
 expect(s.roundDefinitionId).toBe(offeredAt(id,'2-1')?'2-1':'3-2');
 expect(c.offers).toContain(id);
 return accepted(selectChoice(s,c.choiceId,c.generation,id));
}
it('Blinding Speed grants exactly red buff, rageblade, bow and removable-tool once, all restorable',()=>{
 let state=select('blinding-speed');
 const receipts=state.seatMechanics!.receipts.filter(r=>r.source==='s13-augment-acquisition');
 expect(receipts).toHaveLength(4);
 expect(receipts.filter(r=>r.kind==='item').map(r=>'definitionId'in r?r.definitionId:'')).toEqual(['red-buff','rageblade','bow']);
 expect(receipts.filter(r=>r.kind==='consumable').map(r=>'definitionId'in r?r.definitionId:'')).toEqual(['magnetic-remover']);
 expect(restoreMatch(serializeMatch(state))).toEqual(state);
 const again=grantAugmentAcquisition(state,state.augments.at(-1)!);expect(again.state).toBe(state);expect(again.events).toEqual([]);
 const forged=structuredClone(state),r=forged.seatMechanics!.receipts.find(r=>r.source==='s13-augment-acquisition'&&r.kind==='item')!;
 Object.assign(r,{definitionId:'deathblade'});expect(()=>restoreMatch(forged)).toThrow();
 const item=state.items.find(i=>i.definitionId==='red-buff')!;
 state=accepted(equipItem(state,item.id,'unit-1',0));
 const tool=state.consumables.find(c=>c.definitionId==='magnetic-remover')!;
 state=accepted(useConsumable(state,tool.consumableId,{kind:'unit',unitId:'unit-1'}));
 expect(state.items.find(i=>i.id===item.id)?.location.kind).toBe('inventory');
 expect(restoreMatch(serializeMatch(state))).toEqual(state);
});
it.each([['portable-forge',4,'artifact',0],['radiant-relics',5,'radiant',1]] as const)('%s offers exact choice size and survives pending/selected saves', (id,count,_kind,tools)=>{
 let state=select(id);const c=state.pendingChoice!,a=state.augments.at(-1)!;
 expect(c.kind).toBe('forge');expect(c.offers).toHaveLength(count);expect(new Set(c.offers).size).toBe(count);
 expect(c.offers).toEqual(augmentForgeOffers(state.seed,a));
 expect(state.seatMechanics!.receipts.filter(r=>r.source==='s13-augment-acquisition'&&r.kind==='consumable')).toHaveLength(tools);
 expect(restoreMatch(serializeMatch(state))).toEqual(state);
 const rng=[state.rngState,state.choiceRngState,state.rewardRngState,state.battleSeedRngState];
 const invalid=selectChoice(state,c.choiceId,c.generation,'no-such-item');expect(invalid.ok).toBe(false);expect(invalid.state).toBe(state);
 const chosen=c.offers[0];state=accepted(selectChoice(state,c.choiceId,c.generation,chosen));
 expect(state.items.filter(i=>i.definitionId===chosen)).toHaveLength(1);
 expect([state.rngState,state.choiceRngState,state.rewardRngState,state.battleSeedRngState]).toEqual(rng);
 expect(restoreMatch(serializeMatch(state))).toEqual(state);
 const retry=selectChoice(state,c.choiceId,c.generation,chosen);expect(retry.ok).toBe(false);expect(retry.state).toBe(state);
 const forged=structuredClone(state);const receipt=forged.seatMechanics!.receipts.find(r=>r.receiptId===c.choiceId)!;Object.assign(receipt,{optionId:'deathblade'});
 expect(()=>restoreMatch(forged)).toThrow();
 state=resolveM5Choices(accepted(startMatchCombat(emptyBoard(state))));
 expect(restoreMatch(state)).toEqual(state);expect(restoreMatch(serializeMatch(state))).toEqual(state);
 state=accepted(nextRound(state,state.round));expect(restoreMatch(serializeMatch(state))).toEqual(state);
});
