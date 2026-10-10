/**
 * U6 static display samples. Hand-written values typed against the frozen LootView and
 * PendingChoice so they cannot drift from the contract. Sources/slots follow M8B_LOOT §2 and
 * the choiceId encoding follows M8B_CONTRACT_ADDENDUM §3.3. They are NOT game state: nothing
 * here is computed, granted, settled or derived from a hidden fallback, and the game entry
 * never imports this module.
 */
import type { LootView, RevealedDropView } from '../../simulation/m8/ui-contracts';
import type { PendingChoice } from '../../simulation/strategy-types';

const source = (roundId: string, encounterId: string, slotId: string) => JSON.stringify(['pve', roundId, encounterId, slotId]);
const dropId = (roundId: string, encounterId: string, sourceUnitId: string, slot: number) => JSON.stringify([roundId, encounterId, sourceUnitId, slot]);
const receipt = (id: string) => JSON.stringify([id, 'grant']);
const COMPONENTS = ['sword', 'vest', 'belt', 'rod', 'cloak', 'bow', 'gloves', 'tear'] as const;

function drop(roundId: string, encounterId: string, slotId: string, slot: number, payload: RevealedDropView['payload'],
  status: RevealedDropView['status']): RevealedDropView {
  const sourceUnitId = source(roundId, encounterId, slotId), id = dropId(roundId, encounterId, sourceUnitId, slot);
  const identity = { dropId: id, encounterId, sourceUnitId, roundId, payload };
  if (status === 'granted') return { ...identity, status, receiptId: receipt(id), allowedActions: [] };
  if (status === 'retained-terminal') return { ...identity, status, receiptId: null, allowedActions: [], reason: 'terminal-bench-full' };
  return { ...identity, status, receiptId: null, allowedActions: [], reason: status === 'pending-capacity' ? 'bench-full' : 'auto-grant-in-domain' };
}
const choice = (roundId: string, encounterId: string, slotId: string, slot: number): PendingChoice => {
  const choiceId = JSON.stringify(['m8b-loot-choice', dropId(roundId, encounterId, source(roundId, encounterId, slotId), slot)]);
  return { kind: 'component', step: 'offer', choiceId, eventId: choiceId, generation: 0, returnPhase: 'settlement', offers: COMPONENTS, targetId: null, rerollCount: 0 };
};

const pendingIdentity = (roundId: string, encounterId: string, slotId: string, slot: number): LootView['pendingChoice'] => {
  const sourceUnitId = source(roundId, encounterId, slotId), id = dropId(roundId, encounterId, sourceUnitId, slot);
  return { dropId: id, encounterId, sourceUnitId, roundId, choiceId: JSON.stringify(['m8b-loot-choice', id]), generation: 0 };
};
/** Source unit → monster definition, standing in for readEncounterPreview of the same round. */
export const SAMPLE_SOURCES: Readonly<Record<string, string>> = {
  [source('2-7', 'krugs-v1', 'k01')]: 'pve-krug', [source('2-7', 'krugs-v1', 'k02')]: 'pve-krug',
  [source('3-7', 'wolves-v1', 'w00')]: 'pve-wolf-large', [source('3-7', 'wolves-v1', 'w01')]: 'pve-wolf-small',
  [source('4-7', 'razorbeaks-v1', 'r00')]: 'pve-razorbeak-large', [source('4-7', 'razorbeaks-v1', 'r01')]: 'pve-razorbeak-small',
  [source('6-7', 'rift-herald-v1', 'h01')]: 'pve-rift-herald',
};

export interface LootSample {
  readonly id: string; readonly title: string; readonly phase: 'combat' | 'choice' | 'settlement' | 'gameOver';
  readonly description: string; readonly view: LootView; readonly pendingChoice: PendingChoice | null;
}

