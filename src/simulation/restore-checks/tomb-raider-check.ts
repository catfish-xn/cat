// 存档恢复专用校验。只随单人 application 动态加载，实时对局命令不引用这里。
import { hasTombRaider, isOwner, openTombRaiderChoice, TOMB_RAIDER_SOURCE, tombRaiderChoiceId, tombRaiderOpportunities } from '../augment-pool-batch5-r1';
import { canonicalContent } from '../content/index';
import { replayG23Economy } from '../g2-3-match-progress';
import { g23RadiantDefinitionId } from '../g2-3-rewards';
import { g23RadiantRound } from '../g2-3-settlement';
import { readG23Progress } from '../g2-3-state';
import type { MatchState } from '../match-types';
import { getCatalogRoundById } from '../round-selectors';
import { validateG23RewardSources } from './g23-state-check';

/** Bind receipts, pending candidates and item births to authenticated elimination history. */
export function validateTombRaider(state: MatchState): void {
  const fail = (): never => { throw new RangeError('Invalid tomb raider authority'); };
  let radiantRound: number | undefined;
  let radiantValidated = false;
  const expected = new Map(state.multiplayer && hasTombRaider(state) ? state.augments.filter(a => isOwner(a.definitionId))
    .flatMap(a => tombRaiderOpportunities(state, a.choiceId).filter(o => o.candidates.length)
      .map(o => [tombRaiderChoiceId(a.choiceId, o.seatId), o] as const)) : []);
  const receipts = state.seatMechanics?.receipts ?? [];
  let unresolved = false;
  for (const [choiceId, opportunity] of expected) {
    const receipt = receipts.find(r => r.receiptId === choiceId);
    if (!receipt) { unresolved = true; continue; }
    if (receipt.kind !== 'choice') return fail();
    if (unresolved || receipt.source !== TOMB_RAIDER_SOURCE || receipt.choiceKind !== 'forge'
      || receipt.price !== 0 || receipt.skipped || !receipt.itemId || receipt.round < opportunity.round || receipt.round > state.round
      || !opportunity.candidates.some(c => c.definitionId === receipt.optionId)
      || receipt.timedOut && receipt.optionId !== opportunity.candidates[0].definitionId) fail();
    const itemId = receipt.itemId!; // The receipt guard above rejects missing item identities.
    const birth = state.resourceProvenance.entries.filter(f => f.kind === 'item-acquired' && f.itemId === itemId);
    if (birth.length !== 1 || birth[0].kind !== 'item-acquired' || birth[0].source.kind !== 'mechanic'
      || birth[0].source.receiptId !== choiceId || birth[0].roundId !== receipt.roundId) fail();
    const entries = state.resourceProvenance.entries;
    const birthIndex = entries.indexOf(birth[0]);
    if (birth[0].sequence !== birthIndex) fail();
    let definitionId = receipt.optionId;
    let retained = true;
    for (const [index, fact] of entries.entries()) {
      if (index > birthIndex && fact.kind === 'item-combined' && fact.event.consumedIds.includes(itemId)) retained = false;
      if (index > birthIndex && fact.kind === 'consumable-used') {
        const affected = fact.record.affectedItems.findIndex(item => item.id === itemId);
        if (affected >= 0 && fact.record.outputs[affected]?.id !== itemId) retained = false;
      }
      if (fact.kind !== 'g23-item-converted' || fact.itemId !== itemId) continue;
      if (!radiantValidated) {
        try {
          validateG23RewardSources(state);
          const progress = readG23Progress(state);
          if (!progress) return fail();
          const replayed = replayG23Economy(state.seed, progress.economyReceipts);
          if (canonicalContent(progress.conquest) !== canonicalContent(replayed.conquest)) return fail();
          radiantRound = g23RadiantRound(state);
        } catch { return fail(); }
        radiantValidated = true;
      }
      try {
        const round = getCatalogRoundById(fact.roundId).ordinal;
        const target = g23RadiantDefinitionId(fact.from);
        if (!retained || index <= birthIndex || fact.sequence !== index || getCatalogRoundById(birth[0].roundId).ordinal !== receipt.round
          || round < receipt.round || round > state.round
          || radiantRound === undefined || round < radiantRound || fact.receiptId !== 'g23:conqueror:15'
          || fact.from !== definitionId || !target || target !== fact.to) fail();
      } catch { return fail(); }
      definitionId = fact.to;
    }
    const items = state.items.filter(i => i.id === itemId);
    if (items.length > 1 || items.some(item => !retained || item.definitionId !== definitionId)) fail();
  }
  for (const receipt of receipts) if ((receipt.source === TOMB_RAIDER_SOURCE || receipt.receiptId.startsWith(`["${TOMB_RAIDER_SOURCE}",`))
    && !expected.has(receipt.receiptId)) fail();
  if (state.pendingChoice?.payload?.source === TOMB_RAIDER_SOURCE) {
    const waiting = { ...state, phase: state.pendingChoice.returnPhase, pendingChoice: null } as MatchState;
    const expectedChoice = openTombRaiderChoice(waiting).state.pendingChoice;
    if (canonicalContent(state.pendingChoice) !== canonicalContent(expectedChoice)) fail();
  } else if (unresolved && state.multiplayer?.status === 'active' && !state.pendingChoice
    && ['preparation', 'settlement'].includes(state.phase) && state.m8.round.kind !== 'supply') fail();
}
