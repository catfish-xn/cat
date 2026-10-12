/**
 * Public surface of the room state machine. The UI (src/rendering/online) imports only from here and
 * from src/server/protocol.ts; every other file under src/server/room is an implementation detail.
 */
export * from './types';
export { ManualClock, type Clock, type ClockHandle } from './clock';
export { RealClock } from './real-clock';
export { PlaceholderBattleResolver, BattleResolveError, type BattleResolver } from './battle-resolver';
export { TwoSidedBattleResolver, resolveTwoSidedPvp } from './two-sided-resolver';
export { planPairings, findPairing, type PairingPlan } from './pairing';
export { Room, ROOM_TIMING_DEFAULTS, applySeatCommand, type RoomOptions, type RoomTimings, type CommitResult, type CommitFailure, type PlanResult } from './room';
export { toPlayerView, toSeatPublic, toCombatFrames, toPlayerFault, mirrorCombatFrame, type CombatFrameView } from './projection';
export { Lobby, type LobbyOptions, type JoinResult, type StartResult } from './lobby';
