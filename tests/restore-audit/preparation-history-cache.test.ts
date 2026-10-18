import { expect, it, vi } from 'vitest';
import * as api from '../../src/simulation/match';
import { restoreMatch } from '../../src/simulation/serialization';
import { validatePreparationLedger } from '../../src/simulation/preparation-ledger';
import { accepted, purchasedThreeHeroMatch, resolveM5Choices } from '../match-helpers';

it('reuses only exact validated history and same-combat progress; replays every unverified tail and rejects mutations',()=>{
  let previous=accepted(api.startMatchCombat(purchasedThreeHeroMatch()));
  while(previous.phase==='combat') previous=api.stepMatch(previous).state;
  previous=resolveM5Choices(previous);
  const prepared=resolveM5Choices(accepted(api.nextRound(previous,previous.round)));
  const historySteps=prepared.preparationLedger.commands.reduce((n,c)=>n+(c.name==='stepMatch'?c.repeats:0),0);
  expect(historySteps).toBeGreaterThan(0);
  const start=accepted(api.startMatchCombat(prepared));
  const one=api.stepMatch(start).state, two=api.stepMatch(one).state;
  expect(two.combat!.tick).toBe(2);expect(two.phase).toBe('combat');
  const spy=vi.spyOn(api,'stepMatch');
  try {
    expect(restoreMatch(one)).toEqual(one);expect(spy).toHaveBeenCalledTimes(historySteps+1);
    // A later save of the same combat continues its verified progress: only the new tick replays.
    spy.mockClear();const restored=restoreMatch(two);expect(restored).toEqual(two);expect(spy).toHaveBeenCalledTimes(1);
    Object.assign(restored,{gold:999999});
    const three=api.stepMatch(two).state;spy.mockClear();expect(restoreMatch(three)).toEqual(three);expect(spy).toHaveBeenCalledTimes(1);
    // An earlier tick than the retained progress replays from the round boundary.
    const bad=structuredClone(two);Object.assign(bad,{gold:bad.gold+1});
    for(let i=0;i<2;i++){spy.mockClear();expect(()=>restoreMatch(bad)).toThrow('Invalid Match save: preparation-ledger-gold');expect(spy).toHaveBeenCalledTimes(2);}
    // A forged later tick still replays its new tick and is compared; rejection keeps the verified progress.
    const four=api.stepMatch(three).state,forged=structuredClone(four);Object.assign(forged,{gold:forged.gold+1});
    spy.mockClear();expect(()=>restoreMatch(forged)).toThrow('Invalid Match save: preparation-ledger-gold');expect(spy).toHaveBeenCalledTimes(1);
    spy.mockClear();expect(restoreMatch(four)).toEqual(four);expect(spy).toHaveBeenCalledTimes(1);
    const forgedTick=structuredClone(four);Object.assign(forgedTick.combat!,{tick:forgedTick.combat!.tick+1});
    expect(()=>restoreMatch(forgedTick)).toThrow('Invalid Match save:');
    expect(two.preparationLedger.events[0]).not.toHaveProperty('round');
    const event=structuredClone(two);Object.assign(event.preparationLedger.events[0],{auditAltered:1});
    spy.mockClear();expect(()=>validatePreparationLedger(event)).toThrow('preparation-ledger-event-history');expect(spy).toHaveBeenCalledTimes(historySteps+2);
    const result=structuredClone(two);Object.assign(result.roundResults[0],{goldAfter:result.roundResults[0].goldAfter+1});
    spy.mockClear();expect(()=>validatePreparationLedger(result)).toThrow('preparation-ledger-state-roundResults');expect(spy).toHaveBeenCalledTimes(historySteps+2);
    const rng=structuredClone(two);Object.assign(rng,{rngState:rng.rngState+1});
    expect(()=>restoreMatch(rng)).toThrow('preparation-ledger-rng-rngState');
    const command=structuredClone(two);Object.assign(command.preparationLedger.commands[0],{args:[]});
    expect(()=>restoreMatch(command)).toThrow('preparation-ledger-command');
    const own=structuredClone(two);let reads=0;
    Object.defineProperty(own,'gold',{enumerable:true,get(){return ++reads===1?two.gold:two.gold+1;}});
    expect(()=>restoreMatch(own)).toThrow('Invalid Match save:');
    expect(api.stepMatch(restoreMatch(three))).toEqual(api.stepMatch(three));
  } finally {spy.mockRestore();}
});
