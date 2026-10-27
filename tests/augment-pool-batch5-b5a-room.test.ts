import { drainBatch1Gifts } from '../src/simulation/augment-pool-grants';
import { expect, it } from 'vitest';
import { applySeatCommand } from '../src/server/room/room';
import { grantAugmentAcquisition, openAugmentForge } from '../src/simulation/augment-acquisition';
import { room, conserved } from './tp-helpers';
import oracle from './fixtures/m5/augment-pool-batch5-b5a.cjs';

it.each(['all-that-shimmers','all-that-shimmers-plus'])('%s routes forge choice through the existing online room dispatch',id=>{
 const fixture=room(undefined,1),a={definitionId:id,choiceId:'round:2-1:augment',acquiredRound:1};
 const initial={...fixture.states[0],augments:[a]};
 const granted=grantAugmentAcquisition(initial,a).state;
 const state=openAugmentForge(granted).state,choice=state.pendingChoice!;
 expect(choice.offers).toEqual(oracle.items);
 const refused=applySeatCommand(fixture.pool,state,{type:'choose',choiceId:choice.choiceId,generation:choice.generation,definitionId:'deathblade'});
 expect(refused).toMatchObject({ok:false,state,pool:fixture.pool});
 const result=applySeatCommand(fixture.pool,state,{type:'choose',choiceId:choice.choiceId,generation:choice.generation,definitionId:oracle.items[0]});
 expect(result.ok).toBe(true);if(!result.ok)throw Error(result.reason);
 expect(result.state.items.some(item=>item.definitionId===oracle.items[0])).toBe(true);
 expect(result.state.seatMechanics!.receipts.filter(r=>r.receiptId===choice.choiceId)).toHaveLength(1);
 conserved(result.pool,[result.state]);
});

it('Roll the Dice grants its glove to a shared seat and equips it through room dispatch',()=>{
 const fixture=room(undefined,1),a={definitionId:'roll-the-dice',choiceId:'round:2-1:augment',acquiredRound:1};
 const state=drainBatch1Gifts({...fixture.states[0],augments:[a]});
 const gift=state.items.find(item=>item.definitionId===oracle['roll-the-dice'].item)!;
 const unit=state.preparation.units.find(unit=>unit.team==='player')!;
 const result=applySeatCommand(fixture.pool,state,{type:'equip',itemId:gift.id,unitId:unit.id,slot:0});
 expect(result.ok).toBe(true);if(!result.ok)throw Error(result.reason);
 expect(result.state.temporaryEquipment.filter(item=>item.parentItemInstanceId===gift.id)).toHaveLength(2);
 conserved(result.pool,[result.state]);
});
