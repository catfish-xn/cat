/**
 * v16 anomalies 终极英雄 / 进入未知 for display. Everything comes from the rules' own private display block: the seat
 * view's `d14Display` online (plus each promoted unit's `effectiveStarLevel`), `d14PrivateDisplay` offline. Phase,
 * remaining settlements, star levels, sell gold and pool copies are the rules' numbers; nothing is counted here.
 */
import { d14PrivateDisplay } from '../simulation/d14-runtime';
import { d14UnitBase } from '../simulation/d14-anomalies/projection';
import type { MatchState } from '../simulation/match-types';
import { displayUnitName } from '../rendering/display-names';

export type D14Display = NonNullable<ReturnType<typeof d14PrivateDisplay>>;

/** The rules' D14 block of my seat, or null when I have neither anomaly. */
export function readD14Display(state: MatchState): D14Display | null {
  const sent = (state as { readonly d14Display?: D14Display }).d14Display;
  if (sent && typeof sent.unitId === 'string') return sent;
  return state.d14 ? d14PrivateDisplay(state) ?? null : null;
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

export const starText = (star: number): string => '★'.repeat(Math.max(1, Math.min(4, Math.trunc(star))));

/** Card / detail lines for one of my units; empty when the anomaly is not on it. */
export function d14UnitNotes(state: MatchState, unitId: string): string[] {
  const d14 = readD14Display(state);
  if (!d14 || d14.unitId !== unitId) return [];
  if (d14.anomalyId === 'ultimate-hero') {
    if (d14.phase === 'promoted') return [`终极英雄 · 有效四星（物理 3 星，占卡池 ${d14.poolCopies ?? 9} 份）`, `出售返还 ${d14.sellGold ?? 9} 金币`];
    if (d14.phase === 'waiting') return [`终极英雄 · 再 ${d14.remainingSettlements} 次回合结算后晋升四星`];
    return [];
  }
  return d14.phase === 'returned' ? ['进入未知 · 已归来：永久 +50% 攻击力、+50 法术强度'] : [];
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
  return `进入未知 → ${name} · 已归来：永久 +50% 攻击力、+50 法术强度`;
}
