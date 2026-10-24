/** Options of the in-tab local room (`?mode=online`, server=local). Kept apart from local-room-client.ts so mode.ts reads them in builds without the room. */
import type { Clock, PvpMode } from '../../server/room';

export interface LocalRoomOptions {
  readonly seed: number;
  readonly preparationMs: number;
  readonly choiceMs: number;
  readonly settlementMs: number;
  readonly myName: string;
  /** Debug only (`?faultAt=N`): the resolver throws on round N so the room's fault path can be seen in the UI. */
  readonly faultAtRound: number | null;
  /** `two-sided` (default): real PvP through T2/T3. `placeholder` is the B1 test path (`?pvp=placeholder`). */
  readonly pvpMode: PvpMode;
  /** Debug only (`?poolCaps=irelia:8,darius:1`): a scarce shared pool so empty shop slots and pool-empty rerolls can be seen
   * (the room tops up the random opening heroes, `withOpeningCopies`); null = official sizes. */
  readonly poolCapacities?: Readonly<Record<string, number>> | null;
  /** G1-P7 shared carousel at the opening and the x-4 rounds, as on the game server (CAT_CAROUSEL); `?carousel=0` turns it off. */
  readonly carousel?: boolean;
  /** Injectable for tests; the browser uses the real clock. */
  readonly clock?: Clock;
}
export const LOCAL_ROOM_DEFAULTS: LocalRoomOptions = { seed: 42, preparationMs: 30_000, choiceMs: 30_000, settlementMs: 6_000, myName: '玩家', faultAtRound: null, pvpMode: 'two-sided', poolCapacities: null, carousel: true };
