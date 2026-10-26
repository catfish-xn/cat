/**
 * Public surface of the room state machine. The UI (src/rendering/online) imports only from here and
 * from src/server/protocol.ts; every other file under src/server/room is an implementation detail.
 */
export * from './types';
export { ManualClock, type Clock, type ClockHandle } from './clock';
export { RealClock } from './real-clock';
export { PlaceholderBattleResolver, BattleResolveError, type BattleResolver } from './battle-resolver';
export { TwoSidedBattleResolver, resolveTwoSidedPvp } from './two-sided-resolver';
export { candidateOpponents, planCandidates, planPairings, recordPairings, findPairing, DEFAULT_PAIRING_POLICY, PAIRING_HISTORY_LIMIT, type CandidateMap, type PairingHistory, type PairingPlan, type PairingPolicy } from './pairing';
export { Room, ROOM_TIMING_DEFAULTS, PER_ROUND_PREPARATION, applySeatCommand, type RoomOptions, type RoomTimings, type CommitResult, type CommitFailure, type PlanResult } from './room';
export {
  toPlayerView, toSeatPublic, toPlayerFault, toSeatPrivateView, seatPushEvents, toCombatReplayFor, mirrorCombatReplay,
  type SeatReplay,
  mirrorReplayTick,
} from './projection';
export { Lobby, type LobbyOptions, type JoinResult, type StartResult } from './lobby';
export { BotDriver, BOT_DRIVER_DEFAULTS, deriveBotRng, type BotDriverOptions, type BotStepRecord } from './bot-driver';
