/**
 * v16 anomalies 终极英雄 / 进入未知 for display. Everything comes from the rules' own private display block: the seat
 * view's `d14Display` online (plus each promoted unit's `effectiveStarLevel`), the same seat view of the state offline. Phase,
 * remaining settlements, star levels, sell gold and pool copies are the rules' numbers; nothing is counted here.
 */
import { toPrivateSeatView, type PrivateSeatView } from '../simulation/private-seat-view';
import { d14UnitBase } from '../simulation/d14-anomalies/projection';
import type { MatchState } from '../simulation/match-types';
import { D14_POLICY } from '../simulation/content/d14-anomalies';
import { displayUnitName } from '../rendering/display-names';

export type D14Display = NonNullable<PrivateSeatView['d14Display']>;
/** Offline: the rules' own seat view of the state, built once per state object (only after a D14 anomaly is chosen). */
const offline = new WeakMap<MatchState, D14Display | null>();

/** The rules' D14 block of my seat, or null when I have neither anomaly. */
export function readD14Display(state: MatchState): D14Display | null {
  const sent = (state as { readonly d14Display?: D14Display }).d14Display;
  if (sent && typeof sent.unitId === 'string') return sent;
  if (!state.d14) return null;
  if (!offline.has(state)) offline.set(state, toPrivateSeatView(state).d14Display ?? null);
  return offline.get(state)!;
}

/** Star level to draw: 4 for a promoted Ultimate Hero (physically still 3★), else the unit's own. */
export function displayStarLevel(state: MatchState, unit: { readonly id: string; readonly starLevel: number }): number {
  const sent = (unit as { readonly effectiveStarLevel?: number }).effectiveStarLevel;
  if (sent === 4) return 4;
  const d14 = readD14Display(state);
  return d14?.unitId === unit.id && d14.phase === 'promoted' ? 4 : unit.starLevel;
}

/** Base stats of an effective 4★ (the rules' certified Ultimate Hero base); null when the hero cannot be one. */
export function fourStarBaseStats(definitionId: string) {
  try { return d14UnitBase({ definitionId, starLevel: 3 }, true).base; } catch (error) { if (error instanceof RangeError) return null; throw error; }
}

/** 进入未知's permanent gain, from the content's policy (basis points → percent). */
const RETURN_GAIN = `永久 +${D14_POLICY.gainedADBps / 100}% 攻击力、+${D14_POLICY.gainedAP} 法术强度`;

export const starText = (star: number): string => '★'.repeat(Math.max(1, Math.min(4, Math.trunc(star))));

/** Card / detail lines for one of my units; empty when the anomaly is not on it. */
export function d14UnitNotes(state: MatchState, unitId: string): string[] {
  const d14 = readD14Display(state);
  if (!d14 || d14.unitId !== unitId) return [];
  if (d14.anomalyId === 'ultimate-hero') {
    // Pool copies and sell gold are the rules' fields; a line whose number did not come is left out, never guessed.
    if (d14.phase === 'promoted') return [`终极英雄 · 有效四星（物理 3 星${d14.poolCopies !== undefined ? `，占卡池 ${d14.poolCopies} 份` : ''}）`,
      ...(d14.sellGold !== undefined ? [`出售返还 ${d14.sellGold} 金币`] : [])];
    if (d14.phase === 'waiting') return [`终极英雄 · 再 ${d14.remainingSettlements} 次回合结算后晋升四星`];
    return [];
  }
  return d14.phase === 'returned' ? [`进入未知 · 已归来：${RETURN_GAIN}`] : [];
}

/** One line for the "异常" row of the side panel; null when the anomaly is not a D14 one. */
export function d14AnomalyLine(state: MatchState): string | null {
  const d14 = readD14Display(state);
  if (!d14 || d14.phase === 'retired') return null;
  const definitionId = d14.heldUnit?.definitionId ?? state.preparation.units.find(unit => unit.id === d14.unitId)?.definitionId;
  const name = definitionId ? displayUnitName(definitionId) : '英雄';
  if (d14.anomalyId === 'ultimate-hero') {
    return d14.phase === 'promoted' ? `终极英雄 → ${name} · 已晋升有效四星` : `终极英雄 → ${name} · 再 ${d14.remainingSettlements} 次回合结算后晋升四星`;
  }
  if (d14.phase === 'absent') {
    const items = d14.heldItems?.length ? `，携带 ${d14.heldItems.length} 件装备` : '';
    return d14.remainingSettlements > 0
      ? `进入未知 → ${name} 离场中${items} · 再 ${d14.remainingSettlements} 次回合结算后归来`
      : `进入未知 → ${name} 可以归来 · 等待备战席或上场空位${items}`;
  }
  return `进入未知 → ${name} · 已归来：${RETURN_GAIN}`;
}