export const LOOT_SAMPLES: readonly LootSample[] = [
  {
    id: 'results', title: '已揭示奖励与已解决选择', phase: 'settlement',
    description: '2-7 结算：两只载体都被击杀，直接掉落已入库，组件选择已完成并入库，可以继续。',
    view: { roundId: '2-7', canContinue: true, reason: null, pendingChoice: null, pendingClaims: [], revealedDrops: [
      drop('2-7', 'krugs-v1', 'k01', 0, { kind: 'item', definitionId: 'bow', quantity: 1 }, 'granted'),
      drop('2-7', 'krugs-v1', 'k01', 1, { kind: 'unit', definitionId: 'irelia', quantity: 1 }, 'granted'),
      drop('2-7', 'krugs-v1', 'k02', 0, { kind: 'item', definitionId: 'belt', quantity: 1 }, 'granted'),
    ] },
    pendingChoice: null,
  },
  {
    id: 'revealed', title: '战中已揭示', phase: 'combat',
    description: '4-7 战斗中：大鸟已被击杀，奖励只揭示不发放，战斗结束后由领域统一处理。',
    view: { roundId: '4-7', canContinue: false, reason: 'unsettled-round', pendingChoice: null, pendingClaims: [], revealedDrops: [
      drop('4-7', 'razorbeaks-v1', 'r00', 0, { kind: 'item', definitionId: 'cloak', quantity: 1 }, 'revealed'),
      drop('4-7', 'razorbeaks-v1', 'r00', 1, { kind: 'unit', definitionId: 'kogmaw', quantity: 1 }, 'revealed'),
    ] },
    pendingChoice: null,
  },
  {
    id: 'choice', title: '待选：八组件选择', phase: 'choice',
    description: '2-7 战后：直接掉落已入库，k02 的组件选择等待玩家从固定 8 项中选 1。',
    view: { roundId: '2-7', canContinue: false, reason: 'pending-choice', pendingChoice: pendingIdentity('2-7', 'krugs-v1', 'k02', 0), pendingClaims: [], revealedDrops: [
      drop('2-7', 'krugs-v1', 'k01', 0, { kind: 'item', definitionId: 'bow', quantity: 1 }, 'granted'),
      drop('2-7', 'krugs-v1', 'k01', 1, { kind: 'unit', definitionId: 'irelia', quantity: 1 }, 'granted'),
    ] },
    pendingChoice: choice('2-7', 'krugs-v1', 'k02', 0),
  },
  {
    id: 'bench-full', title: '满席等待', phase: 'settlement',
    description: '3-7 结算：奖励英雄因备战席已满等待入库，Continue 被阻塞，直到出售或合成释放空位。',
    view: { roundId: '3-7', canContinue: false, reason: 'pending-capacity', pendingChoice: null, pendingClaims: [dropId('3-7', 'wolves-v1', source('3-7', 'wolves-v1', 'w00'), 1)], revealedDrops: [
      drop('3-7', 'wolves-v1', 'w00', 0, { kind: 'item', definitionId: 'sword', quantity: 1 }, 'granted'),
      drop('3-7', 'wolves-v1', 'w00', 1, { kind: 'unit', definitionId: 'darius', quantity: 1 }, 'pending-capacity'),
      drop('3-7', 'wolves-v1', 'w01', 0, { kind: 'item', definitionId: 'rod', quantity: 1 }, 'granted'),
    ] },
    pendingChoice: null,
  },
  {
    id: 'terminal', title: '终局保留', phase: 'gameOver',
    description: '4-7 生命归零提前终局：已赚得的奖励在同一事务中处理，满席英雄作为终局记录保留，不可操作。',
    view: { roundId: '4-7', canContinue: false, reason: 'game-over', pendingChoice: null, pendingClaims: [], revealedDrops: [
      drop('4-7', 'razorbeaks-v1', 'r00', 0, { kind: 'item', definitionId: 'cloak', quantity: 1 }, 'granted'),
      drop('4-7', 'razorbeaks-v1', 'r00', 1, { kind: 'unit', definitionId: 'kogmaw', quantity: 1 }, 'retained-terminal'),
      drop('4-7', 'razorbeaks-v1', 'r01', 0, { kind: 'item', definitionId: 'tear', quantity: 1 }, 'granted'),
    ] },
    pendingChoice: null,
  },
];
