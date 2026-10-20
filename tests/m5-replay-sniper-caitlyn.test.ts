import { it } from 'vitest';
import { verifyReplay } from './m5-replay-helper';

// Temporarily 600 s (user-approved 2026-10-20 02:48); restore to 360 s once D12 speeds these replays up.
it('M5 sniper-caitlyn restores every command and tick; rejected insertion preserves every field', () => verifyReplay('sniper-caitlyn'), 600000);
