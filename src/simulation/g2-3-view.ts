import { familyReunionView } from './family-reunion';
import { familyDisplay } from './family-heist';
import {readG23Progress} from './g2-3-state';
import type {MatchState} from './match-types';
import {deriveTraits} from './trait-snapshot';
import {g23Laboratories} from './g2-3-experiment';
import {g23JunkerMenu} from './g2-3-junker';
import {g23RewardAtoms} from './g2-3-rewards';
/** Owner-only detached data for Claude's generic mechanisms container.
 * No command, draw or grant occurs while projecting. Do not publish on opponent views. */
export function readG23MechanismState(state:MatchState){
 const p=readG23Progress(state);if(!p)return null;
 const tier=deriveTraits(state.preparation,'player',undefined,undefined,state.items).find(t=>t.traitId==='experiment')?.tier??0;
 return structuredClone({familyHeist:familyDisplay(p.family)??(state.seatMechanics?.seat.familyHeist as ReturnType<typeof familyDisplay>|undefined)??null,familyReunion:familyReunionView(state),mel:p.mel??null,conqueror:{stacks:p.conquest.stacks,chestsOpened:p.conquest.chestsOpened},academy:{sponsored:p.sponsored,receipts:p.itemReceipts},
  chemBaron:p.chem,junkerKing:{eligibleRounds:p.junkerRounds,purchases:p.junkerPurchases,menu:g23JunkerMenu(state)},
  laboratories:g23Laboratories(p.seed,'player',tier),radiantConversion:p.conquest.radiantConversion,
  rewards:p.rewards.flatMap(b=>g23RewardAtoms(b,p.seed,!!state.multiplayer).map(a=>({...a,remaining:a.quantity-p.rewardClaims.filter(c=>c.atomId===a.id).length}))).filter(a=>a.remaining>0)});
}
