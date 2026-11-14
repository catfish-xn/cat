/** Client-side forward-compatible shape, pending the public SeatPublic.streak field.
 * See docs/UI_REQUESTS.md SR-V26-SIDEBAR. Never infer opponents' streaks from HP or replays. */
export interface SidebarStreak { readonly kind: 'win' | 'loss' | null; readonly count: number }

/** 14.24 scoreboard exposes WinStreakLoopLevel1/2 VFX tiers only; numeric triggers are not in JSON (推断). */
export const SIDEBAR_FIRE_WINS_LEVEL1 = 3;
export const SIDEBAR_FIRE_WINS_LEVEL2 = 5;

export interface SidebarWinFire { readonly count: number; readonly level: 1 | 2 }

/** @deprecated Use SIDEBAR_FIRE_WINS_LEVEL1; kept for callers that only need the lower tier gate. */
export const SIDEBAR_FIRE_WINS = SIDEBAR_FIRE_WINS_LEVEL1;

export function sidebarWinStreak(seat: { readonly alive: boolean; readonly streak?: SidebarStreak }): SidebarWinFire | null {
  const streak = seat.streak;
  if (!seat.alive || streak?.kind !== 'win' || !Number.isSafeInteger(streak.count)) return null;
  if (streak.count >= SIDEBAR_FIRE_WINS_LEVEL2) return { count: streak.count, level: 2 };
  if (streak.count >= SIDEBAR_FIRE_WINS_LEVEL1) return { count: streak.count, level: 1 };
  return null;
}
