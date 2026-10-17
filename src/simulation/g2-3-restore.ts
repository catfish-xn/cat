import type {MatchState} from './match-types';
import {canonicalContent,equalValidatedContent} from './content';
import {openG23Choice} from './g2-3-runtime';
import {readG23Progress,validateG23MechanicLinks} from './g2-3-state';
import {g23SoloFacts} from './g2-3-settlement';
import {validateG23Progress} from './g2-3-match-progress';

/** Shared restore checks for G23 escrow, pending offers, receipts and settlement history.
 * Runs no grant hooks and consumes no live RNG; callers still validate the surrounding seat/save. */
export function validateG23Restoration(state:MatchState,parsedJsonInput=false):void {
 const equal=parsedJsonInput?equalValidatedContent:(a:unknown,b:unknown)=>canonicalContent(a)===canonicalContent(b);
 const check=(value:unknown,message:string)=>{if(!value)throw new RangeError('Invalid G23 restore: '+message);};
  check(!!state.seatMechanics?.hidden.progress&&!!readG23Progress(state), 'G23 progress required');
  validateG23MechanicLinks(state);
  if(state.phase==='choice'&&state.pendingChoice!.choiceId.startsWith('g23:')){
    const choice=state.pendingChoice!;const expected=openG23Choice({...state,phase:choice.returnPhase,pendingChoice:null} as MatchState);
    check(equal(expected.state.pendingChoice,choice),'G23 pending choice authority');
  }
  if(readG23Progress(state)){
    validateG23Progress(readG23Progress(state)!,state.seed,state.round);
    if(!state.multiplayer&&state.combat?.status==='finished'){
     const receipt=readG23Progress(state)!.economyReceipts.find(r=>r.kind==='battle'&&r.facts.round===state.round);
     check(receipt?.kind==='battle'&&equal(receipt.facts,g23SoloFacts(state,state.combat)),'G23 terminal combat facts');
    }
    for(const r of readG23Progress(state)!.economyReceipts)if(r.kind==='battle'){
      const history=state.roundResults.find(h=>h.round===r.facts.round);check(history&&history.roundKind!=='supply'&&r.facts.roundKind===(history.roundKind==='pvp'?'pvp':'pve')&&r.facts.result===(history.result==='playerWin'?'win':history.result==='enemyWin'?'loss':'draw'),'G23 settlement history');
      const multiplayer=state.multiplayer?.receipts.find(m=>m.round===r.facts.round);
      check(multiplayer?!!multiplayer.g23Facts&&equal(multiplayer.g23Facts,r.facts):r.facts.battleId===`round-${r.facts.round}`,'G23 settlement identity');
    }
  }
}
