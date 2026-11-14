import { sion } from './sion';
import { silco } from './silco';
import { elise } from './elise';
import { illaoi } from './illaoi';
import { swain } from './swain';
import { rell } from './rell';
import { loris } from './loris';
export const batch3Timelines = { 'g23-sion': sion, silco, elise, illaoi, swain, rell, loris };
export const isBatch3 = (id: string): id is keyof typeof batch3Timelines => Object.hasOwn(batch3Timelines, id);
