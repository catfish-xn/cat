import type { ClientCommand } from '../../server/protocol';
import type { HexCell } from '../board';

export const BOT_POLICY_VERSION = 'basic-bot-v1';
export const BOT_MAX_STEPS = 64;
/** Public observations only. The basic policy does not scout opponents yet. */
export interface BotContext {
  readonly difficulty: 'basic';
  /** Count every attempted command, including rejected commands; reset only on a new round. */
  readonly stepsTaken: number;
  readonly maxSteps: number;
  readonly self: { readonly seatId: string; readonly hp: number; readonly round: number };
  readonly opponents?: readonly {
    readonly seatId: string; readonly hp: number; readonly level: number;
    readonly units: readonly { readonly definitionId: string; readonly starLevel: number; readonly cell: HexCell }[];
  }[];
  /** A rejection ends this round's policy. B6 retains this until the next round. */
  readonly lastFailure?: { readonly action: ClientCommand; readonly reason: string };
}
export interface BotDecision { readonly action: ClientCommand | 'done'; readonly rng: number }
