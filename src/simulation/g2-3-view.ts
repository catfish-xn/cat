import type {MatchState} from './match-types';
import {deriveTraits} from './trait-snapshot';
import {g23Laboratories} from './g2-3-experiment';
import {g23JunkerMenu} from './g2-3-junker';
import {g23RewardAtoms} from './g2-3-rewards';
/** Owner-only detached data for Claude's generic mechanisms container.
 * No command, draw or grant occurs while projecting. Do not publish on opponent views. */
export function readG23MechanismState(state:MatchState){
 const p=state.g23;if(!p)return null;
 const tier=deriveTraits(state.preparation,'player').find(t=>t.traitId==='experiment')?.tier??0;
 return structuredClone({conqueror:{stacks:p.conquest.stacks,chestsOpened:p.conquest.chestsOpened},academy:{sponsored:p.sponsored,receipts:p.itemReceipts},
  chemBaron:p.chem,junkerKing:{eligibleRounds:p.junkerRounds,purchases:p.junkerPurchases,menu:g23JunkerMenu(state)},
  laboratories:g23Laboratories(p.seed,'player',tier),radiantConversion:p.conquest.radiantConversion,
  rewards:p.rewards.flatMap(b=>g23RewardAtoms(b,p.seed).map(a=>({...a,remaining:a.quantity-p.rewardClaims.filter(c=>c.atomId===a.id).length}))).filter(a=>a.remaining>0)});
}
