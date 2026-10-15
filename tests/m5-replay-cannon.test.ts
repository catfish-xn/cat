import { it } from 'vitest';
import { verifyReplay } from './m5-replay-helper';

it('M5 cannon restores every command and tick; rejected insertion preserves every field', () => verifyReplay('cannon'), 180000);
