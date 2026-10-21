import { it } from 'vitest';
import { verifyReplay } from './m5-replay-helper';

// Temporarily 600 s like the sniper replays (user-approved 2026-10-20 04:22 timing rule; locally ~244 s under full load); restore to 360 s once D12 speeds these replays up.
it('M5 mage restores every command and tick; rejected insertion preserves every field', () => verifyReplay('mage'), 600000);
