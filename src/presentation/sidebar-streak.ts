/** Client-side forward-compatible shape, pending the public SeatPublic.streak field.
 * See docs/UI_REQUESTS.md SR-V26-SIDEBAR. Never infer opponents' streaks from HP or replays. */
export interface SidebarStreak { readonly kind: 'win' | 'loss' | null; readonly count: number }
// Continuous portrait flame: historical observed threshold, not the gold/notification threshold.
// The exact 14.24 trigger is not exposed by the shipped scoreboard JSON; evidence caveat is in the request.
export const SIDEBAR_FIRE_WINS = 4;
export function sidebarWinStreak(seat: { readonly alive: boolean; readonly streak?: SidebarStreak }): number | null {
  const streak = seat.streak;
  return seat.alive && streak?.kind === 'win' && Number.isSafeInteger(streak.count) && streak.count >= SIDEBAR_FIRE_WINS ? streak.count : null;
}
