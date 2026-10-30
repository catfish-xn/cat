/** Keep unexpected rule exceptions observable without putting a logging dependency in simulation. */
import { runSharedMatchCommand as runRulesCommand } from '../../server-entry';
import { textLogger, type Logger } from '../log';

const log = textLogger(line => console.error(line));

export function runSharedMatchCommand(
  pool: Parameters<typeof runRulesCommand>[0],
  state: Parameters<typeof runRulesCommand>[1],
  command: Parameters<typeof runRulesCommand>[2],
  logger: Logger = log,
): ReturnType<typeof runRulesCommand> {
  return runRulesCommand(pool, state, command, error => logger('error', 'shared-pool.unexpected-error', {
    roomId: pool.poolId, seatId: state.sharedPool?.seatId, round: state.round, command: command.type,
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  }));
}
