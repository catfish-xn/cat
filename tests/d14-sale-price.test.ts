import { expect, it } from 'vitest';
import { createMatch, sellUnit } from '../src/simulation/match';
import { getUnitSellPrice } from '../src/simulation/unit-stats';
import { grantMechanicUnit } from '../src/simulation/seat-mechanics';
import { toPrivateSeatView } from '../src/simulation/private-seat-view';

it.each([['lux',9],['rell',17]] as const)('effective four-star %s uses its own three-star sale price %i', (definitionId,price) => {
  let state=createMatch(42);
  for(let n=0;n<9;n++){
    const result=grantMechanicUnit(state,{receiptId:`price:${n}`,source:'test',definitionId});
    if(!result.ok)throw Error(result.reason);
    state=result.state;
  }
  const unit=state.preparation.units.find(u=>u.definitionId===definitionId&&u.starLevel===3)!;
  expect(unit).toBeDefined();
  expect(getUnitSellPrice({definitionId,starLevel:3})).toBe(price);
  // Price-only projection vector: this does not admit a two-cost Ultimate Hero.
  // Live target eligibility remains restricted to one-cost champions.
  const projected=toPrivateSeatView({...state,d14:{choiceId:'price-only',anomalyId:'ultimate-hero',
    originalUnit:unit,unitId:unit.id,atOrdinal:0,selectionPrefixLength:1,phase:'promoted',held:null}});
  expect(projected.preparation.units.find(u=>u.id===unit.id)).toMatchObject({starLevel:3,effectiveStarLevel:4,sellGold:price,poolCopies:9});
  expect(projected.d14Display).toMatchObject({sellGold:price,poolCopies:9});
  const sold=sellUnit(state,unit.id);
  if(!sold.ok)throw Error(sold.reason);
  expect(sold.state.gold-state.gold).toBe(price);
});
